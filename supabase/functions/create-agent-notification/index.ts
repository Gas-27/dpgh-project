import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { agent_store_id, message, is_active, expires_at, type } = await req.json();

    if (!agent_store_id || !message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: agent_store_id, message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify the agent exists and belongs to the authenticated user
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the appropriate notification based on type
    let tableName = "agent_notifications";
    let insertData: Record<string, unknown> = {
      agent_store_id,
      message,
      is_active: is_active !== false,
      created_at: new Date().toISOString(),
    };

    if (expires_at) {
      insertData.expires_at = expires_at;
    }

    if (type === "subagent") {
      tableName = "agent_to_subagent_notifications";
    }

    console.log(`[v0] Inserting into ${tableName}:`, insertData);

    const { data, error } = await supabase
      .from(tableName)
      .insert([insertData])
      .select();

    if (error) {
      console.error(`[v0] Error inserting into ${tableName}:`, error);
      return new Response(
        JSON.stringify({ error: error.message || "Failed to create notification" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[v0] Successfully created notification:`, data);

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[v0] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
