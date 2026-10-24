// supabase/functions/dakazina-sync/index.ts
//
// Sweeps all orders where:
//   - provider_reference starts with "107"  (Dakazina transaction codes)
//   - order_status is NOT a terminal status (delivered / failed / refunded)
//   - created within the last 7 days
//
// For each order it calls Dakazina's order-status API and updates order_status
// in the orders table.  Designed to be called by pg_cron every minute.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Status mapping ────────────────────────────────────────────────────────────
const TERMINAL_STATUSES = new Set(["delivered", "failed", "refunded"]);

function mapDakazinaStatus(raw: string): string {
  switch ((raw ?? "").toUpperCase().trim()) {
    case "DELIVERED":
    case "COMPLETED":
    case "SUCCESS":
      return "delivered";
    case "PROCESSING":
    case "PENDING":
    case "WAITING":
      return "processing";
    case "FAILED":
    case "CANCELLED":
    case "CANCELED":
      return "failed";
    default:
      return (raw ?? "").toLowerCase().trim();
  }
}

// ── Fetch with hard timeout ───────────────────────────────────────────────────
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── Dakazina status check ─────────────────────────────────────────────────────
// GET https://reseller.dakazinabusinessconsult.com/api/v1/order-status
//       ?transaction_code=<provider_reference>
async function checkDakazinaStatus(
  transactionCode: string,
  apiKey: string
): Promise<{ status: string | null; raw: string }> {
  const url =
    `https://reseller.dakazinabusinessconsult.com/api/v1/order-status` +
    `?transaction_code=${encodeURIComponent(transactionCode)}`;

  const res = await fetchWithTimeout(
    url,
    { headers: { Authorization: `Bearer ${apiKey}` } },
    8000
  );

  const raw = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: null, raw };
  }

  // Handle multiple possible response shapes from Dakazina
  const rawStatus =
    parsed?.data?.status ??
    parsed?.status ??
    parsed?.data?.order_status ??
    parsed?.order_status ??
    parsed?.data?.delivery_status ??
    null;

  return { status: rawStatus, raw };
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const dakazinaApiKey = Deno.env.get("DAKAZINA_API_KEY");
    if (!dakazinaApiKey) {
      console.error("[dakazina-sync] DAKAZINA_API_KEY is not set");
      return new Response(
        JSON.stringify({ success: false, error: "DAKAZINA_API_KEY not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optional batch offset from request body for manual pagination
    let batchOffset = 0;
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (typeof body?.offset === "number") batchOffset = body.offset;
    } catch { /* ignore */ }

    const BATCH_SIZE = 50;
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    // ── Fetch Dakazina orders that still need a status update ─────────────────
    // Filter: provider_reference LIKE '107%'   (all Dakazina transaction codes)
    //         AND order_status NOT IN terminal  (don't re-check completed orders)
    //         AND created within 7 days
    const { data: orders, error: fetchError } = await supabase
      .from("orders")
      .select("id, customer_number, provider_reference, order_status, network, created_at")
      .gte("created_at", sevenDaysAgo)
      .like("provider_reference", "107%")
      .not("order_status", "in", '("delivered","failed","refunded")')
      .order("created_at", { ascending: true })
      .range(batchOffset, batchOffset + BATCH_SIZE - 1);

    if (fetchError) {
      console.error("[dakazina-sync] DB fetch error:", fetchError.message);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const count = orders?.length ?? 0;
    console.log(
      `[dakazina-sync] Batch offset=${batchOffset} | orders to check: ${count}`
    );

    if (count === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No active Dakazina orders to sync",
          updated: 0,
          checked: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Process each order ────────────────────────────────────────────────────
    let updated = 0;
    let skipped = 0;
    let errors  = 0;
    const results: any[] = [];

    for (const order of orders) {
      // Double-guard: skip any terminal status that slipped through the filter
      if (TERMINAL_STATUSES.has((order.order_status ?? "").toLowerCase())) {
        skipped++;
        continue;
      }

      // Hard stop at 45 s to stay within Supabase's 60 s function timeout
      if (Date.now() - startTime > 45_000) {
        console.log(
          `[dakazina-sync] Approaching 45 s limit — stopping early. ` +
          `Processed ${results.length} of ${count}`
        );
        break;
      }

      const ref = order.provider_reference;

      try {
        console.log(
          `[dakazina-sync] Checking order=${order.id} ` +
          `ref=${ref} current_status=${order.order_status}`
        );

        const { status: rawStatus, raw: rawResponse } =
          await checkDakazinaStatus(ref, dakazinaApiKey);

        if (!rawStatus) {
          console.warn(
            `[dakazina-sync] No status field for ref=${ref} — ` +
            `response: ${rawResponse.slice(0, 200)}`
          );
          errors++;
          results.push({ id: order.id, ref, error: "no_status_field", raw: rawResponse.slice(0, 200) });
          continue;
        }

        const mappedStatus = mapDakazinaStatus(rawStatus);
        console.log(
          `[dakazina-sync] order=${order.id} raw="${rawStatus}" → mapped="${mappedStatus}"`
        );

        // No change — skip DB write
        if (order.order_status === mappedStatus) {
          results.push({ id: order.id, ref, status: mappedStatus, changed: false });
          continue;
        }

        // Build update payload
        const updatePayload: Record<string, any> = {
          order_status: mappedStatus,
          updated_at:   new Date().toISOString(),
        };

        if (mappedStatus === "delivered") {
          updatePayload.fulfillment_status = "delivered";
          updatePayload.status             = "completed";
        }
        // For "failed": order_status = "failed" — the AdminDashboard realtime
        // listener picks this up and fires the auto-refund flow.

        const { error: upErr } = await supabase
          .from("orders")
          .update(updatePayload)
          .eq("id", order.id);

        if (upErr) {
          console.error(
            `[dakazina-sync] Update failed for order=${order.id}: ${upErr.message}`
          );
          errors++;
          results.push({ id: order.id, ref, error: upErr.message });
        } else {
          console.log(
            `[dakazina-sync] UPDATED order=${order.id} ` +
            `"${order.order_status}" → "${mappedStatus}" ` +
            `phone=${order.customer_number}`
          );
          updated++;
          results.push({
            id:      order.id,
            ref,
            old:     order.order_status,
            new:     mappedStatus,
            changed: true,
            phone:   order.customer_number,
          });
        }
      } catch (e: any) {
        if (e?.name === "AbortError") {
          console.warn(`[dakazina-sync] Timeout for ref=${ref}`);
        } else {
          console.error(`[dakazina-sync] Error for ref=${ref}: ${e.message}`);
        }
        errors++;
        results.push({ id: order.id, ref, error: e.message ?? "timeout" });
      }
    }

    const elapsed    = ((Date.now() - startTime) / 1000).toFixed(1);
    const hasMore    = orders.length === BATCH_SIZE;
    const nextOffset = hasMore ? batchOffset + BATCH_SIZE : 0;

    console.log(
      `[dakazina-sync] Done in ${elapsed}s — ` +
      `checked=${results.length + skipped} updated=${updated} ` +
      `skipped=${skipped} errors=${errors} hasMore=${hasMore}`
    );

    return new Response(
      JSON.stringify({
        success:         true,
        batch_offset:    batchOffset,
        batch_size:      BATCH_SIZE,
        checked:         results.length + skipped,
        updated,
        skipped,
        errors,
        has_more:        hasMore,
        next_offset:     nextOffset,
        elapsed_seconds: Number(elapsed),
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[dakazina-sync] Fatal error:", err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
