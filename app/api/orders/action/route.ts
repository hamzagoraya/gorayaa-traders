import { NextResponse } from "next/server"
import { findFallbackCustomerByPhone, getFallbackDb } from "@/lib/fallback-db"
import clientPromise from "@/lib/mongodb"
import { normalizeOrder } from "@/lib/order-utils"

function findFallbackProduct(productId: string) {
  return getFallbackDb().products.find((product) => product._id === productId || product.id === productId)
}

function upsertFallbackCustomer(order: any) {
  const store = getFallbackDb()
  const existingCustomer = findFallbackCustomerByPhone(order.customerPhone)

  if (existingCustomer) {
    return existingCustomer
  }

  const id = `c-${Date.now()}`
  const customer = {
    _id: id,
    id,
    name: order.customerName,
    phone: order.customerPhone,
    normalizedPhone: String(order.customerPhone || "").replace(/[^0-9]/g, ""),
    address: order.customerAddress,
    balance: 0,
    createdAt: new Date().toISOString().slice(0, 10),
    password: "1234",
  }

  store.customers.unshift(customer)
  return customer
}

export async function POST(request: Request) {
  const body = await request.json()
  const { orderId, action } = body

  try {
    const client = await clientPromise
    const db = client.db("goryaaDB")

    if (!orderId || !action) {
      return NextResponse.json({ ok: false, error: "Missing required parameters" }, { status: 400 })
    }

    const ordersColl = db.collection("orders")
    const productsColl = db.collection("products")
    const ledgersColl = db.collection("ledgers")
    const customersColl = db.collection("customers")

    const rawOrder = await ordersColl.findOne({ _id: orderId as any })
    if (!rawOrder) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 })
    }
    const order = normalizeOrder(rawOrder)

    if (action === "approve") {
      if (order.status !== "pending") {
        return NextResponse.json({ ok: false, error: "Order must be in pending status to approve" }, { status: 400 })
      }

      // Check stock
      for (const item of order.items) {
        const prod = await productsColl.findOne({ _id: item.productId as any })
        if (!prod || prod.stock < item.quantity) {
          return NextResponse.json({
            ok: false,
            error: `Insufficient stock for ${item.name || "product"}. Available: ${prod ? prod.stock : 0}`
          }, { status: 400 })
        }
      }

      // Deduct stock
      for (const item of order.items) {
        await productsColl.updateOne(
          { _id: item.productId as any },
          { $inc: { stock: -item.quantity } }
        )
      }

      // Find or create customer
      const customer = await customersColl.findOne({ phone: order.customerPhone })
      const customerId = customer ? customer._id.toString() : `c-${Date.now()}`
      const currentBalance = customer ? (customer.balance || 0) : 0

      if (!customer) {
        const newCust = {
          _id: customerId as any,
          id: customerId,
          name: order.customerName,
          phone: order.customerPhone,
          address: order.customerAddress,
          balance: 0,
          createdAt: new Date().toISOString().slice(0, 10),
        }
        await customersColl.insertOne(newCust as any)
      }

      // Create ledger entry
      const itemsDescription = order.items.map((i: any) => `${i.name} (${i.quantity} bags)`).join(", ")
      const prepaid = order.paymentMethod !== "cod"
      const debit = order.total
      const credit = prepaid ? order.total : 0
      const newBalance = currentBalance + (debit - credit)

      await customersColl.updateOne(
        { _id: customerId as any },
        { $set: { balance: newBalance } }
      )

      const ledgerEntryId = `le-${Date.now()}`
      await ledgersColl.insertOne({
        _id: `sales-${ledgerEntryId}` as any,
        id: ledgerEntryId,
        customerId,
        customerName: order.customerName,
        date: new Date().toISOString().slice(0, 10),
        type: "sale",
        saleType: prepaid ? "cash" : "routine",
        description: `Order ${order.trackingCode}: ${itemsDescription}`,
        debit,
        credit,
        balance: newBalance,
        bookId: "sales",
      } as any)

      await ordersColl.updateOne(
        { _id: orderId as any },
        { $set: { status: "approved", approvedAt: new Date().toISOString() } }
      )

    } else if (action === "ship") {
      if (order.status !== "approved") {
        return NextResponse.json({ ok: false, error: "Order must be approved before shipping" }, { status: 400 })
      }
      await ordersColl.updateOne(
        { _id: orderId as any },
        { $set: { status: "shipped", shippedAt: new Date().toISOString() } }
      )

    } else if (action === "deliver") {
      if (order.status !== "shipped") {
        return NextResponse.json({ ok: false, error: "Order must be shipped before delivery" }, { status: 400 })
      }

      // If COD, record payment when delivered
      if (order.paymentMethod === "cod") {
        const customer = await customersColl.findOne({ phone: order.customerPhone })
        if (customer) {
          const debit = 0
          const credit = order.total
          const newBalance = (customer.balance || 0) - credit

          await customersColl.updateOne(
            { _id: customer._id as any },
            { $set: { balance: newBalance } }
          )

          const ledgerEntryId = `le-pay-${Date.now()}`
          await ledgersColl.insertOne({
            _id: `sales-${ledgerEntryId}` as any,
            id: ledgerEntryId,
            customerId: customer._id.toString(),
            customerName: order.customerName,
            date: new Date().toISOString().slice(0, 10),
            type: "payment",
            description: `Payment for Order ${order.trackingCode}`,
            debit,
            credit,
            balance: newBalance,
            bookId: "sales",
          } as any)
        }
      }

      await ordersColl.updateOne(
        { _id: orderId as any },
        { $set: { status: "delivered", deliveredAt: new Date().toISOString() } }
      )

    } else if (action === "complete") {
      if (order.status !== "delivered") {
        return NextResponse.json({ ok: false, error: "Only delivered orders can be completed" }, { status: 400 })
      }

      await ordersColl.updateOne(
        { _id: orderId as any },
        { $set: { status: "completed", completedAt: new Date().toISOString() } }
      )

    } else if (action === "cancel") {
      if (order.status === "delivered" || order.status === "completed" || order.status === "cancelled") {
        return NextResponse.json({ ok: false, error: "This order can no longer be cancelled" }, { status: 400 })
      }

      if (order.status === "approved" || order.status === "shipped") {
        for (const item of order.items) {
          await productsColl.updateOne(
            { _id: item.productId as any },
            { $inc: { stock: item.quantity } }
          )
        }

        const customer = await customersColl.findOne({ phone: order.customerPhone })
        if (customer && order.paymentMethod !== "cod") {
          const newBalance = customer.balance || 0

          await customersColl.updateOne(
            { _id: customer._id as any },
            { $set: { balance: newBalance } }
          )
        }
      }

      await ordersColl.updateOne(
        { _id: orderId as any },
        { $set: { status: "cancelled", cancelledAt: new Date().toISOString() } }
      )
    } else {
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    if (!orderId || !action) {
      return NextResponse.json({ ok: false, error: "Missing required parameters" }, { status: 400 })
    }

    const store = getFallbackDb()
    const order = store.orders.find((entry) => entry._id === orderId || entry.id === orderId)
    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 })
    }

    const normalizedOrder = normalizeOrder(order)

    if (action === "approve") {
      if (normalizedOrder.status !== "pending") {
        return NextResponse.json({ ok: false, error: "Order must be in pending status to approve" }, { status: 400 })
      }

      for (const item of normalizedOrder.items) {
        const product = findFallbackProduct(item.productId)
        if (!product || product.stock < item.quantity) {
          return NextResponse.json({
            ok: false,
            error: `Insufficient stock for ${item.name || "product"}. Available: ${product ? product.stock : 0}`,
          }, { status: 400 })
        }
      }

      for (const item of normalizedOrder.items) {
        const product = findFallbackProduct(item.productId)
        if (product) {
          product.stock -= item.quantity
        }
      }

      const customer = upsertFallbackCustomer(normalizedOrder)
      const currentBalance = Number(customer.balance || 0)
      const prepaid = normalizedOrder.paymentMethod !== "cod"
      const debit = normalizedOrder.total
      const credit = prepaid ? normalizedOrder.total : 0
      const newBalance = currentBalance + (debit - credit)
      customer.balance = newBalance

      const ledgerEntryId = `le-${Date.now()}`
      store.ledgers.unshift({
        _id: `sales-${ledgerEntryId}`,
        id: ledgerEntryId,
        customerId: customer.id,
        customerName: normalizedOrder.customerName,
        date: new Date().toISOString().slice(0, 10),
        type: "sale",
        saleType: prepaid ? "cash" : "routine",
        description: `Order ${normalizedOrder.trackingCode}: ${normalizedOrder.items.map((item: any) => `${item.name} (${item.quantity} bags)`).join(", ")}`,
        debit,
        credit,
        balance: newBalance,
        bookId: "sales",
      })

      order.status = "approved"
      order.approvedAt = new Date().toISOString()
    } else if (action === "ship") {
      if (normalizedOrder.status !== "approved") {
        return NextResponse.json({ ok: false, error: "Order must be approved before shipping" }, { status: 400 })
      }
      order.status = "shipped"
      order.shippedAt = new Date().toISOString()
    } else if (action === "deliver") {
      if (normalizedOrder.status !== "shipped") {
        return NextResponse.json({ ok: false, error: "Order must be shipped before delivery" }, { status: 400 })
      }

      if (normalizedOrder.paymentMethod === "cod") {
        const customer = upsertFallbackCustomer(normalizedOrder)
        const newBalance = Number(customer.balance || 0) - normalizedOrder.total
        customer.balance = newBalance

        const ledgerEntryId = `le-pay-${Date.now()}`
        store.ledgers.unshift({
          _id: `sales-${ledgerEntryId}`,
          id: ledgerEntryId,
          customerId: customer.id,
          customerName: normalizedOrder.customerName,
          date: new Date().toISOString().slice(0, 10),
          type: "payment",
          description: `Payment for Order ${normalizedOrder.trackingCode}`,
          debit: 0,
          credit: normalizedOrder.total,
          balance: newBalance,
          bookId: "sales",
        })
      }

      order.status = "delivered"
      order.deliveredAt = new Date().toISOString()
    } else if (action === "complete") {
      if (normalizedOrder.status !== "delivered") {
        return NextResponse.json({ ok: false, error: "Only delivered orders can be completed" }, { status: 400 })
      }

      order.status = "completed"
      order.completedAt = new Date().toISOString()
    } else if (action === "cancel") {
      if (["delivered", "completed", "cancelled"].includes(normalizedOrder.status)) {
        return NextResponse.json({ ok: false, error: "This order can no longer be cancelled" }, { status: 400 })
      }

      if (normalizedOrder.status === "approved" || normalizedOrder.status === "shipped") {
        for (const item of normalizedOrder.items) {
          const product = findFallbackProduct(item.productId)
          if (product) {
            product.stock += item.quantity
          }
        }
      }

      order.status = "cancelled"
      order.cancelledAt = new Date().toISOString()
    } else {
      return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  }
}
