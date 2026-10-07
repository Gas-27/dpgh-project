const SANDBOX_BASE_URL = "https://testxchange.korba365.com/api/v1.0";
const PRODUCTION_BASE_URL = "https://xchange.korba365.com/api/v1.0";

export type KorbaPayload = Record<string, string | number | boolean | null | undefined>;

export function korbaBaseUrl() {
  return Deno.env.get("KORBA_ENV") === "production" ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL;
}

export function callbackUrl() {
  const explicit = Deno.env.get("KORBA_CALLBACK_URL");
  if (explicit) return explicit;
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/korba-callback`;
}

function canonicalize(payload: KorbaPayload) {
  return Object.entries(payload)
    .filter(([, value]) => value !== undefined && value !== null)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

async function hmacSha256(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function korbaRequest<T>(path: string, payload: KorbaPayload): Promise<T> {
  const clientId = Deno.env.get("KORBA_CLIENT_ID");
  const clientKey = Deno.env.get("KORBA_CLIENT_KEY");
  const secretKey = Deno.env.get("KORBA_SECRET_KEY");
  if (!clientId || !clientKey || !secretKey) throw new Error("Korba credentials are not configured");

  const requestId = crypto.randomUUID();
  const numericClientId = Number(clientId);
  const body = { ...payload, client_id: Number.isFinite(numericClientId) ? numericClientId : clientId };
  const requestUrl = `${korbaBaseUrl()}${path}`;
  const signature = await hmacSha256(secretKey, canonicalize(body));
  const startedAt = Date.now();
  console.log("[korba-request]", JSON.stringify({ request_id: requestId, method: "POST", url: requestUrl, path, payload: body }));

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `HMAC ${clientKey}:${signature}` },
    body: JSON.stringify(body),
  });
  const rawResponse = await response.text();
  let result: T & { success?: boolean; error_code?: number; error_message?: string };
  try {
    result = JSON.parse(rawResponse) as T & { success?: boolean; error_code?: number; error_message?: string };
  } catch {
    result = { raw_response: rawResponse } as T & { success?: boolean; error_code?: number; error_message?: string };
  }
  console.log("[korba-response]", JSON.stringify({ request_id: requestId, status: response.status, status_text: response.statusText, ok: response.ok, duration_ms: Date.now() - startedAt, headers: Object.fromEntries(response.headers.entries()), raw_body: rawResponse, parsed_body: result }));
  if (!response.ok) {
    const error = new Error(result.error_message || `Korba request failed (${response.status})`) as Error & { details?: unknown };
    error.details = { request_id: requestId, status: response.status, status_text: response.statusText, raw_body: rawResponse, parsed_body: result };
    throw error;
  }
  return result;
}

export function userMessage(errorCode?: number) {
  const messages: Record<number, string> = {
    400: "Enter a valid customer number.", 402: "Enter an amount.", 405: "This network is not available.",
    407: "This request was already submitted.", 409: "Enter a valid amount.", 410: "Enter a valid Ghana phone number.",
  };
  return (errorCode && messages[errorCode]) || "Korba could not process the request. Please try again.";
}
