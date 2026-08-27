import { NextResponse } from "next/server"
import { getFallbackDb } from "@/lib/fallback-db"
import clientPromise from "@/lib/mongodb"
import { normalizeOrder } from "@/lib/order-utils"

type Props = {
  params: Promise<{ orderId: string }>
}

export async function GET(_: Request, { params }: Props) {
  const { orderId } = await params

  try {
    const client = await clientPromise
    const db = client.db("goryaaDB")

    const order = await db.collection("orders").findOne({ _id: orderId as any })
    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, order: normalizeOrder(order) })
  } catch (error: any) {
    const order = getFallbackDb().orders.find((entry) => entry._id === orderId || entry.id === orderId)
    if (!order) {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, order: normalizeOrder(order) })
  }
}
