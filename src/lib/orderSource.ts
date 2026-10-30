export type OrderSource = "dashboard" | "storefront" | "subagent" | "subsubagent" | "api";
export type OrderSourceFilterKey = "all" | OrderSource;

export const ORDER_SOURCE_LABELS: Record<OrderSourceFilterKey, string> = {
  all: "All Sources",
  dashboard: "Dashboard",
  storefront: "Store Front",
  subagent: "Subagents",
  subsubagent: "Sub-Subagents",
  api: "API",
};

interface SourceFields {
  source?: string | null;
  payment_method?: string | null;
  subagent_store_id?: string | null;
  sub_subagent_store_id?: string | null;
}

// Where an order came from, from the point of view of the person viewing it:
// - api: placed through the API (API wallet)
// - subsubagent / subagent: placed on a store that sits below the viewer
// - dashboard: bought by the viewer from their own dashboard (wallet or reward spin)
// - storefront: bought by a customer on the viewer's public store (Paystack / MoMo / free claim)
export function getOrderSource(order: SourceFields): OrderSource {
  const method = String(order.payment_method ?? "").toLowerCase();
  if (order.source === "api" || method === "api_wallet") return "api";
  if (order.sub_subagent_store_id) return "subsubagent";
  if (order.subagent_store_id) return "subagent";
  if (method === "wallet" || method === "spin_wheel") return "dashboard";
  return "storefront";
}
