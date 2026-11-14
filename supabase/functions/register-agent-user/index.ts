import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Subagents and sub-subagents are exempt from email verification, so their
// accounts are created pre-confirmed. Only these roles may use this endpoint.
const ALLOWED_ROLES = new Set(["subagent", "sub_subagent"]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, password, data } = await req.json();

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return json({ error: "Email and password are required" }, 400);
    }

    const role = data?.role;
    if (!ALLOWED_ROLES.has(role)) {
      return json({ error: "Invalid role" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const { data: created, error } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: data,
    });

    if (error) {
      const status = /already|registered|exists/i.test(error.message) ? 409 : 400;
      return json({ error: error.message }, status);
    }

    return json({ success: true, user_id: created.user?.id });
  } catch (err) {
    console.error("[v0] register-agent-user error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
