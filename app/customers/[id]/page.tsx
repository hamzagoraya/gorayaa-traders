"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, MapPin, Phone, Receipt, ShoppingCart, User } from "lucide-react"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export default function CustomerDetailsPage() {
  const params = useParams<{ id: string }>()
  const [customer, setCustomer] = useState<any>(null)
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCustomer() {
      try {
        setLoading(true)
        setError(null)

        const customersRes = await fetch("/api/customers")
        const customersData = await customersRes.json()
        const selectedCustomer = Array.isArray(customersData)
          ? customersData.find((entry: any) => entry.id === params.id)
          : null

        if (!selectedCustomer) {
          setError("Customer not found.")
          return
        }

        setCustomer(selectedCustomer)

        const [ledgerRes, ordersRes] = await Promise.all([
          fetch("/api/ledger?bookId=sales"),
          fetch(`/api/orders/track?query=${encodeURIComponent(selectedCustomer.phone)}`),
        ])

        const ledgerData = ledgerRes.ok ? await ledgerRes.json() : []
        const ordersData = ordersRes.ok ? await ordersRes.json() : []

        setLedgerEntries(
          Array.isArray(ledgerData)
            ? ledgerData.filter((entry: any) => entry.customerId === selectedCustomer.id)
            : []
        )
        setOrders(Array.isArray(ordersData) ? ordersData : [])
      } catch (err) {
        setError("Failed to load customer details.")
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      loadCustomer()
    }
  }, [params.id])

  return (
    <div className="min-h-screen bg-background">
      <Header cartCount={0} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/customers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="h-4 w-4" />
          Back to customers
        </Link>

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">Loading customer details...</div>
        ) : error || !customer ? (
          <Card className="rounded-3xl">
            <CardContent className="py-16 text-center space-y-4">
              <p className="text-lg font-semibold">{error || "Customer not found."}</p>
              <Button asChild variant="outline" className="rounded-full">
                <Link href="/customers">Back to customers</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            <Card className="rounded-3xl border">
              <CardContent className="p-6 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                    <User className="h-7 w-7" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h1 className="text-3xl font-black">{customer.name}</h1>
                      <Badge className="rounded-full">Customer</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {customer.phone}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {customer.address || "No address"}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border bg-secondary/20 px-6 py-4 text-center">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Current Balance</p>
                  <p className="mt-1 text-2xl font-black">Rs. {Math.abs(customer.balance || 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">
                    {(customer.balance || 0) > 0 ? "Receivable" : (customer.balance || 0) < 0 ? "Advance" : "Settled"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-8 lg:grid-cols-2">
              <Card className="rounded-3xl border">
                <CardHeader className="border-b bg-secondary/20">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Receipt className="h-5 w-5" />
                    Sales Ledger
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {ledgerEntries.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">No ledger entries found for this customer.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledgerEntries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>{entry.date}</TableCell>
                            <TableCell>{entry.description}</TableCell>
                            <TableCell className="text-right">{entry.debit ? `Rs. ${entry.debit.toLocaleString()}` : "-"}</TableCell>
                            <TableCell className="text-right">{entry.credit ? `Rs. ${entry.credit.toLocaleString()}` : "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-3xl border">
                <CardHeader className="border-b bg-secondary/20">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <ShoppingCart className="h-5 w-5" />
                    Order History
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-6">
                  {orders.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No orders found for this customer.</div>
                  ) : (
                    orders.map((order) => (
                      <div key={order.id} className="rounded-2xl border p-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold">{order.trackingCode}</p>
                            <p className="text-xs text-muted-foreground">{new Date(order.createdAt).toLocaleString()}</p>
                          </div>
                          <Badge variant="outline" className="rounded-full uppercase">{order.status}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="outline" className="rounded-full">
                            <Link href={order.trackingHref}>Tracking</Link>
                          </Button>
                          <Button asChild size="sm" className="rounded-full">
                            <Link href={`/invoice/${order.id}`}>Invoice</Link>
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
