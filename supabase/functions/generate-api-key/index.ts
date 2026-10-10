import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function generateRandomString(length: number): Promise<string> {
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { identity_id, is_agent, is_user } = await req.json();

    if (!identity_id) {
      return new Response(
        JSON.stringify({ error: "identity_id is required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Generate new API key
    const randomPart = await generateRandomString(32);
    const newApiKey = `pk_live_${randomPart}`;

    // UPSERT: Update if exists, Insert if not
    const { data, error } = await supabase
      .from("api_users")
      .upsert(
        {
          identity_id,
          api_key: newApiKey,
          is_agent: is_agent || false,
          is_user: is_user || false,
          wallet: 0,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "identity_id",
        }
      )
      .select("api_key, wallet");

    if (error) {
      console.error("Upsert error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        data: {
          api_key: newApiKey,
          wallet: data?.[0]?.wallet || 0,
        },
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
