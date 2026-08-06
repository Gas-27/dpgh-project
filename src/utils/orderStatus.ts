export type OrderStatusSource = {
  status?: string | null;
  order_status?: string | null;
  fulfillment_status?: string | null;
};

export function normalizeOrderStatus(order: OrderStatusSource): string {
  const values = [order.status, order.order_status, order.fulfillment_status]
    .map((value) => String(value || "").trim().toLowerCase().replace(/_/g, "-"))
    .filter(Boolean);

  if (values.includes("refunded")) return "refunded";
  if (values.includes("failed")) return "failed";
  if (values.includes("delivered") || values.includes("completed")) return "delivered";
  if (values.includes("in-queue") || values.includes("queued") || values.includes("queue")) return "in-queue";
  if (values.includes("processing")) return "processing";
  if (values.includes("waiting")) return "waiting";
  if (values.includes("paid")) return "processing";
  return values[0] || "pending";
}

export function orderStatusLabel(order: OrderStatusSource): string {
  const status = normalizeOrderStatus(order);
  return status === "in-queue"
    ? "In Queue"
    : status.charAt(0).toUpperCase() + status.slice(1);
}
