export type OrderStatusSource = {
  status?: string | null;
  order_status?: string | null;
  fulfillment_status?: string | null;
  network?: string | null;
};

const normalize = (value?: string | null) => String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");

/**
 * MTN Special and Telecel Special: fulfillment_status = "completed" only means the
 * order was handed to the supplier, and status = "paid" only means payment cleared.
 * Neither means delivered; the backend moves order_status from the supplier.
 */
export function isSupplierTrackedNetwork(network?: string | null): boolean {
  const value = normalize(network).replace(/-/g, "_");
  return value === "mtn_special" || value === "telecel_special";
}

function normalizeSupplierTrackedStatus(order: OrderStatusSource): string {
  const orderStatus = normalize(order.order_status);
  const paymentStatus = normalize(order.status);

  if (orderStatus === "refunded" || paymentStatus === "refunded") return "refunded";
  if (orderStatus === "delivered") return "delivered";
  if (orderStatus === "failed" || orderStatus === "failure" || orderStatus === "cancelled" || orderStatus === "canceled") return "failed";
  if (paymentStatus === "failed") return "failed";
  if (orderStatus === "processing") return "processing";
  // "placed" (or an empty order_status on a paid order) is received and queued.
  return "pending";
}

export function normalizeOrderStatus(order: OrderStatusSource): string {
  if (isSupplierTrackedNetwork(order.network)) return normalizeSupplierTrackedStatus(order);

  const orderStatus = normalize(order.order_status);
  const fulfillmentStatus = normalize(order.fulfillment_status);
  const paymentStatus = normalize(order.status);
  const validDeliveryStatuses = new Set(["refunded", "failed", "delivered", "completed", "in-queue", "queued", "queue", "processing", "waiting", "pending", "placed"]);

  // order_status is the canonical status used by Package tracking. Only fall back
  // to fulfillment_status when order_status is absent or unusable, preventing a
  // stale fulfillment value from making dashboards disagree with Package tracking.
  const deliveryStatus = validDeliveryStatuses.has(orderStatus)
    ? orderStatus
    : validDeliveryStatuses.has(fulfillmentStatus)
      ? fulfillmentStatus
      : "";

  if (deliveryStatus === "refunded" || paymentStatus === "refunded") return "refunded";
  if (deliveryStatus === "failed" || paymentStatus === "failed") return "failed";
  if (deliveryStatus === "delivered" || deliveryStatus === "completed") return "delivered";
  if (deliveryStatus === "in-queue" || deliveryStatus === "queued" || deliveryStatus === "queue") return "in-queue";
  if (deliveryStatus === "processing") return "processing";
  if (deliveryStatus === "waiting") return "waiting";
  // An explicit "placed" must never fall through to a later fulfillment value.
  if (deliveryStatus === "pending" || deliveryStatus === "placed") return "pending";
  if (paymentStatus === "paid" || paymentStatus === "processing") return "processing";
  // A completed payment with no usable delivery status is received but waiting
  // for the fulfillment worker; never expose the internal "unknown" value.
  if (paymentStatus === "completed" || paymentStatus === "success") return "in-queue";
  return "pending";
}

export function orderStatusLabel(order: OrderStatusSource): string {
  const status = normalizeOrderStatus(order);
  if (status === "pending" && isSupplierTrackedNetwork(order.network)) return "Processing";
  return status === "in-queue"
    ? "Number Verifying"
    : status.charAt(0).toUpperCase() + status.slice(1);
}
