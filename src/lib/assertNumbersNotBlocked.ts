import { supabase } from "@/integrations/supabase/client";

export const BLOCKED_NUMBER_MESSAGE =
  "This number has been associated with fraudulent activity across our networks and cannot make purchases on our system.";

export async function assertNumbersNotBlocked(phones: (string | null | undefined)[]): Promise<void> {
  const cleaned = Array.from(
    new Set(
      phones
        .map((phone) => (phone == null ? "" : String(phone).trim()))
        .filter((phone) => phone.length > 0),
    ),
  );
  if (cleaned.length === 0) return;

  let blocked = false;
  try {
    const { data, error } = await (supabase as any).rpc("any_phone_blocked", { p_phones: cleaned });
    if (error) return;
    blocked = data === true;
  } catch {
    return;
  }

  if (blocked) throw new Error(BLOCKED_NUMBER_MESSAGE);
}
