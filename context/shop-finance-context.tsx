"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  seedShopExpenses,
  staffMembers,
  type ShopExpense,
} from "@/lib/data"

const STORAGE_EXP = "goraya-shop-expenses-v1"
const STORAGE_STAFF = "goraya-staff-money-v1"

export interface StaffMoneyBalance {
  staffId: string
  advanceFromShop: number
  heldForStaff: number
}

type StaffMoneyMap = Record<string, StaffMoneyBalance>

function safeNumber(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function initialStaffMoney(): StaffMoneyMap {
  return Object.fromEntries(
    staffMembers.map((staff) => [
      staff.id,
      {
        staffId: staff.id,
        advanceFromShop: 0,
        heldForStaff: 0,
      },
    ])
  )
}

function readExpenses(): ShopExpense[] | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const raw = localStorage.getItem(STORAGE_EXP)

    if (!raw) {
      return null
    }

    const parsed: unknown = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return null
    }

    return parsed.map((item: any, index) => ({
      id:
        item?.id != null
          ? String(item.id)
          : `exp-${Date.now()}-${index}`,

      date: String(item?.date ?? ""),

      category: String(item?.category ?? "General"),

      description: String(item?.description ?? ""),

      amount: safeNumber(item?.amount),
    }))
  } catch {
    return null
  }
}

function readStaffMoney(): StaffMoneyMap | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const raw = localStorage.getItem(STORAGE_STAFF)

    if (!raw) {
      return null
    }

    const parsed: unknown = JSON.parse(raw)

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return null
    }

    return parsed as StaffMoneyMap
  } catch {
    return null
  }
}

function mergeStaffMoney(
  stored: StaffMoneyMap | null
): StaffMoneyMap {
  const base = initialStaffMoney()

  if (!stored) {
    return base
  }

  for (const staffId of Object.keys(base)) {
    const storedStaff = stored[staffId]

    if (!storedStaff) {
      continue
    }

    base[staffId] = {
      staffId,

      advanceFromShop: Math.max(
        0,
        safeNumber(storedStaff.advanceFromShop)
      ),

      heldForStaff: Math.max(
        0,
        safeNumber(storedStaff.heldForStaff)
      ),
    }
  }

  return base
}

interface ShopFinanceContextType {
  expenses: ShopExpense[]

  staffMoney: StaffMoneyMap

  addExpense: (
    expense: Omit<ShopExpense, "id">
  ) => void

  setStaffBalance: (
    staffId: string,
    patch: Partial<
      Pick<
        StaffMoneyBalance,
        "advanceFromShop" | "heldForStaff"
      >
    >
  ) => void

  expenseTotal: number

  hydrated: boolean
}

const ShopFinanceContext =
  createContext<ShopFinanceContextType | undefined>(
    undefined
  )

export function ShopFinanceProvider({
  children,
}: {
  children: ReactNode
}) {
  const [expenses, setExpenses] =
    useState<ShopExpense[]>(seedShopExpenses)

  const [staffMoney, setStaffMoney] =
    useState<StaffMoneyMap>(
      initialStaffMoney
    )

  const [hydrated, setHydrated] =
    useState(false)

  useEffect(() => {
    const storedExpenses = readExpenses()

    if (storedExpenses !== null) {
      setExpenses(storedExpenses)
    }

    const storedStaffMoney =
      readStaffMoney()

    setStaffMoney(
      mergeStaffMoney(storedStaffMoney)
    )

    setHydrated(true)
  }, [])

  useEffect(() => {
    if (
      !hydrated ||
      typeof window === "undefined"
    ) {
      return
    }

    try {
      localStorage.setItem(
        STORAGE_EXP,
        JSON.stringify(expenses)
      )
    } catch {
      // Ignore localStorage errors.
    }
  }, [expenses, hydrated])

  useEffect(() => {
    if (
      !hydrated ||
      typeof window === "undefined"
    ) {
      return
    }

    try {
      localStorage.setItem(
        STORAGE_STAFF,
        JSON.stringify(staffMoney)
      )
    } catch {
      // Ignore localStorage errors.
    }
  }, [staffMoney, hydrated])

  const addExpense = useCallback(
    (expense: Omit<ShopExpense, "id">) => {
      const id = `exp-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`

      const cleanExpense: ShopExpense = {
        ...expense,
        id,
        amount: safeNumber(expense.amount),
      }

      setExpenses((previous) => [
        cleanExpense,
        ...previous,
      ])
    },
    []
  )

  const setStaffBalance = useCallback(
    (
      staffId: string,
      patch: Partial<
        Pick<
          StaffMoneyBalance,
          "advanceFromShop" | "heldForStaff"
        >
      >
    ) => {
      setStaffMoney((previous) => {
        const current =
          previous[staffId] ?? {
            staffId,
            advanceFromShop: 0,
            heldForStaff: 0,
          }

        return {
          ...previous,

          [staffId]: {
            ...current,

            advanceFromShop:
              patch.advanceFromShop !== undefined
                ? Math.max(
                    0,
                    safeNumber(
                      patch.advanceFromShop
                    )
                  )
                : safeNumber(
                    current.advanceFromShop
                  ),

            heldForStaff:
              patch.heldForStaff !== undefined
                ? Math.max(
                    0,
                    safeNumber(
                      patch.heldForStaff
                    )
                  )
                : safeNumber(
                    current.heldForStaff
                  ),
          },
        }
      })
    },
    []
  )

  const expenseTotal = useMemo(() => {
    return expenses.reduce(
      (total, expense) => {
        return (
          total +
          safeNumber(expense?.amount)
        )
      },
      0
    )
  }, [expenses])

  return (
    <ShopFinanceContext.Provider
      value={{
        expenses,
        staffMoney,
        addExpense,
        setStaffBalance,
        expenseTotal,
        hydrated,
      }}
    >
      {children}
    </ShopFinanceContext.Provider>
  )
}

export function useShopFinance() {
  const context =
    useContext(ShopFinanceContext)

  if (!context) {
    throw new Error(
      "useShopFinance must be used within ShopFinanceProvider"
    )
  }

  return context
}

