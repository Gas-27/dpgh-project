import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let payload: any = {};

  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    id,
    status,
    previous_status,
    order_code,   // Dakazina's order ID — stored as provider_order_id in our orders table
    reference,    // Dakazina's reference — stored as provider_reference
    occurred_at,
    test,
  } = payload;

  console.log(`[dakazina-webhook] Received: order_code=${order_code}, reference=${reference}, status=${status}`);

  // Map Dakazina statuses to our order_status values
  const statusMap: Record<string, string> = {
    PROCESSING: "processing",
    DELIVERED:  "delivered",
    FAILED:     "failed",
    CANCELLED:  "cancelled",
    PENDING:    "pending",
  };

  const mappedStatus = statusMap[status?.toUpperCase()] ?? status?.toLowerCase() ?? "unknown";

  // Map to fulfillment_status (completed = delivered for us)
  const fulfillmentMap: Record<string, string> = {
    PROCESSING: "processing",
    DELIVERED:  "completed",
    FAILED:     "failed",
    CANCELLED:  "failed",
    PENDING:    "pending",
  };
  const mappedFulfillment = fulfillmentMap[status?.toUpperCase()] ?? "processing";

  let order: any = null;

  // PRIMARY match: provider_order_id = order_code (e.g. ORD6A6344D9845E3392)
  if (order_code) {
    const { data } = await supabase
      .from("orders")
      .select("id, order_status, fulfillment_status, status, customer_number")
      .eq("provider_order_id", order_code)
      .maybeSingle();
    order = data;
    console.log(`[dakazina-webhook] Match by provider_order_id: ${order ? order.id : "NOT FOUND"}`);
  }

  // FALLBACK match: provider_reference = reference (e.g. REF-HETWWVUOTM)
  if (!order && reference) {
    const { data } = await supabase
      .from("orders")
      .select("id, order_status, fulfillment_status, status, customer_number")
      .eq("provider_reference", reference)
      .maybeSingle();
    order = data;
    console.log(`[dakazina-webhook] Match by provider_reference: ${order ? order.id : "NOT FOUND"}`);
  }

  // LAST RESORT: search inside api_response JSON for the order_code
  if (!order && order_code) {
    const { data } = await supabase
      .from("orders")
      .select("id, order_status, fulfillment_status, status, customer_number, api_response")
      .like("api_response", `%${order_code}%`)
      .maybeSingle();
    order = data;
    console.log(`[dakazina-webhook] Match by api_response search: ${order ? order.id : "NOT FOUND"}`);

    // If found via api_response, backfill provider_order_id so future webhooks match faster
    if (order) {
      await supabase
        .from("orders")
        .update({ provider_order_id: order_code })
        .eq("id", order.id);
    }
  }

  // Log every webhook hit regardless of match
  await supabase.from("webhook_logs").insert({
    provider:    "dakazina",
    payload:     payload,
    reference:   reference ?? null,
    order_code:  order_code ?? null,
    order_id:    order?.id ?? null,
    status:      status ?? null,
    matched:     !!order,
    occurred_at: occurred_at ?? null,
    is_test:     test ?? false,
    created_at:  new Date().toISOString(),
  }).catch((e: any) => console.log(`[dakazina-webhook] Log insert failed (non-critical): ${e.message}`));

  if (!order) {
    console.log(`[dakazina-webhook] No order matched for order_code=${order_code}, reference=${reference}`);
    return new Response(
      JSON.stringify({ success: false, message: "Order not found", order_code, reference }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Update order with new status
  const { error: updateErr } = await supabase
    .from("orders")
    .update({
      order_status:       mappedStatus,
      fulfillment_status: mappedFulfillment,
      status:             mappedFulfillment,
    })
    .eq("id", order.id);

  if (updateErr) {
    console.error(`[dakazina-webhook] Update failed: ${updateErr.message}`);
    return new Response(
      JSON.stringify({ success: false, error: updateErr.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[dakazina-webhook] Updated order ${order.id} -> order_status=${mappedStatus}, fulfillment_status=${mappedFulfillment}`);

  return new Response(
    JSON.stringify({ success: true, order_id: order.id, new_status: mappedStatus, fulfillment_status: mappedFulfillment }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
