import {
  customers as seedCustomers,
  ledgerEntries,
  seedOrders,
  seedProducts,
  staffMembers,
} from "@/lib/data"
import { normalizeOrder } from "@/lib/order-utils"

type RuntimeDb = {
  customers: any[]
  ledgers: any[]
  orders: any[]
  products: any[]
  staff: any[]
}

function normalizePhone(value: string) {
  return String(value || "").replace(/[^0-9]/g, "")
}

function createRuntimeDb(): RuntimeDb {
  return {
    customers: seedCustomers.map((customer: any) => ({
      ...customer,
      _id: customer.id,
      id: customer.id,
      normalizedPhone: normalizePhone(customer.phone || ""),
      password: customer.password || "1234",
    })),
    ledgers: ledgerEntries.map((entry) => ({
      ...entry,
      _id: `${entry.bookId}-${entry.id}`,
    })),
    orders: seedOrders.map((order: any) => {
      const normalized = normalizeOrder({
        ...order,
        _id: order.id || order._id,
      })
      return {
        ...normalized,
        _id: normalized.id,
      }
    }),
    products: seedProducts.map((product) => ({
      ...product,
      _id: product.id,
    })),
    staff: staffMembers.map((staff: any) => ({
      ...staff,
      _id: staff.id,
      password: staff.password || "1234",
    })),
  }
}

export function getFallbackDb(): RuntimeDb {
  const globalStore = globalThis as typeof globalThis & {
    __gorayaFallbackDb?: RuntimeDb
  }

  if (!globalStore.__gorayaFallbackDb) {
    globalStore.__gorayaFallbackDb = createRuntimeDb()
  }

  return globalStore.__gorayaFallbackDb
}

export function findFallbackCustomerByPhone(phone: string) {
  const normalizedPhone = normalizePhone(phone)
  return getFallbackDb().customers.find(
    (customer) => customer.phone === phone || normalizePhone(customer.phone || "") === normalizedPhone
  )
}

export function normalizeFallbackPhone(value: string) {
  return normalizePhone(value)
}
