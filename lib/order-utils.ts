export const ORDER_STATUSES = [
  "pending",
  "approved",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && ORDER_STATUSES.includes(value as OrderStatus)
}

export function normalizeOrderItem(item: any, index: number) {
  const productId = String(item?.productId || item?.product?.id || item?.id || `item-${index}`)
  const quantity = Number(item?.quantity) || 0
  const unitPrice =
    Number(item?.unitPrice) ||
    Number(item?.product?.price) ||
    Number(item?.price) ||
    0

  return {
    productId,
    name: String(item?.name || item?.product?.name || "Product"),
    quantity,
    unitPrice,
    lineTotal: Number(item?.lineTotal) || unitPrice * quantity,
  }
}

export function normalizeOrder(order: any) {
  const items = Array.isArray(order?.items)
    ? order.items.map((item: any, index: number) => normalizeOrderItem(item, index))
    : []

  const status = isOrderStatus(order?.status) ? order.status : "pending"
  const id = String(order?.id || order?._id || `order-${Date.now()}`)

  return {
    ...order,
    id,
    _id: order?._id || id,
    items,
    total:
      Number(order?.total) ||
      items.reduce((sum: number, item: { lineTotal: number }) => sum + item.lineTotal, 0),
    paymentMethod: String(order?.paymentMethod || "cod"),
    paymentScreenshot: order?.paymentScreenshot || null,
    transactionId: order?.transactionId || null,
    trackingCode: String(order?.trackingCode || `GT-${id.slice(-6).toUpperCase()}`),
    status,
    trackingHref: `/track?query=${encodeURIComponent(String(order?.trackingCode || `GT-${id.slice(-6).toUpperCase()}`))}`,
    createdAt: order?.createdAt || new Date().toISOString(),
    shippedAt: order?.shippedAt || null,
    deliveredAt: order?.deliveredAt || null,
    completedAt: order?.completedAt || null,
  }
}
