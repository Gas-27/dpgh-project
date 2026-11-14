import { supabase } from "@/integrations/supabase/client";

// progress_key is not in the generated Supabase types yet, so the query is untyped.
export async function fetchProgressKey(identityId: string, isAgent?: boolean): Promise<string | null> {
  let query = (supabase as any).from("api_users").select("progress_key").eq("identity_id", identityId);
  if (isAgent) query = query.eq("is_agent", true);
  const { data, error } = await query.maybeSingle();
  if (error || !data?.progress_key) return null;
  return String(data.progress_key);
}
