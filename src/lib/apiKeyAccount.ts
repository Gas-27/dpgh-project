import { supabase } from "@/integrations/supabase/client";

export function isRevokedApiKey(key: string | null | undefined): boolean {
  return !key || key.startsWith("revoked_");
}

/** Revokes the signed-in user's API key and clears their API wallet. Returns the amount that was cleared. */
export async function deleteMyApiKey(): Promise<number> {
  const { data, error } = await supabase.rpc("delete_my_api_key" as never);
  if (error) {
    if (error.message?.includes("no_api_key")) throw new Error("You do not have an API key to delete.");
    throw new Error(error.message || "Failed to delete API key");
  }
  return Number(data || 0);
}
