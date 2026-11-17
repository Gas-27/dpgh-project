// Maps storefront tab ids (as used by StorefrontSectionCards) to their URL path segment.
export const SECTION_SLUGS: Record<string, string> = {
  data: "cheap-data",
  subscription: "subscription",
  products: "marketplace",
  "social-boost": "social-boost",
  afa: "afa-registration",
  services: "services",
  agent: "become-agent",
  sms: "bulk-sms",
  instant: "airtime-data",
  bulk: "bulk-orders",
};

const SLUG_TO_SECTION: Record<string, string> = Object.fromEntries(
  Object.entries(SECTION_SLUGS).map(([id, slug]) => [slug, id]),
);

// "become-agent" only exists as a tab URL on the subagent store.
export const STOREFRONT_SECTION_PATHS = Object.entries(SECTION_SLUGS)
  .filter(([id]) => id !== "agent")
  .map(([, slug]) => slug);
export const SUBAGENT_SECTION_PATHS = Object.values(SECTION_SLUGS);

const isCustomDomainPath = (pathname: string) => pathname.startsWith("/__custom/");

const pathSegments = (pathname: string) => pathname.split("/").filter(Boolean);

interface SectionUrlOptions {
  // Store names that appear as a path segment and must never be mistaken for a tab slug.
  reserved?: Array<string | undefined>;
  allowAgent?: boolean;
}

const normalizeReserved = (reserved: SectionUrlOptions["reserved"]) =>
  (reserved ?? []).filter(Boolean).map((value) => String(value).toLowerCase());

/** Tab id requested by the current URL (e.g. "/cheap-data" -> "data"), or null. */
export function readSectionFromUrl({ reserved, allowAgent = false }: SectionUrlOptions = {}): string | null {
  const { pathname } = window.location;
  const segments = pathSegments(pathname);
  const last = segments[segments.length - 1]?.toLowerCase();
  if (!last || normalizeReserved(reserved).includes(last)) return null;
  const id = SLUG_TO_SECTION[last];
  if (!id) return null;
  if (id === "agent" && (!allowAgent || isCustomDomainPath(pathname))) return null;
  return id;
}

/** Updates the address bar for the selected tab without reloading or touching the router. */
export function writeSectionToUrl(id: string, { reserved, allowAgent = false }: SectionUrlOptions = {}) {
  const slug = SECTION_SLUGS[id];
  if (!slug) return;

  const { pathname, search, hash } = window.location;
  if (id === "agent" && (!allowAgent || isCustomDomainPath(pathname))) return;

  let segments = pathSegments(pathname);
  if (segments.includes("gamehub")) return;

  if (isCustomDomainPath(pathname)) {
    // Custom domains hide the internal /__custom/... prefix, so keep the public URL clean.
    segments = [];
  } else {
    const last = segments[segments.length - 1]?.toLowerCase();
    if (last && SLUG_TO_SECTION[last] && !normalizeReserved(reserved).includes(last)) segments.pop();
  }

  const next = `/${[...segments, slug].join("/")}${search}${hash}`;
  if (next !== `${pathname}${search}${hash}`) {
    window.history.replaceState(window.history.state, "", next);
  }
}

/** Tab slug at the root of a custom domain (e.g. "/cheap-data"), so the resolver can keep it. */
export function readCustomDomainSlug(): string | null {
  const segments = pathSegments(window.location.pathname);
  if (segments.length !== 1) return null;
  const slug = segments[0].toLowerCase();
  const id = SLUG_TO_SECTION[slug];
  return id && id !== "agent" ? slug : null;
}
