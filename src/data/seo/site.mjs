// Shared by the React app (Vite) and the build-time prerender / sitemap scripts (Node).
// Keep this file plain ESM JavaScript so both can import it.

export const SITE = {
  origin: "https://www.justbuygh.com",
  name: "JustBuy GH",
  legalName: "JustBuy GH",
  locale: "en_GH",
  titleSuffix: " | JustBuy GH",
  ussd: "*365*778#",
  defaultOgImage: "https://www.justbuygh.com/api/og?page=home",
  logo: "https://www.justbuygh.com/justbuygh-icon.png",
  // TODO(George): add the real JustBuy GH social profile URLs here (Facebook, Instagram,
  // TikTok, X, WhatsApp channel, YouTube). They are used as Organization "sameAs" in JSON-LD.
  // Leave empty until they exist; empty arrays are skipped, never invented.
  sameAs: [],
  hosts: ["justbuygh.com", "www.justbuygh.com"],
};

export const NETWORKS = [
  { key: "mtn", label: "MTN" },
  { key: "mtn_express", label: "MTN Express" },
  { key: "telecel", label: "Telecel" },
  { key: "airteltigo", label: "AirtelTigo" },
];

export function absoluteUrl(path = "/") {
  const clean = path === "/" ? "/" : path.replace(/\/+$/, "");
  return `${SITE.origin}${clean}`;
}

export function withSuffix(title) {
  return title.includes("JustBuy GH") ? title : `${title}${SITE.titleSuffix}`;
}
