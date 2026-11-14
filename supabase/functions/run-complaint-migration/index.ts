// Edge function: run-complaint-migration
// Adds the screenshot and checklist columns to the complaints table if they
// don't already exist.  Safe to call multiple times (IF NOT EXISTS).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATEMENTS = [
  `ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS screenshot_url TEXT`,
  `ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS sms_screenshot_url TEXT`,
  `ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS owing_airtime BOOLEAN`,
  `ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS owing_bundle BOOLEAN`,
  `ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS owing_momo BOOLEAN`,
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Use the service role client so we can execute DDL
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const results: { sql: string; ok: boolean; error?: string }[] = [];

    for (const sql of STATEMENTS) {
      // Execute each statement via Supabase's rpc or direct query
      // Supabase JS doesn't support raw DDL directly, so we use the
      // REST /sql endpoint available in supabase-js v2 via supabase.rpc.
      // Fallback: use fetch to POST to the database REST SQL endpoint.
      const url = `${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/exec_sql`;
      // Try calling exec_sql if it exists (may not be deployed on all projects)
      const { error: rpcError } = await supabase.rpc("exec_sql", { sql_query: sql }).maybeSingle();

      if (rpcError) {
        // exec_sql doesn't exist — try direct query approach via supabase-js
        // Supabase doesn't support raw DDL through the JS client, so we mark it
        // as needing the migration to be run manually.
        results.push({ sql: sql.slice(0, 60), ok: false, error: rpcError.message });
      } else {
        results.push({ sql: sql.slice(0, 60), ok: true });
      }
    }

    const allOk = results.every((r) => r.ok);

    return new Response(JSON.stringify({ success: allOk, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
