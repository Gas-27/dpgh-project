import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Statuses that are terminal — never re-check these
const TERMINAL_STATUSES = new Set(["delivered", "refunded", "failed"]);

function mapStatus(s: string): string {
  switch ((s ?? "").toLowerCase().trim()) {
    case "completed":
    case "delivered":
      return "delivered";
    case "pending":    return "pending";
    case "processing": return "processing";
    case "waiting":    return "waiting";
    case "refund":
    case "refunded":   return "refunded";
    case "failed":     return "failed";
    default:           return (s ?? "").toLowerCase().trim();
  }
}

// Fetch with a hard timeout so one slow/hung request can't stall the whole function
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

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

    const orisjayApiKey = Deno.env.get("ORISJAY_API_KEY");
    if (!orisjayApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "ORISJAY_API_KEY not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only sync orders from the last 7 days that have a provider_reference
    // and are NOT in a terminal status.
    // Process in batches of 50 per invocation — cron runs every minute
    // so all orders get covered in rotation without timing out.
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Accept optional offset from request body so caller can page through batches
    let batchOffset = 0;
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (typeof body.offset === "number") batchOffset = body.offset;
    } catch { /* ignore */ }

    const BATCH_SIZE = 50;

    const { data: orders, error: fetchError } = await supabase
      .from("orders")
      .select("id, customer_number, provider_reference, order_status, created_at")
      .gte("created_at", sevenDaysAgo)
      .not("provider_reference", "is", null)
      .not("order_status", "in", '("delivered","refunded","failed")')
      .order("created_at", { ascending: true }) // oldest first so newest don't starve
      .range(batchOffset, batchOffset + BATCH_SIZE - 1);

    if (fetchError) {
      console.error("[sync] DB fetch error:", fetchError.message);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[sync] Batch offset=${batchOffset}, orders in batch: ${orders?.length ?? 0}`);

    if (!orders || orders.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active orders to sync", updated: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const order of orders) {
      // Guard: skip terminal statuses just in case DB filter missed one
      if (TERMINAL_STATUSES.has((order.order_status ?? "").toLowerCase())) {
        skipped++;
        continue;
      }

      // Safety: stop after 45 seconds to avoid Supabase 60s function timeout
      if (Date.now() - startTime > 45_000) {
        console.log(`[sync] Approaching timeout - stopping early. Processed ${results.length} of ${orders.length}`);
        break;
      }

      try {
        const url = `https://orisjay.store/api/check-status.php?action=check&reference=${encodeURIComponent(order.provider_reference)}`;
        const res = await fetchWithTimeout(url, {
          headers: { "Authorization": `Bearer ${orisjayApiKey}` },
        }, 8000);

        const text = await res.text();
        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch {
          console.error(`[sync] Non-JSON for ref=${order.provider_reference}: ${text.slice(0, 100)}`);
          errors++;
          continue;
        }

        // Extract status from multiple possible locations in the response
        const rawStatus =
          parsed?.data?.status ??
          parsed?.status ??
          parsed?.data?.order_status ??
          parsed?.order_status ??
          "";

        if (!rawStatus) {
          console.log(`[sync] No status field in response for ref=${order.provider_reference}: ${text.slice(0, 200)}`);
          errors++;
          continue;
        }

        const mappedStatus = mapStatus(rawStatus);

        if (order.order_status === mappedStatus) {
          results.push({ ref: order.provider_reference, status: mappedStatus, changed: false });
          continue;
        }

        const { error: upErr } = await supabase
          .from("orders")
          .update({ order_status: mappedStatus })
          .eq("id", order.id);

        if (upErr) {
          console.error(`[sync] Update failed ${order.id}: ${upErr.message}`);
          errors++;
          results.push({ ref: order.provider_reference, error: upErr.message });
        } else {
          console.log(
            `[sync] UPDATED ${order.id}: "${order.order_status}" → "${mappedStatus}" | ref=${order.provider_reference} phone=${order.customer_number}`
          );
          updated++;
          results.push({
            ref: order.provider_reference,
            old: order.order_status,
            new: mappedStatus,
            changed: true,
            phone: order.customer_number,
          });
        }
      } catch (e: any) {
        if (e?.name === "AbortError") {
          console.warn(`[sync] Timeout checking ref=${order.provider_reference}`);
        } else {
          console.error(`[sync] Error checking ref=${order.provider_reference}: ${e.message}`);
        }
        errors++;
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const processedCount = results.length + skipped;
    // If we got a full batch there may be more — provide next_offset
    const hasMore = orders.length === BATCH_SIZE;
    const nextOffset = hasMore ? batchOffset + BATCH_SIZE : 0; // 0 means start over

    console.log(
      `[sync] Done in ${elapsed}s. Batch offset=${batchOffset}, Checked: ${processedCount}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}, HasMore: ${hasMore}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        batch_offset: batchOffset,
        batch_size: BATCH_SIZE,
        checked: processedCount,
        updated,
        skipped,
        errors,
        has_more: hasMore,
        next_offset: nextOffset,
        elapsed_seconds: Number(elapsed),
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[sync] Fatal:", err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
