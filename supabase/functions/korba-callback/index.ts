import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Content-Type": "application/json" };

Deno.serve(async (request) => {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const expected = Deno.env.get("KORBA_CALLBACK_TOKEN");
  const received = request.headers.get("X-Callback-Token");
  if (!expected || !received || received !== expected) return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const transactionId = url.searchParams.get("transaction_id");
  const status = url.searchParams.get("status");
  const message = url.searchParams.get("message") || "";
  if (!transactionId || !["SUCCESS", "FAILED"].includes(status || "")) return new Response("Invalid callback", { status: 400 });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { error } = await supabase.from("orders").update({
    status: status === "SUCCESS" ? "paid" : "failed",
    fulfillment_status: status === "SUCCESS" ? "completed" : "failed",
    api_response: JSON.stringify({ provider: "korba", transaction_id: transactionId, status, message }),
  }).eq("purchase_provider_source", transactionId).eq("fulfillment_status", "pending");
  if (error) {
    console.error("[korba-callback]", error);
    return new Response(JSON.stringify({ error: "Unable to update transaction" }), { status: 500, headers: corsHeaders });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
});
