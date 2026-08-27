import { NextResponse } from "next/server"
import { getFallbackDb } from "@/lib/fallback-db"
import clientPromise from "@/lib/mongodb"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const bookId = searchParams.get("bookId")
  const query: any = {}
  if (bookId) {
    query.bookId = bookId
  }

  try {
    const client = await clientPromise
    const db = client.db("goryaaDB")

    const entries = await db.collection("ledgers").find(query).toArray()
    const formatted = entries.map(e => ({
      ...e,
      id: e.id || e._id.toString().split("-").slice(1).join("-") || e._id.toString(),
    }))
    return NextResponse.json(formatted)
  } catch (error: any) {
    const entries = getFallbackDb().ledgers
      .filter((entry) => !query.bookId || entry.bookId === query.bookId)
      .map((entry) => ({
        ...entry,
        id: entry.id || entry._id.toString().split("-").slice(1).join("-") || entry._id.toString(),
      }))
    return NextResponse.json(entries)
  }
}

export async function POST(request: Request) {
  const body = await request.json()
  const {
    customerId,
    customerName,
    date,
    type,
    saleType,
    routinePercent,
    dueDate,
    description,
    debit,
    credit,
    balance,
    bookId,
  } = body

  try {
    const client = await clientPromise
    const db = client.db("goryaaDB")

    if (!bookId || !type || !description) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 })
    }

    const entryId = `le-${Date.now()}`
    const newEntry = {
      _id: `${bookId}-${entryId}`,
      id: entryId,
      customerId: customerId || "",
      customerName: customerName || "",
      date: date || new Date().toISOString().slice(0, 10),
      type,
      saleType,
      routinePercent: Number(routinePercent) || undefined,
      dueDate,
      description,
      debit: Number(debit) || 0,
      credit: Number(credit) || 0,
      balance: Number(balance) || 0,
      bookId,
    }

    await db.collection("ledgers").insertOne(newEntry as any)
    return NextResponse.json({ ok: true, entry: newEntry })
  } catch (error: any) {
    if (!bookId || !type || !description) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 })
    }

    const entryId = `le-${Date.now()}`
    const newEntry = {
      _id: `${bookId}-${entryId}`,
      id: entryId,
      customerId: customerId || "",
      customerName: customerName || "",
      date: date || new Date().toISOString().slice(0, 10),
      type,
      saleType,
      routinePercent: Number(routinePercent) || undefined,
      dueDate,
      description,
      debit: Number(debit) || 0,
      credit: Number(credit) || 0,
      balance: Number(balance) || 0,
      bookId,
    }

    getFallbackDb().ledgers.unshift(newEntry)
    return NextResponse.json({ ok: true, entry: newEntry })
  }
}
