import { NextResponse } from "next/server"
import { getFallbackDb } from "@/lib/fallback-db"
import clientPromise from "@/lib/mongodb"

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("goryaaDB")
    const products = await db.collection("products").find({}).toArray()
    const formattedProducts = products.map((p) => {
      const { _id, ...rest } = p
      return {
        ...rest,
        id: rest.id || _id?.toString?.() || String(_id),
      }
    })
    return NextResponse.json(formattedProducts)
  } catch (error: any) {
    return NextResponse.json(getFallbackDb().products)
  }
}

export async function POST(request: Request) {
  const body = await request.json()

  try {
    const client = await clientPromise
    const db = client.db("goryaaDB")
    
    const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const newProduct = {
      ...body,
      id,
      _id: id,
    }
    
    await db.collection("products").insertOne(newProduct)
    return NextResponse.json({ ok: true, product: newProduct })
  } catch (error: any) {
    const id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const newProduct = {
      ...body,
      id,
      _id: id,
    }

    getFallbackDb().products.unshift(newProduct)
    return NextResponse.json({ ok: true, product: newProduct })
  }
}

export async function PUT(request: Request) {
  const body = await request.json()
  const { id, stock, ...updateData } = body

  try {
    const client = await clientPromise
    const db = client.db("goryaaDB")
    
    if (!id) {
      return NextResponse.json({ ok: false, error: "Product id is required" }, { status: 400 })
    }

    const updates: any = {}
    if (stock !== undefined) {
      updates.stock = Math.max(0, Math.floor(Number(stock) || 0))
    }
    if (Object.keys(updateData).length > 0) {
      Object.assign(updates, updateData)
    }

    await db.collection("products").updateOne(
      { $or: [{ _id: id }, { id }] },
      { $set: updates }
    )
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    if (!id) {
      return NextResponse.json({ ok: false, error: "Product id is required" }, { status: 400 })
    }

    const product = getFallbackDb().products.find((entry) => entry._id === id || entry.id === id)
    if (!product) {
      return NextResponse.json({ ok: false, error: "Product not found" }, { status: 404 })
    }

    if (stock !== undefined) {
      product.stock = Math.max(0, Math.floor(Number(stock) || 0))
    }
    Object.assign(product, updateData)

    return NextResponse.json({ ok: true })
  }
}
