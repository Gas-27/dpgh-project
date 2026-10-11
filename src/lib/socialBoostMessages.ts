export const SOCIAL_BOOST_DUPLICATE_NOTICE =
  "NOTICE: Another order for the same link and service is not permitted while an active Social Boost order is processing. Please wait for it to be completed before ordering again. If a duplicate order is created, the system will cancel one of the orders.";

export const getSocialBoostDeliveryMessage = (serviceName?: string | null) => {
  const normalized = String(serviceName ?? "").toLowerCase();
  if (normalized.includes("comment")) return "Your comments are on their way.";
  if (normalized.includes("reaction")) return "Your reactions are on their way.";
  if (normalized.includes("like")) return "Your likes are on their way.";
  if (normalized.includes("member")) return "Your members are on their way.";
  if (normalized.includes("view")) return "Your views are on their way.";
  if (normalized.includes("subscriber")) return "Your subscribers are on their way.";
  if (normalized.includes("follow")) return "Your followers are on their way.";
  return "Your order is on its way.";
};

export const isSocialBoostReference = (reference?: string | null) => String(reference ?? "").startsWith("SB_");

// Mirrors the paystack-webhook rule that derives the public order number from the payment reference.
export const socialBoostOrderNumberFromReference = (reference: string) => {
  const value = Number(String(reference).replace(/\D/g, "").slice(-9));
  return Number.isFinite(value) && value > 0 ? value : null;
};

// Stored services look like "123:Instagram Followers"; strip the provider id prefix.
export const socialBoostServiceLabel = (service?: string | null) => String(service ?? "").replace(/^\d+:/, "").trim();

const terminalStatuses = new Set(["completed", "complete", "canceled", "cancelled", "failed", "refunded", "partial"]);

export const isSocialBoostOrderActive = (order: { provider_status?: string | null; status?: string | null }) => {
  const providerStatus = String(order.provider_status ?? "").trim().toLowerCase();
  const status = String(order.status ?? "").trim().toLowerCase();
  if (terminalStatuses.has(providerStatus) || terminalStatuses.has(status)) return false;
  return true;
};

export const TRACK_ORDER_STORAGE_KEY = "social_boost_track_order";
export const TRACK_ORDER_EVENT = "social-boost-track-order";
