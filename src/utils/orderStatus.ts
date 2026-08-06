export type OrderStatusSource = {
  status?: string | null;
  order_status?: string | null;
  fulfillment_status?: string | null;
};

export function normalizeOrderStatus(order: OrderStatusSource): string {
  const deliveryValues = [order.order_status, order.fulfillment_status]
    .map((value) => String(value || "").trim().toLowerCase().replace(/_/g, "-"))
    .filter((value) => value && value !== "unknown" && value !== "null" && value !== "undefined");
  const paymentStatus = String(order.status || "").trim().toLowerCase().replace(/_/g, "-");

  if (deliveryValues.includes("refunded") || paymentStatus === "refunded") return "refunded";
  if (deliveryValues.includes("failed") || paymentStatus === "failed") return "failed";
  if (deliveryValues.includes("delivered") || deliveryValues.includes("completed")) return "delivered";
  if (deliveryValues.includes("in-queue") || deliveryValues.includes("queued") || deliveryValues.includes("queue")) return "in-queue";
  if (deliveryValues.includes("processing")) return "processing";
  if (deliveryValues.includes("waiting")) return "waiting";
  if (deliveryValues.includes("pending")) return "pending";
  if (paymentStatus === "paid" || paymentStatus === "processing") return "processing";
  // A completed payment with no usable delivery status is received but waiting
  // for the fulfillment worker; never expose the internal "unknown" value.
  if (paymentStatus === "completed" || paymentStatus === "success") return "in-queue";
  return "pending";
}

export function orderStatusLabel(order: OrderStatusSource): string {
  const status = normalizeOrderStatus(order);
  return status === "in-queue"
    ? "In Queue"
    : status.charAt(0).toUpperCase() + status.slice(1);
}
