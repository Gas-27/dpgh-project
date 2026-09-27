export type OrderStatusSource = {
  status?: string | null;
  order_status?: string | null;
  fulfillment_status?: string | null;
};

export function normalizeOrderStatus(order: OrderStatusSource): string {
  const normalize = (value?: string | null) => String(value || "").trim().toLowerCase().replace(/_/g, "-");
  const orderStatus = normalize(order.order_status);
  const fulfillmentStatus = normalize(order.fulfillment_status);
  const paymentStatus = normalize(order.status);
  const validDeliveryStatuses = new Set(["refunded", "failed", "delivered", "completed", "in-queue", "queued", "queue", "processing", "waiting", "pending"]);

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
  if (deliveryStatus === "pending") return "pending";
  if (paymentStatus === "paid" || paymentStatus === "processing") return "processing";
  // A completed payment with no usable delivery status is received but waiting
  // for the fulfillment worker; never expose the internal "unknown" value.
  if (paymentStatus === "completed" || paymentStatus === "success") return "in-queue";
  return "pending";
}

export function orderStatusLabel(order: OrderStatusSource): string {
  const status = normalizeOrderStatus(order);
  return status === "in-queue"
    ? "Number Verifying"
    : status.charAt(0).toUpperCase() + status.slice(1);
}

export function orderStatusMessage(order: OrderStatusSource): string {
  switch (normalizeOrderStatus(order)) {
    case "pending":
      return "Your order has been received and is waiting for payment confirmation.";
    case "processing":
      return "Your payment was successful. We are processing your order now.";
    case "in-queue":
      return "Your order has been received and your phone number is being verified.";
    case "waiting":
      return "Your order is waiting to be processed. Please check again shortly.";
    case "delivered":
      return "Your order was completed successfully. The bundle or service has been sent to your number.";
    case "failed":
      return "Your order could not be completed. If payment was deducted, the amount will be refunded to your wallet.";
    case "refunded":
      return "Your order was refunded successfully. The refunded amount has been returned to your wallet.";
    default:
      return "Your order has been received and is being processed.";
  }
}
