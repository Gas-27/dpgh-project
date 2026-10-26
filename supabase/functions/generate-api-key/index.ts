import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-store",
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateKey() {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return "pk_live_" + Array.from(buffer).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // The key can only be issued to the signed-in caller for their own account.
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return json({ error: "Authentication required" }, 401);

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) return json({ error: "Authentication required" }, 401);

    const body = await req.json().catch(() => ({}));
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const newApiKey = generateKey();

    const { data: existing } = await supabase
      .from("api_users")
      .select("id")
      .eq("identity_id", user.id)
      .maybeSingle();

    // Never touch the wallet balance when rotating a key.
    const query = existing
      ? supabase
          .from("api_users")
          .update({ api_key: newApiKey, updated_at: new Date().toISOString() })
          .eq("identity_id", user.id)
      : supabase.from("api_users").insert({
          identity_id: user.id,
          api_key: newApiKey,
          is_agent: Boolean(body.is_agent),
          is_user: Boolean(body.is_user),
          wallet: 0,
          updated_at: new Date().toISOString(),
        });

    const { data, error } = await query.select("wallet").single();
    if (error) return json({ error: "Unable to generate API key" }, 400);

    return json({ data: { api_key: newApiKey, wallet: data?.wallet || 0 } }, 200);
  } catch {
    return json({ error: "Internal server error" }, 500);
  }
});
