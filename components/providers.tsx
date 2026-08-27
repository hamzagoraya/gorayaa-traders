"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, type ReactNode } from "react"
import { AuthProvider, useAuth } from "@/context/auth-context"
import { CartProvider } from "@/context/cart-context"
import { ProductsProvider } from "@/context/products-context"
import { ShopFinanceProvider } from "@/context/shop-finance-context"
import { ShopOperationsProvider } from "@/context/shop-operations-context"
import { CropRatesProvider } from "@/context/crop-rates-context"
import { Toaster } from "@/components/ui/sonner"

function AuthGate({ children }: { children: ReactNode }) {
  const { currentUser, currentCustomer, isAuthReady, hasPermission } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const staffProtected = ["/inventory", "/shop-finance", "/ledger", "/customers"]
  const customerProtected: string[] = []
  const restrictedRoutes = [
    { prefix: "/inventory", allowed: !!currentUser && hasPermission("canManageProducts") },
    { prefix: "/shop-finance", allowed: !!currentUser && hasPermission("canManageShopFinance") },
    { prefix: "/ledger", allowed: !!currentUser && hasPermission("canOpenLedgers") },
    { prefix: "/customers", allowed: !!currentUser && hasPermission("canViewCustomers") },
    { prefix: "/admin", allowed: !!currentUser && currentUser.role !== "loader" },
    { prefix: "/loader", allowed: !!currentUser && currentUser.role === "loader" },
  ]

  const isStaffRoute = staffProtected.some(route => pathname === route || pathname.startsWith(route + "/"))
  const isCustomerRoute = customerProtected.some(route => pathname === route || pathname.startsWith(route + "/"))
  const blockedRoute = restrictedRoutes.find(({ prefix, allowed }) => {
    const matches = pathname === prefix || pathname.startsWith(prefix + "/")
    return matches && !allowed
  })

  useEffect(() => {
    if (!isAuthReady) return

    if (isStaffRoute && !currentUser) {
      router.replace("/staff")
    } else if (blockedRoute && currentUser) {
      router.replace(currentUser.role === "loader" ? "/loader" : "/admin")
    } else if (isCustomerRoute && !currentCustomer && !currentUser) {
      router.replace("/login")
    }
  }, [blockedRoute, currentCustomer, currentUser, isAuthReady, isCustomerRoute, isStaffRoute, pathname, router])

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Loading portal...</p>
      </div>
    )
  }

  if (
    (isStaffRoute && !currentUser) ||
    (!!blockedRoute && !!currentUser) ||
    (isCustomerRoute && !currentCustomer && !currentUser)
  ) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Redirecting to login portal...</p>
      </div>
    )
  }

  return <>{children}</>
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>
        <ShopFinanceProvider>
          <ProductsProvider>
            <CropRatesProvider>
              <ShopOperationsProvider>
                <CartProvider>
                  {children}
                  <Toaster richColors closeButton position="top-center" />
                </CartProvider>
              </ShopOperationsProvider>
            </CropRatesProvider>
          </ProductsProvider>
        </ShopFinanceProvider>
      </AuthGate>
    </AuthProvider>
  )
}
