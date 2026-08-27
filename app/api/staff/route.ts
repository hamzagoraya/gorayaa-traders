import { NextResponse } from "next/server"
import { getFallbackDb } from "@/lib/fallback-db"
import clientPromise from "@/lib/mongodb"

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db("goryaaDB")
    const staff = await db.collection("staff").find({}).toArray()
    const formatted = staff.map(s => ({
      ...s,
      id: s._id.toString(),
    }))
    return NextResponse.json(formatted)
  } catch (error: any) {
    const staff = getFallbackDb().staff.map((member) => ({
      ...member,
      id: member._id.toString(),
    }))
    return NextResponse.json(staff)
  }
}

export async function POST(request: Request) {
  const body = await request.json()
  const { name, nameUrdu, role, department, phone, salary } = body

  try {
    const client = await clientPromise
    const db = client.db("goryaaDB")

    if (!name || !role) {
      return NextResponse.json({ ok: false, error: "Name and role are required" }, { status: 400 })
    }

    const id = `staff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const newStaff = {
      _id: id,
      id,
      name,
      nameUrdu: nameUrdu || "",
      role,
      department: department || (role === "loader" ? "Load / Unload" : "Management"),
      phone: phone || "",
      salary: Number(salary) || 0,
      status: "active",
      password: "1234",
      advanceFromShop: 0,
      heldForStaff: 0,
    }

    await db.collection("staff").insertOne(newStaff as any)
    return NextResponse.json({ ok: true, staff: newStaff })
  } catch (error: any) {
    if (!name || !role) {
      return NextResponse.json({ ok: false, error: "Name and role are required" }, { status: 400 })
    }

    const store = getFallbackDb()
    const id = `staff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const newStaff = {
      _id: id,
      id,
      name,
      nameUrdu: nameUrdu || "",
      role,
      department: department || (role === "loader" ? "Load / Unload" : "Management"),
      phone: phone || "",
      salary: Number(salary) || 0,
      status: "active",
      password: "1234",
      advanceFromShop: 0,
      heldForStaff: 0,
    }

    store.staff.unshift(newStaff)
    return NextResponse.json({ ok: true, staff: newStaff })
  }
}

export async function PUT(request: Request) {
  const body = await request.json()
  const { id, name, nameUrdu, role, department, phone, salary, status, password } = body

  try {
    const client = await clientPromise
    const db = client.db("goryaaDB")

    if (!id) {
      return NextResponse.json({ ok: false, error: "Staff ID is required" }, { status: 400 })
    }

    const updateFields: any = {}
    if (name !== undefined) updateFields.name = name
    if (nameUrdu !== undefined) updateFields.nameUrdu = nameUrdu
    if (role !== undefined) updateFields.role = role
    if (department !== undefined) updateFields.department = department
    if (phone !== undefined) updateFields.phone = phone
    if (salary !== undefined) updateFields.salary = Number(salary) || 0
    if (status !== undefined) updateFields.status = status
    if (password !== undefined) updateFields.password = password

    await db.collection("staff").updateOne({ _id: id as any }, { $set: updateFields })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    if (!id) {
      return NextResponse.json({ ok: false, error: "Staff ID is required" }, { status: 400 })
    }

    const staff = getFallbackDb().staff.find((member) => member._id === id || member.id === id)
    if (!staff) {
      return NextResponse.json({ ok: false, error: "Staff member not found" }, { status: 404 })
    }

    if (name !== undefined) staff.name = name
    if (nameUrdu !== undefined) staff.nameUrdu = nameUrdu
    if (role !== undefined) staff.role = role
    if (department !== undefined) staff.department = department
    if (phone !== undefined) staff.phone = phone
    if (salary !== undefined) staff.salary = Number(salary) || 0
    if (status !== undefined) staff.status = status
    if (password !== undefined) staff.password = password

    return NextResponse.json({ ok: true })
  }
}

export async function DELETE(request: Request) {
  try {
    const client = await clientPromise
    const db = client.db("goryaaDB")
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ ok: false, error: "Staff ID is required" }, { status: 400 })
    }

    await db.collection("staff").deleteOne({ _id: id as any })
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ ok: false, error: "Staff ID is required" }, { status: 400 })
    }

    const store = getFallbackDb()
    const index = store.staff.findIndex((member) => member._id === id || member.id === id)
    if (index === -1) {
      return NextResponse.json({ ok: false, error: "Staff member not found" }, { status: 404 })
    }

    store.staff.splice(index, 1)
    return NextResponse.json({ ok: true })
  }
}
