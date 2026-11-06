import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// The marketing functions are not part of the generated Database types yet.
const db = supabase as unknown as SupabaseClient;

export type MarketingPost = { id: string; title: string; caption: string; image_url: string | null; created_at: string };
export type AdminMarketingPost = MarketingPost & { active: boolean };

export async function fetchMarketingPosts(): Promise<MarketingPost[]> {
  const { data, error } = await db.rpc("marketing_active_posts", { p_limit: 10 });
  if (error) throw error;
  return (data ?? []) as MarketingPost[];
}

export async function adminFetchMarketingPosts(): Promise<AdminMarketingPost[]> {
  const { data, error } = await db.rpc("marketing_admin_posts");
  if (error) throw error;
  return (data ?? []) as AdminMarketingPost[];
}

export async function adminSaveMarketingPost(input: { id: string | null; title: string; caption: string; imageUrl: string }): Promise<void> {
  const { error } = await db.rpc("marketing_admin_save_post", {
    p_id: input.id,
    p_title: input.title,
    p_caption: input.caption,
    p_image_url: input.imageUrl,
  });
  if (error) throw error;
}

export async function adminSetMarketingActive(id: string, active: boolean): Promise<void> {
  const { error } = await db.rpc("marketing_admin_set_active", { p_id: id, p_active: active });
  if (error) throw error;
}

export async function adminDeleteMarketingPost(id: string): Promise<void> {
  const { error } = await db.rpc("marketing_admin_delete_post", { p_id: id });
  if (error) throw error;
}
