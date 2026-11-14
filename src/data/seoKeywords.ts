export type SeoVertical = "telecom" | "agents" | "subscriptions" | "checkers" | "messaging";

export interface SeoKeywordGroup {
  vertical: SeoVertical;
  primary: string[];
  longTail: string[];
  routes: string[];
}

/**
 * Ghana-focused search language used to inform page titles, copy, FAQs and
 * internal links. These are targeting inputs, not instructions to repeat
 * keywords unnaturally on a page.
 */
export const seoKeywordGroups: SeoKeywordGroup[] = [
  {
    vertical: "telecom",
    primary: [
      "data", "bundles", "MTN", "Telecel", "Vodafone", "AirtelTigo", "AT",
      "cheap data", "cheap bundles", "student data", "non expiry data",
      "4G data", "5G data", "night bundle", "unlimited data Ghana",
      "buy data online Ghana", "fast data top up", "affordable data Ghana",
      "affordable bundles", "data sites", "bundle sites", "data shop Ghana",
    ],
    longTail: [
      "where to buy cheap data in Ghana", "buy MTN data online in Ghana",
      "buy Telecel data online Ghana", "best data bundles in Ghana today",
      "cheap data bundle for students in Ghana", "data bundle for remote workers Ghana",
      "non expiry data bundle Ghana", "monthly data bundles Ghana",
      "weekly data bundles Ghana", "daily data bundles Ghana",
      "how to buy a data bundle with Mobile Money", "I need data urgently Ghana",
      "want data delivered instantly Ghana", "best site to buy data bundles Ghana",
      "compare MTN and Telecel data bundles", "cheap internet bundles for phones Ghana",
      "how much data do I need in Ghana", "data bundle prices in Ghana",
      "data top up Ghana", "mobile internet Ghana", "data for hotspot Ghana",
    ],
    routes: ["/bundles/:provider", "/cheap-data-bundles-ghana", "/mtn-data-bundles", "/telecel-data-bundles", "/airteltigo-data-bundles"],
  },
  {
    vertical: "agents",
    primary: [
      "AFA", "AFA registration", "AFA bundle", "register AFA", "data reseller",
      "data agent", "subagent", "data wholesale", "USSD data agent",
      "earn money reselling data Ghana", "DataPlug agent", "data seller Ghana",
      "data vending business", "bulk data Ghana", "resell data online",
    ],
    longTail: [
      "how to register AFA in Ghana", "AFA registration requirements Ghana",
      "how to become a data agent in Ghana", "start a data reselling business Ghana",
      "how to buy wholesale data bundles Ghana", "best data reseller platform Ghana",
      "how to sell MTN data Ghana", "how to sell Telecel data Ghana",
      "data agent commission Ghana", "data vending business for beginners Ghana",
      "become a sub agent for data bundles", "how to make money selling data Ghana",
      "cheap wholesale data for agents Ghana", "data reseller dashboard Ghana",
    ],
    routes: ["/afa-registration", "/become-agent", "/become-sub-agent", "/data-reseller-agent-ghana"],
  },
  {
    vertical: "subscriptions",
    primary: [
      "Netflix", "Netflix Ghana", "iCloud", "iCloud storage Ghana", "YouTube Premium",
      "Spotify", "Apple Music", "DStv", "GOtv", "Startimes", "Showmax", "Prime Video",
      "digital subscriptions Ghana", "cloud storage Ghana", "cheap Netflix account Ghana",
    ],
    longTail: [
      "how to pay for Netflix from Ghana", "Netflix subscription Ghana payment",
      "legal streaming subscriptions in Ghana", "YouTube Premium Ghana price and payment",
      "Spotify Ghana subscription guide", "iCloud storage payment Ghana",
      "best streaming subscription for Ghana", "how to cancel a digital subscription Ghana",
      "how much data does Netflix use Ghana", "how to manage subscriptions in Ghana",
      "cloud storage for students Ghana", "Microsoft 365 subscription Ghana",
      "Canva subscription payment Ghana", "Showmax Ghana subscription guide",
    ],
    routes: ["/subscriptions/:service", "/subscriptions/netflix", "/subscriptions/icloud", "/subscriptions/youtube-premium"],
  },
  {
    vertical: "checkers",
    primary: [
      "WASSCE", "BECE", "result checker", "WAEC checker", "buy result checker card",
      "WASSCE result checker Ghana", "BECE result checker online", "placement checker", "CSSPS",
    ],
    longTail: [
      "how to check WASSCE results in Ghana", "where to buy a WASSCE result checker",
      "how to check BECE results online Ghana", "WAEC result checker card Ghana",
      "CSSPS placement checker Ghana", "what to do when a result checker fails",
      "safe way to buy a result checker online Ghana", "WASSCE results checker support Ghana",
    ],
    routes: ["/checkers/:type", "/wassce-results-checker", "/bece-results-checker"],
  },
  {
    vertical: "messaging",
    primary: [
      "SMS", "bulk SMS", "bulk SMS Ghana", "SMS gateway", "SMS API", "sender ID Ghana",
      "cheap bulk SMS", "transactional SMS", "business messaging Ghana", "OTP SMS Ghana",
    ],
    longTail: [
      "best bulk SMS service in Ghana", "bulk SMS pricing Ghana", "SMS API for Ghana businesses",
      "how to send bulk SMS in Ghana", "sender ID registration Ghana", "transactional SMS Ghana",
      "OTP delivery service Ghana", "SMS gateway for websites Ghana", "affordable bulk messaging Ghana",
      "bulk SMS for schools and churches Ghana", "SMS marketing for small businesses Ghana",
    ],
    routes: ["/bulk-sms", "/data-api-ghana"],
  },
];

export const allSeoKeywords = Array.from(
  new Set(seoKeywordGroups.flatMap((group) => [...group.primary, ...group.longTail])),
);

export const defaultSeoKeywords = [
  "data bundles Ghana", "cheap data Ghana", "buy data online Ghana", "affordable bundles Ghana",
  "MTN data", "Telecel data", "data sites Ghana", "bundle sites Ghana", "Mobile Money data",
];

export function keywordsForVertical(vertical: SeoVertical) {
  const group = seoKeywordGroups.find((item) => item.vertical === vertical);
  return group ? Array.from(new Set([...group.primary, ...group.longTail])) : defaultSeoKeywords;
}
