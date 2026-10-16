import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const PHONE_KEY_PATTERN = /phone|number|recipient|msisdn|contact|mobile/i;
const MAX_DEPTH = 4;

function collect(value: unknown, keyMatches: boolean, depth: number, out: Set<string>) {
  if (depth > MAX_DEPTH || value == null) return;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if ((trimmed.startsWith("[") || trimmed.startsWith("{")) && trimmed.length < 20000) {
      try {
        collect(JSON.parse(trimmed), keyMatches, depth + 1, out);
        return;
      } catch { /* not JSON, treat as plain string */ }
    }
    if (keyMatches && value.replace(/\D/g, "").length >= 9) out.add(value);
    return;
  }
  if (typeof value === "number") {
    if (keyMatches && String(value).length >= 9) out.add(String(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collect(item, keyMatches, depth + 1, out);
    return;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      collect(v, keyMatches || PHONE_KEY_PATTERN.test(k), depth + 1, out);
    }
  }
}

export function collectPhones(...sources: unknown[]): string[] {
  const out = new Set<string>();
  for (const source of sources) collect(source, true, 0, out);
  return [...out];
}

// Returns true when any supplied value is on the blocked_contacts list. Fails open on a lookup
// error because the database triggers still reject the order itself.
export async function containsBlockedNumber(...sources: unknown[]): Promise<boolean> {
  const phones = collectPhones(...sources);
  if (phones.length === 0) return false;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  for (const phone of phones) {
    const { data, error } = await admin.rpc("is_phone_blocked", { p_phone: phone });
    if (error) {
      console.error("[blocklist] lookup failed:", error.message);
      continue;
    }
    if (data === true) return true;
  }
  return false;
}

export const BLOCKED_MESSAGE = "This number is blocked from using this service.";
