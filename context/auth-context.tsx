"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { STAFF_PORTAL_PASSWORD } from "@/lib/auth-constants"
import type { StaffMember, StaffPermissions, Customer } from "@/lib/data"
import { rolePermissions, staffMembers, customers } from "@/lib/data"

const STAFF_STORAGE_KEY = "goraya-current-staff"
const CUSTOMER_STORAGE_KEY = "goraya-current-customer"

export type LoginResult =
  | { ok: true; user?: StaffMember; customer?: Customer }
  | { ok: false; message: string }

interface AuthContextType {
  currentUser: StaffMember | null
  currentCustomer: Customer | null
  isAuthenticated: boolean
  isCustomerAuthenticated: boolean
  isAuthReady: boolean
  login: (staffId: string, password: string) => LoginResult
  loginCustomer: (phone: string, nameOrPassword: string) => Promise<LoginResult>
  registerCustomer: (name: string, phone: string, address: string, password: string) => Promise<LoginResult>
  logout: () => void
  logoutCustomer: () => void
  hasPermission: (permission: keyof StaffPermissions) => boolean
  permissions: StaffPermissions | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<StaffMember | null>(null)
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null)
  const [staffList, setStaffList] = useState<any[]>(staffMembers)
  const [isAuthReady, setIsAuthReady] = useState(false)

  const normalizePhone = (value: string) => value.replace(/[^0-9]/g, "")

  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const rawStaff = window.localStorage.getItem(STAFF_STORAGE_KEY)
      const rawCustomer = window.localStorage.getItem(CUSTOMER_STORAGE_KEY)

      if (rawStaff) {
        setCurrentUser(JSON.parse(rawStaff))
      }
      if (rawCustomer) {
        setCurrentCustomer(JSON.parse(rawCustomer))
      }
    } catch (error) {
      console.warn("Failed to hydrate auth state from storage:", error)
    } finally {
      setIsAuthReady(true)
    }
  }, [])

  useEffect(() => {
    async function loadStaff() {
      try {
        const res = await fetch("/api/staff")
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            setStaffList(data)
          }
        }
      } catch (err) {
        console.warn("Failed to fetch staff from database, using local data:", err)
      }
    }
    loadStaff()
  }, [])

  useEffect(() => {
    if (!isAuthReady || typeof window === "undefined") return

    if (currentUser) {
      window.localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(currentUser))
    } else {
      window.localStorage.removeItem(STAFF_STORAGE_KEY)
    }
  }, [currentUser, isAuthReady])

  useEffect(() => {
    if (!isAuthReady || typeof window === "undefined") return

    if (currentCustomer) {
      window.localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(currentCustomer))
    } else {
      window.localStorage.removeItem(CUSTOMER_STORAGE_KEY)
    }
  }, [currentCustomer, isAuthReady])

  const login = (staffIdOrContact: string, password: string): LoginResult => {
    const normalizedInput = staffIdOrContact.trim()
    const normalizedPhone = normalizePhone(normalizedInput)
    const staff = staffList.find((s) => {
      const byId = s.id === normalizedInput
      const byEmail = (s.email || "").toLowerCase() === normalizedInput.toLowerCase()
      const byPhone = normalizePhone(s.phone || "") === normalizedPhone
      return byId || byEmail || byPhone
    })

    if (!staff || staff.status !== "active") {
      return { ok: false, message: "Invalid email/phone or inactive account." }
    }

    const requiredPassword = staff.password || STAFF_PORTAL_PASSWORD
    if (password !== requiredPassword) {
      return { ok: false, message: "Wrong password." }
    }

    setCurrentUser(staff)
    return { ok: true, user: staff }
  }

  const loginCustomer = async (phone: string, nameOrPassword: string): Promise<LoginResult> => {
    try {
      const res = await fetch("/api/customers/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password: nameOrPassword }),
      })

      if (res.ok) {
        const data = await res.json()
        setCurrentCustomer(data.customer)
        return { ok: true, customer: data.customer }
      }

      const data = await res.json()
      return { ok: false, message: data.error || "Could not contact server to authenticate." }
    } catch (err) {
      // Local fallback
      const found = customers.find(
        c => c.phone === phone ||
        normalizePhone(c.phone || "") === normalizePhone(phone)
      )
      if (found) {
        if (nameOrPassword !== "1234") {
          return { ok: false, message: "Wrong password (default: 1234)." }
        }
        const fallbackCustomer = { ...found, password: "1234" } as any
        setCurrentCustomer(fallbackCustomer)
        return { ok: true, customer: fallbackCustomer }
      }
      return { ok: false, message: "Authentication failed. Local backup customer not found." }
    }
  }

  const registerCustomer = async (
    name: string,
    phone: string,
    address: string,
    password: string
  ): Promise<LoginResult> => {
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, address, password }),
      })

      const data = await res.json()
      if (res.ok && data.ok) {
        setCurrentCustomer(data.customer)
        return { ok: true, customer: data.customer }
      }

      return { ok: false, message: data.error || "Failed to register customer." }
    } catch (err) {
      console.warn("Failed to register customer:", err)
      return { ok: false, message: "Could not connect to the server to create your account." }
    }
  }

  const logoutCustomer = () => {
    setCurrentCustomer(null)
  }

  const logout = () => {
    setCurrentUser(null)
  }

  const hasPermission = (permission: keyof StaffPermissions): boolean => {
    if (!currentUser) return false
    return rolePermissions[currentUser.role][permission]
  }

  const permissions = currentUser ? rolePermissions[currentUser.role] : null

  return (
    <AuthContext.Provider value={{
      currentUser,
      currentCustomer,
      isAuthenticated: !!currentUser,
      isCustomerAuthenticated: !!currentCustomer,
      isAuthReady,
      login,
      loginCustomer,
      registerCustomer,
      logout,
      logoutCustomer,
      hasPermission,
      permissions
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
