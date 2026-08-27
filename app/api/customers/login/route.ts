import { NextResponse } from "next/server"
import { findFallbackCustomerByPhone } from "@/lib/fallback-db"
import clientPromise from "@/lib/mongodb"

function normalizePhone(value: string) {
  return String(value || "").replace(/[^0-9]/g, "")
}

function toPublicCustomer(customer: any) {
  const { password, ...safeCustomer } = customer
  return {
    ...safeCustomer,
    id: customer._id.toString(),
  }
}

export async function POST(request: Request) {
  const body = await request.json()
  const phone = String(body.phone || "").trim()
  const password = String(body.password || "").trim()

  try {
    const client = await clientPromise
    const db = client.db("goryaaDB")

    if (!phone || !password) {
      return NextResponse.json({ ok: false, error: "Phone and password are required" }, { status: 400 })
    }

    const normalizedPhone = normalizePhone(phone)
    const customer = await db.collection("customers").findOne({
      $or: [
        { phone },
        { normalizedPhone },
      ],
    })

    if (!customer) {
      return NextResponse.json({ ok: false, error: "Customer account not found." }, { status: 404 })
    }

    const requiredPassword = String(customer.password || "1234").trim()
    if (password !== requiredPassword) {
      return NextResponse.json({ ok: false, error: "Wrong password." }, { status: 401 })
    }

    return NextResponse.json({ ok: true, customer: toPublicCustomer(customer) })
  } catch (error: any) {
    if (!phone || !password) {
      return NextResponse.json({ ok: false, error: "Phone and password are required" }, { status: 400 })
    }

    const customer = findFallbackCustomerByPhone(phone)
    if (!customer) {
      return NextResponse.json({ ok: false, error: "Customer account not found." }, { status: 404 })
    }

    const requiredPassword = String(customer.password || "1234").trim()
    if (password !== requiredPassword) {
      return NextResponse.json({ ok: false, error: "Wrong password." }, { status: 401 })
    }

    return NextResponse.json({ ok: true, customer: toPublicCustomer(customer) })
  }
}
