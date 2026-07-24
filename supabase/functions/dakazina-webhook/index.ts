import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// NOTE: This function must be deployed with --no-verify-jwt
// or with verify_jwt = false in supabase/config.toml
// Dakazina does not send any JWT token — requests without this setting
// are silently rejected with 401 before the function even runs.

Deno.serve(async (req: Request) => {
  // Allow CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, authorization",
      },
    });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Read raw body first for logging
  let rawBody = "";
  let payload: any = {};

  try {
    rawBody = await req.text();
    payload = JSON.parse(rawBody);
  } catch {
    console.log(`[dakazina-webhook] ERROR: Invalid JSON body: ${rawBody.slice(0, 200)}`);
    // Still log this malformed request
    await supabase.from("webhook_logs").insert({
      provider: "dakazina",
      payload: { raw: rawBody.slice(0, 500) },
      matched: false,
      is_test: false,
      created_at: new Date().toISOString(),
    }).catch(() => null);
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`[dakazina-webhook] RECEIVED PAYLOAD: ${JSON.stringify(payload)}`);

  const {
    id: webhook_id,
    status,
    previous_status,
    order_code,   // e.g. "DKZ-TEST-RQ5WKR" or "#ORDER-980291"
    reference,    // e.g. "REF-HETWWVUOTM" — this may match our paystack_reference
    amount,
    occurred_at,
    test,
    metadata,
  } = payload;

  // Map Dakazina status -> our order_status
  const statusMap: Record<string, string> = {
    PROCESSING: "processing",
    DELIVERED:  "delivered",
    FAILED:     "failed",
    CANCELLED:  "cancelled",
    PENDING:    "pending",
  };

  // Map Dakazina status -> our fulfillment_status
  const fulfillmentMap: Record<string, string> = {
    PROCESSING: "processing",
    DELIVERED:  "completed",
    FAILED:     "failed",
    CANCELLED:  "failed",
    PENDING:    "pending",
  };

  const upperStatus = status?.toUpperCase() ?? "";
  const mappedOrderStatus      = statusMap[upperStatus]      ?? status?.toLowerCase() ?? "unknown";
  const mappedFulfillmentStatus = fulfillmentMap[upperStatus] ?? "processing";

  console.log(`[dakazina-webhook] order_code=${order_code} | reference=${reference} | status=${status} -> ${mappedOrderStatus}`);

  let order: any = null;
  let matchMethod = "";

  // ─── MATCH 1: provider_reference = order_code ───────────────────────────
  // This works for orders where api_response stored Dakazina's order code
  // in provider_reference (e.g. ORD6A... format)
  if (!order && order_code) {
    const { data } = await supabase
      .from("orders")
      .select("id, order_status, fulfillment_status, status, customer_number, provider_reference, provider_order_id")
      .eq("provider_reference", order_code)
      .maybeSingle();
    if (data) { order = data; matchMethod = `provider_reference = order_code(${order_code})`; }
  }

  // ─── MATCH 2: provider_reference = reference ────────────────────────────
  if (!order && reference) {
    const { data } = await supabase
      .from("orders")
      .select("id, order_status, fulfillment_status, status, customer_number, provider_reference, provider_order_id")
      .eq("provider_reference", reference)
      .maybeSingle();
    if (data) { order = data; matchMethod = `provider_reference = reference(${reference})`; }
  }

  // ─── MATCH 3: provider_order_id = order_code ────────────────────────────
  if (!order && order_code) {
    const { data } = await supabase
      .from("orders")
      .select("id, order_status, fulfillment_status, status, customer_number, provider_reference, provider_order_id")
      .eq("provider_order_id", order_code)
      .maybeSingle();
    if (data) { order = data; matchMethod = `provider_order_id = order_code(${order_code})`; }
  }

  // ─── MATCH 4: paystack_reference = reference ────────────────────────────
  // In some setups, Dakazina's "reference" is the same as the Paystack reference
  if (!order && reference) {
    const { data } = await supabase
      .from("orders")
      .select("id, order_status, fulfillment_status, status, customer_number, provider_reference, provider_order_id")
      .eq("paystack_reference", reference)
      .maybeSingle();
    if (data) { order = data; matchMethod = `paystack_reference = reference(${reference})`; }
  }

  // ─── MATCH 5: LIKE search inside api_response JSON text ─────────────────
  // Last resort — search for the order_code string anywhere in api_response
  if (!order && order_code) {
    const { data } = await supabase
      .from("orders")
      .select("id, order_status, fulfillment_status, status, customer_number, provider_reference, provider_order_id, api_response")
      .like("api_response", `%${order_code}%`)
      .maybeSingle();
    if (data) {
      order = data;
      matchMethod = `api_response LIKE %${order_code}%`;
      // Backfill so future webhooks match faster
      await supabase
        .from("orders")
        .update({ provider_order_id: order_code })
        .eq("id", order.id);
    }
  }

  // ─── MATCH 6: LIKE search inside api_response for reference ─────────────
  if (!order && reference) {
    const { data } = await supabase
      .from("orders")
      .select("id, order_status, fulfillment_status, status, customer_number, provider_reference, provider_order_id, api_response")
      .like("api_response", `%${reference}%`)
      .maybeSingle();
    if (data) {
      order = data;
      matchMethod = `api_response LIKE %${reference}%`;
    }
  }

  console.log(`[dakazina-webhook] Match result: ${order ? `FOUND order ${order.id} via ${matchMethod}` : "NOT FOUND"}`);

  // Always log the webhook hit regardless of match outcome
  const logInsert = await supabase.from("webhook_logs").insert({
    provider:    "dakazina",
    payload:     payload,
    reference:   reference    ?? null,
    order_code:  order_code   ?? null,
    order_id:    order?.id    ?? null,
    status:      status       ?? null,
    matched:     !!order,
    occurred_at: occurred_at  ?? null,
    is_test:     test         ?? false,
    created_at:  new Date().toISOString(),
  });

  if (logInsert.error) {
    console.log(`[dakazina-webhook] webhook_logs insert failed: ${logInsert.error.message}`);
  }

  // If no order found — return 200 so Dakazina stops retrying, but log it
  if (!order) {
    console.log(`[dakazina-webhook] UNMATCHED: order_code=${order_code}, reference=${reference}. Check provider_reference column.`);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Order not found in database",
        tried: { order_code, reference },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // Update the order statuses
  const { error: updateErr } = await supabase
    .from("orders")
    .update({
      order_status:       mappedOrderStatus,
      fulfillment_status: mappedFulfillmentStatus,
      status:             mappedFulfillmentStatus,
    })
    .eq("id", order.id);

  if (updateErr) {
    console.log(`[dakazina-webhook] DB UPDATE FAILED for order ${order.id}: ${updateErr.message}`);
    return new Response(
      JSON.stringify({ success: false, error: updateErr.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log(`[dakazina-webhook] SUCCESS: Updated order ${order.id} -> order_status=${mappedOrderStatus}, fulfillment_status=${mappedFulfillmentStatus} (matched via ${matchMethod})`);

  return new Response(
    JSON.stringify({
      success: true,
      order_id:           order.id,
      order_status:       mappedOrderStatus,
      fulfillment_status: mappedFulfillmentStatus,
      matched_via:        matchMethod,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
