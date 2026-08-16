export const SITE_ORIGIN = "https://dataplug.store";

export type SeoBrand = "dataplug" | "datastores" | "agentsstore";

export function getSeoBrand(hostname = typeof window !== "undefined" ? window.location.hostname : "") : SeoBrand {
  const host = hostname.toLowerCase().split(":")[0];
  if (host === "agentsstore.shop" || host.endsWith(".agentsstore.shop")) return "agentsstore";
  if (host === "datastores.shop" || host.endsWith(".datastores.shop")) return "datastores";
  return "dataplug";
}

export function getSeoOrigin(hostname = typeof window !== "undefined" ? window.location.hostname : "") {
  if (!hostname) return SITE_ORIGIN;
  const host = hostname.toLowerCase().split(":")[0];
  return host === "localhost" || host === "127.0.0.1" ? SITE_ORIGIN : `https://${host}`;
}

export function getStorefrontSeo(hostname = typeof window !== "undefined" ? window.location.hostname : "") {
  const brand = getSeoBrand(hostname);
  if (brand === "agentsstore") return { siteName: "Agents Store", title: "Discover Digital Services from Independent Agents", description: "Explore trusted digital services, subscriptions, and tools offered by independent agents in one convenient marketplace.", keywords: ["agent marketplace", "digital services", "online subscriptions", "independent agents"] };
  if (brand === "datastores") return { siteName: "DataStores", title: "Digital Services and Agent Stores Online", description: "Browse digital services and storefronts from trusted agents, with simple access and convenient online purchasing.", keywords: ["digital services marketplace", "agent stores", "online services", "digital subscriptions"] };
  return { siteName: "DataPlug Store", title: "Buy Data Bundles and Digital Services Online", description: "Shop reliable data bundles, subscriptions, and digital services online with convenient access and secure checkout.", keywords: ["digital services Ghana", "data bundles", "online subscriptions", "digital marketplace"] };
}

export const PUBLIC_SEO_PATHS = [
  "/", "/packages", "/become-agent", "/blog", "/about", "/contact",
  "/mtn-data-bundles", "/telecel-data-bundles", "/airteltigo-data-bundles", "/cheap-data-bundles-ghana",
  "/data-reseller-agent-ghana", "/data-api-ghana", "/streaming-data-bundles-ghana", "/student-data-bundles-ghana",
  "/airtime-top-up-ghana", "/premium-subscription", "/data-agent-business-ghana", "/ussd-data-services-ghana",
  "/bece-results-checker", "/wassce-results-checker", "/buy-data-online-ghana", "/wholesale-data-bundles-ghana",
  "/internet-bundles-ghana", "/become-sub-agent", "/afa-bundle-ghana", "/data-bundle-prices-ghana",
  "/privacy-policy", "/terms", "/refund-policy", "/cookie-policy",
] as const;

const PRIVATE_PREFIXES = [
  "/user-dashboard", "/agent-dashboard", "/subagent-dashboard", "/sub-subagent-dashboard", "/dashboard",
  "/admin", "/admin-only", "/sub-admin", "/login", "/signup", "/reset-password", "/verify-email",
  "/auth/", "/api/", "/agent-registration-callback", "/subagent-registration", "/sub-subagent-registration",
  "/subagent-approval-payment", "/verify-subagent-payment", "/pending-approval", "/only-admin",
];

export function isPrivatePath(pathname: string) {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isKnownPublicPath(pathname: string) {
  return PUBLIC_SEO_PATHS.includes(pathname as (typeof PUBLIC_SEO_PATHS)[number]) ||
    pathname.startsWith("/blog/") || pathname.startsWith("/agent/");
}

export function shouldNoIndex(pathname: string, search = "") {
  return isPrivatePath(pathname) || pathname.startsWith("/agent/") || Boolean(search);
}

export function canonicalUrl(pathname: string) {
  return `${SITE_ORIGIN}${pathname === "/" ? "/" : pathname.replace(/\/$/, "")}`;
}
