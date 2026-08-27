import { NextResponse } from "next/server"
import { getFallbackDb } from "@/lib/fallback-db"
import clientPromise from "@/lib/mongodb"
import { normalizeOrder } from "@/lib/order-utils"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("query")

  if (!query) {
    return NextResponse.json({ ok: false, error: "Query parameter is required" }, { status: 400 })
  }

  try {
    const client = await clientPromise
    const db = client.db("goryaaDB")

    const ordersColl = db.collection("orders")
    const normalizedQuery = query.trim()
    const orders = await ordersColl.find({
      $or: [
        { trackingCode: normalizedQuery },
        { id: normalizedQuery },
        { customerPhone: normalizedQuery },
      ]
    }).sort({ createdAt: -1 }).toArray()

    const formatted = orders.map(order => normalizeOrder({
      ...order,
      id: order._id.toString(),
    }))

    return NextResponse.json(formatted)
  } catch (error: any) {
    const normalizedQuery = query.trim()
    const orders = getFallbackDb().orders
      .filter((order) => {
        return (
          order.trackingCode === normalizedQuery ||
          order.id === normalizedQuery ||
          order.customerPhone === normalizedQuery
        )
      })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((order) => normalizeOrder(order))

    return NextResponse.json(orders)
  }
}
