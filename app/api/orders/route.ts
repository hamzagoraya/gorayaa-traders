import { NextResponse } from "next/server"
import { getFallbackDb } from "@/lib/fallback-db"
import clientPromise from "@/lib/mongodb"
import { normalizeOrderItem, normalizeOrder } from "@/lib/order-utils"

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("goryaaDB")
    const orders = await db.collection("orders").find({}).sort({ createdAt: -1 }).toArray()
    const formatted = orders.map((order) => normalizeOrder({
      ...order,
      id: order._id.toString(),
    }))
    return NextResponse.json(formatted)
  } catch (error: any) {
    const orders = getFallbackDb().orders
      .slice()
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((order) => normalizeOrder(order))
    return NextResponse.json(orders)
  }
}

export async function POST(request: Request) {
  const body = await request.json()
  const {
    customerName,
    customerPhone,
    customerAddress,
    items,
    total,
    paymentMethod,
    paymentScreenshot,
    transactionId,
  } = body

  try {
    const client = await clientPromise
    const db = client.db("goryaaDB")

    if (!customerName || !items || !items.length) {
      return NextResponse.json({ ok: false, error: "Invalid order details" }, { status: 400 })
    }

    const id = `order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const trackingCode = `GT-${Math.floor(100000 + Math.random() * 900000)}`
    const normalizedItems = items.map((item: any, index: number) => normalizeOrderItem(item, index))

    const newOrder = {
      _id: id,
      id,
      createdAt: new Date().toISOString(),
      customerName: customerName.trim(),
      customerPhone: (customerPhone || "").trim(),
      customerAddress: (customerAddress || "").trim(),
      items: normalizedItems,
      total: Number(total) || normalizedItems.reduce((sum: number, item: any) => sum + item.lineTotal, 0),
      paymentMethod,
      paymentScreenshot: paymentScreenshot || null,
      transactionId: transactionId || null,
      status: "pending",
      trackingCode,
    }

    await db.collection("orders").insertOne(newOrder as any)
    return NextResponse.json({ ok: true, order: normalizeOrder(newOrder) })
  } catch (error: any) {
    if (!customerName || !items || !items.length) {
      return NextResponse.json({ ok: false, error: "Invalid order details" }, { status: 400 })
    }

    const id = `order-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const trackingCode = `GT-${Math.floor(100000 + Math.random() * 900000)}`
    const normalizedItems = items.map((item: any, index: number) => normalizeOrderItem(item, index))
    const newOrder = {
      _id: id,
      id,
      createdAt: new Date().toISOString(),
      customerName: customerName.trim(),
      customerPhone: (customerPhone || "").trim(),
      customerAddress: (customerAddress || "").trim(),
      items: normalizedItems,
      total: Number(total) || normalizedItems.reduce((sum: number, item: any) => sum + item.lineTotal, 0),
      paymentMethod,
      paymentScreenshot: paymentScreenshot || null,
      transactionId: transactionId || null,
      status: "pending",
      trackingCode,
    }

    getFallbackDb().orders.unshift(newOrder)
    return NextResponse.json({ ok: true, order: normalizeOrder(newOrder) })
  }
}
