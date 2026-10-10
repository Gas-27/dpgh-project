import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// ---------------------------------------------------------------------------
// Dakazina Webhook Receiver  —  supabase/functions/dakazina-webhook/index.ts
// ---------------------------------------------------------------------------
// IMPORTANT: Deploy with --no-verify-jwt OR set verify_jwt = false in
// supabase/config.toml. Dakazina sends no JWT; without this flag every
// incoming request is rejected with 401 before it reaches this code.
//
// Dakazina webhook payload example (from their dashboard):
// {
//   "id": 7988,
//   "type": "test_event",
//   "status": "DELIVERED",
//   "previous_status": "PROCESSING",
//   "order_code": "DKZ-TEST-RQ5WKR",     ← Dakazina's internal code
//   "reference": "REF-HETWWVUOTM",       ← the reference WE passed when ordering
//   "amount": 10,
//   "user_id": 4,
//   "occurred_at": "2026-04-10T21:15:44+00:00",
//   "test": true,
//   "metadata": { "message": "This is a test webhook from Dakazina" }
// }
//
// HOW ORDER MATCHING WORKS
// ─────────────────────────
// When fulfill-order submits a purchase to Dakazina it passes our order UUID
// as the "incoming_api_ref" (the reference we control). Dakazina echoes it
// back as the "reference" field in this webhook. That is the primary match.
//
// All other tiers are fallbacks for historical orders or edge cases where
// Dakazina returns the identifier in a different field.
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, authorization",
      },
    });
  }

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

  // ─── Parse body ────────────────────────────────────────────────────────────
  let rawBody = "";
  let payload: any = {};

  try {
    rawBody = await req.text();
    payload = JSON.parse(rawBody);
  } catch {
    console.log(`[dakazina-webhook] Invalid JSON: ${rawBody.slice(0, 300)}`);
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log(`[dakazina-webhook] PAYLOAD: ${JSON.stringify(payload)}`);

  const {
    id:              webhook_id,
    status,
    previous_status,
    order_code,   // Dakazina's internal order code e.g. "#ORDER-980291" or "DKZ-XXXXX"
    reference,    // incoming_api_ref we passed = our order UUID e.g. "19c2f2b4-87a7-..."
    occurred_at,
    test,
    amount,
    metadata,
  } = payload;

  console.log(`[dakazina-webhook] status=${status} | order_code=${order_code} | reference=${reference}`);

  // ─── Map statuses ──────────────────────────────────────────────────────────
  // order_status values used in the orders table
  const orderStatusMap: Record<string, string> = {
    PROCESSING: "processing",
    DELIVERED:  "delivered",
    FAILED:     "failed",
    CANCELLED:  "cancelled",
    PENDING:    "pending",
  };

  // fulfillment_status values used in the orders table
  const fulfillmentStatusMap: Record<string, string> = {
    PROCESSING: "processing",
    DELIVERED:  "completed",
    FAILED:     "failed",
    CANCELLED:  "failed",
    PENDING:    "pending",
  };

  const upperStatus         = (status ?? "").toUpperCase();
  const mappedOrderStatus   = orderStatusMap[upperStatus]      ?? status?.toLowerCase() ?? "unknown";
  const mappedFulfillment   = fulfillmentStatusMap[upperStatus] ?? "processing";

  // ─── Order matching (7 tiers, best → worst) ────────────────────────────────
  //
  // HOW THIS WORKS:
  //   When fulfill-order calls Dakazina it passes  incoming_api_ref = our order UUID.
  //   Dakazina echoes that value back as the "reference" field in the webhook.
  //   So  orders.id = webhook.reference  is the PRIMARY and most reliable match.
  //
  //   All other tiers are fallbacks for:
  //   - Historical orders placed before incoming_api_ref was implemented
  //   - Cases where Dakazina stores our UUID in order_code instead
  //   - Last-resort api_response text search

  let order: any    = null;
  let matchMethod   = "";

  // ── MATCH 1 (PRIMARY): orders.id = reference ──────────────────────────────
  // fulfill-order passes order_id as incoming_api_ref → Dakazina echoes it as reference
  if (!order && reference) {
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_status, fulfillment_status, status, customer_number, provider_reference, provider_order_id")
      .eq("id", reference)
      .maybeSingle();
    console.log(`[dakazina-webhook] MATCH1 id=${reference}: ${data?.id ?? "NOT FOUND"}${error ? ` ERR=${error.message}` : ""}`);
    if (data) { order = data; matchMethod = `id = reference(${reference})`; }
  }

  // ── MATCH 2: orders.id = order_code ───────────────────────────────────────
  // Some Dakazina setups echo our UUID in order_code instead of reference
  if (!order && order_code) {
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_status, fulfillment_status, status, customer_number, provider_reference, provider_order_id")
      .eq("id", order_code)
      .maybeSingle();
    console.log(`[dakazina-webhook] MATCH2 id=${order_code}: ${data?.id ?? "NOT FOUND"}${error ? ` ERR=${error.message}` : ""}`);
    if (data) { order = data; matchMethod = `id = order_code(${order_code})`; }
  }

  // ── MATCH 3: provider_order_id = order_code ───────────────────────────────
  // Dakazina's order code stored in provider_order_id from a previous fulfillment
  if (!order && order_code) {
    const { data } = await supabase
      .from("orders")
      .select("id, order_status, fulfillment_status, status, customer_number, provider_reference, provider_order_id")
      .eq("provider_order_id", order_code)
      .maybeSingle();
    console.log(`[dakazina-webhook] MATCH3 provider_order_id=${order_code}: ${data?.id ?? "NOT FOUND"}`);
    if (data) { order = data; matchMethod = `provider_order_id = order_code(${order_code})`; }
  }

  // ── MATCH 4: provider_reference = order_code ──────────────────────────────
  if (!order && order_code) {
    const { data } = await supabase
      .from("orders")
      .select("id, order_status, fulfillment_status, status, customer_number, provider_reference, provider_order_id")
      .eq("provider_reference", order_code)
      .maybeSingle();
    console.log(`[dakazina-webhook] MATCH4 provider_reference=${order_code}: ${data?.id ?? "NOT FOUND"}`);
    if (data) { order = data; matchMethod = `provider_reference = order_code(${order_code})`; }
  }

  // ── MATCH 5: provider_reference = reference ─────────���─────────────────────
  if (!order && reference) {
    const { data } = await supabase
      .from("orders")
      .select("id, order_status, fulfillment_status, status, customer_number, provider_reference, provider_order_id")
      .eq("provider_reference", reference)
      .maybeSingle();
    console.log(`[dakazina-webhook] MATCH5 provider_reference=${reference}: ${data?.id ?? "NOT FOUND"}`);
    if (data) { order = data; matchMethod = `provider_reference = reference(${reference})`; }
  }

  // ── MATCH 6: api_response text contains order_code ────────────────────────
  if (!order && order_code) {
    const { data } = await supabase
      .from("orders")
      .select("id, order_status, fulfillment_status, status, customer_number, provider_reference, provider_order_id")
      .like("api_response", `%${order_code}%`)
      .maybeSingle();
    console.log(`[dakazina-webhook] MATCH6 api_response LIKE ${order_code}: ${data?.id ?? "NOT FOUND"}`);
    if (data) {
      order = data;
      matchMethod = `api_response LIKE order_code(${order_code})`;
      // Backfill so next webhook matches faster
      await supabase.from("orders").update({ provider_order_id: order_code }).eq("id", data.id);
    }
  }

  // ── MATCH 7: api_response text contains reference ─────────────────────────
  if (!order && reference) {
    const { data } = await supabase
      .from("orders")
      .select("id, order_status, fulfillment_status, status, customer_number, provider_reference, provider_order_id")
      .like("api_response", `%${reference}%`)
      .maybeSingle();
    console.log(`[dakazina-webhook] MATCH7 api_response LIKE ${reference}: ${data?.id ?? "NOT FOUND"}`);
    if (data) {
      order = data;
      matchMethod = `api_response LIKE reference(${reference})`;
    }
  }

  console.log(`[dakazina-webhook] Final match: ${order ? `order ${order.id} via ${matchMethod}` : "UNMATCHED"}`);

  // ─── If unmatched: return 200 so Dakazina does not retry endlessly ─────────
  if (!order) {
    console.log(`[dakazina-webhook] UNMATCHED — reference=${reference}, order_code=${order_code}`);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Order not found",
        tried:   { reference, order_code },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // ─── Update order status ───────────────────────────────────────────────────
  // Step 1: minimal update — only core status fields that definitely exist
  const { error: updateErr } = await supabase
    .from("orders")
    .update({
      order_status:       mappedOrderStatus,
      fulfillment_status: mappedFulfillment,
      status:             mappedFulfillment,
    })
    .eq("id", order.id);

  if (updateErr) {
    console.log(`[dakazina-webhook] DB UPDATE FAILED for order ${order.id}: ${updateErr.message}`);
    return new Response(
      JSON.stringify({ success: false, error: updateErr.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  console.log(`[dakazina-webhook] UPDATED order ${order.id}: order_status=${mappedOrderStatus}, fulfillment_status=${mappedFulfillment} (via ${matchMethod})`);

  // Step 2: try to backfill provider columns if they exist (non-blocking)
  if (order_code) {
    await supabase.from("orders").update({ provider_order_id: order_code }).eq("id", order.id).then(() => null).catch(() => null);
    await supabase.from("orders").update({ provider_reference: order_code }).eq("id", order.id).then(() => null).catch(() => null);
  }

  return new Response(
    JSON.stringify({
      success:            true,
      order_id:           order.id,
      order_status:       mappedOrderStatus,
      fulfillment_status: mappedFulfillment,
      matched_via:        matchMethod,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
