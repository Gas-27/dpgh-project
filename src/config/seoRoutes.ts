export const SITE_ORIGIN = "https://dataplug.store";

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
