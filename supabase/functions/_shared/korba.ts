/**
 * Shared Korba helpers for Supabase Edge Functions.
 *
 * - Picks the correct Korba host (production by default).
 * - Signs every request with HMAC-SHA256.
 * - Retries once on the other host when Korba says "Invalid Client Key",
 *   which happens when KORBA_ENV does not match the type of key in use.
 */

const SANDBOX_BASE_URL = "https://testxchange.korba365.com/api/v1.0";
const PRODUCTION_BASE_URL = "https://xchange.korba365.com/api/v1.0";

const SANDBOX_ENV_NAMES = ["sandbox", "test", "testing", "staging", "dev", "development"];

export type KorbaPayload = Record<string, string | number | boolean | null | undefined>;

type KorbaEnvelope = { success?: boolean; error_code?: number; error_message?: string; detail?: string; message?: string };

type KorbaError = Error & { details?: unknown };

/** Production unless KORBA_ENV explicitly names a sandbox/test environment. */
export function korbaBaseUrl() {
  const environment = String(Deno.env.get("KORBA_ENV") || "").trim().toLowerCase();
  return SANDBOX_ENV_NAMES.includes(environment) ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL;
}

export function callbackUrl() {
  return Deno.env.get("KORBA_CALLBACK_URL") || `${Deno.env.get("SUPABASE_URL")}/functions/v1/korba-callback`;
}

/** Korba signs the sorted `key=value` pairs joined by `&`. */
function canonicalize(payload: KorbaPayload) {
  return Object.entries(payload)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

async function hmacSha256(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readCredentials() {
  const clientId = Deno.env.get("KORBA_CLIENT_ID")?.trim();
  const clientKey = Deno.env.get("KORBA_CLIENT_KEY")?.trim();
  const secretKey = Deno.env.get("KORBA_SECRET_KEY")?.trim();
  if (!clientId || !clientKey || !secretKey) throw new Error("Korba credentials are not configured");
  const numericClientId = Number(clientId);
  return { clientId: Number.isFinite(numericClientId) ? numericClientId : clientId, clientKey, secretKey };
}

async function send(baseUrl: string, path: string, payload: KorbaPayload) {
  const { clientId, clientKey, secretKey } = readCredentials();
  const body = { ...payload, client_id: clientId };
  const signature = await hmacSha256(secretKey, canonicalize(body));
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `HMAC ${clientKey}:${signature}` },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(raw); } catch { parsed = { raw_response: raw }; }
  return { response, raw, parsed };
}

function isWrongHostError(status: number, parsed: Record<string, unknown>) {
  return status === 401 && /invalid client key/i.test(String(parsed.detail || parsed.error_message || parsed.message || ""));
}

export async function korbaRequest<T>(path: string, payload: KorbaPayload): Promise<T> {
  const requestId = crypto.randomUUID();
  const primary = korbaBaseUrl();
  const secondary = primary === PRODUCTION_BASE_URL ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL;

  let baseUrl = primary;
  let attempt = await send(baseUrl, path, payload);
  if (isWrongHostError(attempt.response.status, attempt.parsed)) {
    console.warn("[korba] Invalid Client Key on primary host, retrying other host", JSON.stringify({ request_id: requestId, path, primary }));
    baseUrl = secondary;
    attempt = await send(baseUrl, path, payload);
  }

  const { response, raw, parsed } = attempt;
  console.log("[korba-response]", JSON.stringify({ request_id: requestId, path, host: baseUrl, status: response.status, raw_body: raw.slice(0, 2000) }));

  if (!response.ok) {
    const envelope = parsed as KorbaEnvelope;
    const message = envelope.error_message || envelope.detail || envelope.message || `Korba request failed (${response.status})`;
    const error = new Error(message) as KorbaError;
    error.details = { request_id: requestId, status: response.status, raw_body: raw, parsed_body: parsed };
    throw error;
  }
  return parsed as T;
}

export function userMessage(errorCode?: number) {
  const messages: Record<number, string> = {
    400: "Enter a valid customer number.",
    401: "A transaction ID is required.",
    402: "Enter an amount.",
    405: "This network or service is not available.",
    407: "This request was already submitted.",
    409: "Enter a valid amount.",
    410: "Enter a valid Ghana phone number.",
  };
  return (errorCode && messages[errorCode]) || "The request could not be processed. Please try again.";
}

export function providerError(result: unknown) {
  const value = (result || {}) as Record<string, unknown>;
  return value.error_message || value.detail || value.message || (value.results as Record<string, unknown> | undefined)?.message;
}
