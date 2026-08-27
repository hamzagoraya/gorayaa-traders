"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Printer, Truck, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function InvoicePage() {
  const params = useParams<{ orderId: string }>()
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadOrder() {
      try {
        setLoading(true)
        const res = await fetch(`/api/orders/${params.orderId}`)
        const data = await res.json()

        if (!res.ok || !data.ok) {
          setError(data.error || "Failed to load invoice")
          return
        }

        setOrder(data.order)
      } catch (err) {
        setError("Failed to load invoice")
      } finally {
        setLoading(false)
      }
    }

    if (params.orderId) {
      loadOrder()
    }
  }, [params.orderId])

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading invoice...</div>
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-lg rounded-3xl">
          <CardContent className="py-12 text-center space-y-4">
            <Receipt className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="text-lg font-semibold">{error || "Invoice not found"}</p>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/track">Back to tracking</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Button asChild variant="outline" className="rounded-full gap-2">
            <Link href={order.trackingHref}>
              <ArrowLeft className="h-4 w-4" />
              Back to tracking
            </Link>
          </Button>
          <Button className="rounded-full gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print invoice
          </Button>
        </div>

        <Card className="rounded-3xl border">
          <CardHeader className="border-b bg-secondary/20">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="text-3xl font-black">Goraya Traders Invoice</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">Fertilizer, crop supplies, and farm support orders</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Invoice No.</p>
                <p className="font-mono text-lg font-bold">{order.id}</p>
                <Badge className="mt-2 rounded-full uppercase">{order.status}</Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-8 p-6 sm:p-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Bill To</p>
                <p className="mt-2 text-lg font-bold">{order.customerName}</p>
                <p className="text-sm text-muted-foreground">{order.customerPhone || "No phone"}</p>
                <p className="text-sm text-muted-foreground">{order.customerAddress || "No address provided"}</p>
              </div>
              <div className="md:text-right">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Order Details</p>
                <p className="mt-2 text-sm">Created: {new Date(order.createdAt).toLocaleString()}</p>
                <p className="text-sm">Tracking code: <span className="font-mono font-bold">{order.trackingCode}</span></p>
                <p className="text-sm">Payment: {order.paymentMethod}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/20">
                  <tr>
                    <th className="px-4 py-3 text-left">Item</th>
                    <th className="px-4 py-3 text-left">Qty</th>
                    <th className="px-4 py-3 text-left">Rate</th>
                    <th className="px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item: any) => (
                    <tr key={item.productId} className="border-t">
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3">{item.quantity}</td>
                      <td className="px-4 py-3">Rs. {item.unitPrice.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-semibold">Rs. {item.lineTotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="w-full max-w-sm rounded-2xl border bg-secondary/10 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>Rs. {order.total.toLocaleString()}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-lg font-black">
                  <span>Grand Total</span>
                  <span>Rs. {order.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Truck className="h-4 w-4" />
                Delivery Tracking
              </div>
              <p className="mt-2">Use tracking code <span className="font-mono font-bold">{order.trackingCode}</span> on the tracking page to follow shipment progress.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
