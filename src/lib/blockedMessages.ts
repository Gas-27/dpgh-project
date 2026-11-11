export const BLOCKED_NUMBER_MESSAGE =
  "This number has been associated with fraudulent activity across our networks and cannot make purchases on our system.";
export const BANNED_ACCOUNT_MESSAGE =
  "This account has been suspended because it is linked to suspicious or fraudulent activity on site. Please contact support if you believe this is a mistake.";
export const WALLET_FROZEN_MESSAGE = "This wallet has been frozen. Please contact support.";

const KNOWN_MESSAGES = new Set([BLOCKED_NUMBER_MESSAGE, BANNED_ACCOUNT_MESSAGE, WALLET_FROZEN_MESSAGE]);

const BLOCKED_PATTERN = /fraudulent activity|blocked from using this service|NUMBER_BLOCKED/i;
const WALLET_HOLD_PATTERN = /wallet is on hold/i;
const BANNED_PATTERN = /user is banned|\bbanned\b/i;

function toText(input: unknown): string {
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    const value = input as { message?: unknown; error?: unknown; code?: unknown };
    return [value.message, typeof value.error === "string" ? value.error : (value.error as { message?: unknown } | undefined)?.message, value.code]
      .filter((part): part is string => typeof part === "string")
      .join(" ");
  }
  return "";
}

/**
 * Returns a friendly replacement when the text is a blocked-number or frozen-wallet error,
 * otherwise null. Already-friendly messages are left untouched.
 */
export function getFriendlyBlockedMessage(input: unknown): string | null {
  const text = toText(input);
  if (!text || KNOWN_MESSAGES.has(text)) return null;
  if (BLOCKED_PATTERN.test(text)) return BLOCKED_NUMBER_MESSAGE;
  if (WALLET_HOLD_PATTERN.test(text)) return WALLET_FROZEN_MESSAGE;
  return null;
}

/** Login-specific: also maps Supabase "User is banned" errors. */
export function getFriendlyAuthMessage(input: unknown): string | null {
  const text = toText(input);
  if (!text || KNOWN_MESSAGES.has(text)) return null;
  if (BANNED_PATTERN.test(text)) return BANNED_ACCOUNT_MESSAGE;
  return getFriendlyBlockedMessage(input);
}

export function friendlyOr(input: unknown, fallback: string): string {
  return getFriendlyBlockedMessage(input) ?? fallback;
}
