const SANDBOX_BASE_URL = "https://testxchange.korba365.com/api/v1.0";
const PRODUCTION_BASE_URL = "https://xchange.korba365.com/api/v1.0";

export type KorbaPayload = Record<string, string | number | boolean | null | undefined>;

export function korbaBaseUrl() {
  const environment = String(Deno.env.get("KORBA_ENV") || "sandbox").trim().toLowerCase();
  return environment === "production" || environment === "live" ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;
}

export function callbackUrl() {
  return Deno.env.get("KORBA_CALLBACK_URL") || `${Deno.env.get("SUPABASE_URL")}/functions/v1/korba-callback`;
}

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

export async function korbaRequest<T>(path: string, payload: KorbaPayload): Promise<T> {
  const clientId = Deno.env.get("KORBA_CLIENT_ID")?.trim();
  const clientKey = Deno.env.get("KORBA_CLIENT_KEY")?.trim();
  const secretKey = Deno.env.get("KORBA_SECRET_KEY")?.trim();
  if (!clientId || !clientKey || !secretKey) throw new Error("Korba credentials are not configured");

  const requestId = crypto.randomUUID();
  const numericClientId = Number(clientId);
  const body = { ...payload, client_id: Number.isFinite(numericClientId) ? numericClientId : clientId };
  const response = await fetch(`${korbaBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `HMAC ${clientKey}:${await hmacSha256(secretKey, canonicalize(body))}` },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let result: T & { success?: boolean; error_code?: number; error_message?: string };
  try { result = JSON.parse(raw); } catch { result = { raw_response: raw } as T & { success?: boolean; error_code?: number; error_message?: string }; }
  console.log("[korba-response]", JSON.stringify({ request_id: requestId, path, status: response.status, raw_body: raw, parsed_body: result }));
  if (!response.ok) {
    const error = new Error(result.error_message || result.message || result.detail || `Korba request failed (${response.status})`) as Error & { details?: unknown };
    error.details = { request_id: requestId, status: response.status, raw_body: raw, parsed_body: result };
    throw error;
  }
  return result;
}

export function userMessage(errorCode?: number) {
  const messages: Record<number, string> = { 400: "Enter a valid customer number.", 401: "A transaction ID is required.", 402: "Enter an amount.", 405: "This network or service is not available.", 407: "This request was already submitted.", 409: "Enter a valid amount.", 410: "Enter a valid Ghana phone number." };
  return (errorCode && messages[errorCode]) || "The request could not be processed. Please try again.";
}

export function providerError(result: unknown) {
  const value = result as Record<string, unknown>;
  return value.error_message || value.message || (value.results as Record<string, unknown> | undefined)?.message;
}
