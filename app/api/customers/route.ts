import { NextResponse } from "next/server"
import { getFallbackDb, normalizeFallbackPhone } from "@/lib/fallback-db"
import clientPromise from "@/lib/mongodb"

function toPublicCustomer(customer: any) {
  const { password, ...safeCustomer } = customer
  return {
    ...safeCustomer,
    id: customer._id.toString(),
  }
}

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("goryaaDB")
    const customers = await db.collection("customers").find({}).toArray()
    const formatted = customers.map(toPublicCustomer)
    return NextResponse.json(formatted)
  } catch (error: any) {
    const customers = getFallbackDb().customers.map(toPublicCustomer)
    return NextResponse.json(customers)
  }
}

export async function POST(request: Request) {
  try {
    const client = await clientPromise
    const db = client.db("goryaaDB")
    const body = await request.json()
    const { name, phone, address, balance, password } = body
    const normalizedPhone = String(phone || "").replace(/[^0-9]/g, "")

    if (!name || !phone || !password) {
      return NextResponse.json({ ok: false, error: "Name, phone, and password are required" }, { status: 400 })
    }

    const existingCustomer = await db.collection("customers").findOne({
      $or: [
        { phone: phone.trim() },
        { normalizedPhone },
      ],
    })

    if (existingCustomer) {
      return NextResponse.json({ ok: false, error: "An account with this phone number already exists" }, { status: 409 })
    }

    const id = `c-${Date.now()}`
    const newCustomer = {
      _id: id,
      id,
      name: name.trim(),
      phone: phone.trim(),
      normalizedPhone,
      password: (password || "1234").trim(),
      address: (address || "").trim(),
      balance: Number(balance) || 0,
      createdAt: new Date().toISOString().slice(0, 10),
    }

    await db.collection("customers").insertOne(newCustomer as any)
    return NextResponse.json({ ok: true, customer: toPublicCustomer(newCustomer) })
  } catch (error: any) {
    const store = getFallbackDb()
    const body = await request.json()
    const { name, phone, address, balance, password } = body
    const normalizedPhone = normalizeFallbackPhone(phone)

    if (!name || !phone || !password) {
      return NextResponse.json({ ok: false, error: "Name, phone, and password are required" }, { status: 400 })
    }

    const existingCustomer = store.customers.find((customer) => {
      return customer.phone === String(phone).trim() || customer.normalizedPhone === normalizedPhone
    })

    if (existingCustomer) {
      return NextResponse.json({ ok: false, error: "An account with this phone number already exists" }, { status: 409 })
    }

    const id = `c-${Date.now()}`
    const newCustomer = {
      _id: id,
      id,
      name: String(name).trim(),
      phone: String(phone).trim(),
      normalizedPhone,
      password: String(password).trim(),
      address: String(address || "").trim(),
      balance: Number(balance) || 0,
      createdAt: new Date().toISOString().slice(0, 10),
    }

    store.customers.unshift(newCustomer)
    return NextResponse.json({ ok: true, customer: toPublicCustomer(newCustomer) })
  }
}
