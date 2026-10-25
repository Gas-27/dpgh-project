const PROHIBITED_PATTERN = /\b(cheap[\s-]+data|data|airtime|subscriptions?|afa[\s-]+registration|afa|bulk[\s-]+sms|ussd|netflix|social[\s-]+boost)\b/i;

export const PROHIBITED_TERMS_LABEL = "data, cheap data, airtime, subscription, AFA, AFA registration, bulk SMS, USSD, Netflix, social boost";

export const REPORT_REASONS = [
  "Offers a service this site already provides",
  "Scam or fraud",
  "Fake or misleading product",
  "Prohibited or illegal item",
  "Inappropriate content",
  "Other",
] as const;

export function findProhibitedTerm(...texts: Array<string | null | undefined>): string | null {
  const match = texts.filter(Boolean).join(" ").match(PROHIBITED_PATTERN);
  return match ? match[0].trim() : null;
}

export function prohibitedTermFromError(message: string | null | undefined): string | null {
  const match = String(message || "").match(/PROHIBITED_SERVICE:(.+)/);
  return match ? match[1].trim() : null;
}
