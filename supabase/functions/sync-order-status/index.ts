import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Statuses that are terminal — never re-check these
const TERMINAL_STATUSES = new Set(["delivered", "refunded", "failed"]);

// Networks fulfilled by Dakazina
const DAKAZINA_NETWORKS = new Set(["mtn", "telecel", "airteltigo", "mtn_mashup"]);
const GHDATACONNECT_NETWORKS = new Set(["atbigtime"]);

function mapGhDataConnectStatus(s: string): string {
  switch ((s ?? "").toUpperCase().trim()) {
    case "DELIVERED":
    case "COMPLETED":
    case "SUCCESS":
      return "delivered";
    case "PROCESSING":
    case "PENDING":
    case "WAITING":
    case "QUEUED":
    case "IN_QUEUE":
      return "processing";
    case "FAILED":
    case "CANCELLED":
      return "failed";
    default:
      return (s ?? "").toLowerCase().trim().replace(/_/g, "-");
  }
}

function mapDakazinaStatus(s: string): string {
  switch ((s ?? "").toUpperCase().trim()) {
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
      return "failed";
    default:
      return (s ?? "").toLowerCase().trim();
  }
}

function mapOrisjayStatus(s: string): string {
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

  // GHDataConnect uses the provider reference returned by purchaseBundle.
  async function checkGhDataConnectStatus(
    providerReference: string,
    apiKey: string
  ): Promise<{ status: string | null; raw: string }> {
    const url = `https://ghdataconnect.com/api/v1/order-status?reference=${encodeURIComponent(providerReference)}`;
    const res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${apiKey}` } }, 8000);
    const raw = await res.text();
    let parsed: any;
    try { parsed = JSON.parse(raw); } catch { return { status: null, raw }; }
    const status = parsed?.data?.status ?? parsed?.status ?? parsed?.data?.order_status ?? parsed?.order_status ?? parsed?.data?.delivery_status ?? parsed?.delivery_status ?? null;
    return { status, raw };
  }

  // ─── Check status via Dakazina API ───────────────────────────────────────────
// Dakazina status endpoint: GET /api/v1/order-status?transaction_code=<code>
// Returns: { status: "DELIVERED" | "PROCESSING" | "FAILED" | ... }
async function checkDakazinaStatus(
  transactionCode: string,
  apiKey: string
): Promise<{ status: string | null; raw: string }> {
  const url = `https://reseller.dakazinabusinessconsult.com/api/v1/order-status?transaction_code=${encodeURIComponent(transactionCode)}`;
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

  // Try multiple response shapes Dakazina may return
  const rawStatus =
    parsed?.data?.status ??
    parsed?.status ??
    parsed?.data?.order_status ??
    parsed?.order_status ??
    parsed?.data?.delivery_status ??
    null;

  return { status: rawStatus, raw };
}

// ─── Check status via Orisjay API ────────────────────────────────────────────
async function checkOrisjayStatus(
  providerReference: string,
  apiKey: string
): Promise<{ status: string | null; raw: string }> {
  const url = `https://orisjay.store/api/check-status.php?action=check&reference=${encodeURIComponent(providerReference)}`;
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

  const rawStatus =
    parsed?.data?.status ??
    parsed?.status ??
    parsed?.data?.order_status ??
    parsed?.order_status ??
    null;

  return { status: rawStatus, raw };
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

    const dakazinaApiKey = Deno.env.get("DAKAZINA_API_KEY");
    const orisjayApiKey  = Deno.env.get("ORISJAY_API_KEY");
    const ghDataConnectApiKey = Deno.env.get("GHDATACONNECT_API_KEY");

    if (!dakazinaApiKey && !orisjayApiKey && !ghDataConnectApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "No provider API keys set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Accept optional offset from request body so caller can page through batches
    let batchOffset = 0;
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (typeof body.offset === "number") batchOffset = body.offset;
    } catch { /* ignore */ }

    const BATCH_SIZE = 50;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all active (non-terminal) orders with a provider_reference from last 7 days
    const { data: orders, error: fetchError } = await supabase
      .from("orders")
      .select("id, customer_number, provider_reference, order_status, network, created_at")
      .gte("created_at", sevenDaysAgo)
      .not("provider_reference", "is", null)
      .not("order_status", "in", '("delivered","refunded","failed")')
      .order("created_at", { ascending: true })
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
    let errors  = 0;

    for (const order of orders) {
      // Guard: skip terminal statuses just in case DB filter missed one
      if (TERMINAL_STATUSES.has((order.order_status ?? "").toLowerCase())) {
        skipped++;
        continue;
      }

      // Safety: stop after 45 seconds to avoid Supabase 60s function timeout
      if (Date.now() - startTime > 45_000) {
        console.log(`[sync] Approaching timeout — stopping early. Processed ${results.length} of ${orders.length}`);
        break;
      }

      const network = (order.network ?? "").toLowerCase().trim();
      const isDakazina = DAKAZINA_NETWORKS.has(network);

      try {
        let rawStatus: string | null = null;
        let rawResponse = "";

        if (GHDATACONNECT_NETWORKS.has(network) && ghDataConnectApiKey) {
          console.log(`[sync] Checking GHDataConnect — order=${order.id} ref=${order.provider_reference}`);
          const result = await checkGhDataConnectStatus(order.provider_reference, ghDataConnectApiKey);
          rawStatus = result.status;
          rawResponse = result.raw;
          if (!rawStatus) {
            console.warn(`[sync] GHDataConnect: no status for ref=${order.provider_reference} — response: ${rawResponse.slice(0, 200)}`);
            errors++;
            continue;
          }
          const mappedStatus = mapGhDataConnectStatus(rawStatus);
          console.log(`[sync] GHDataConnect status for ${order.id}: "${rawStatus}" → "${mappedStatus}"`);
          if (order.order_status === mappedStatus) {
            results.push({ id: order.id, ref: order.provider_reference, status: mappedStatus, changed: false });
            continue;
          }
          const updatePayload: Record<string, any> = {
            order_status: mappedStatus,
            updated_at: new Date().toISOString(),
          };
          if (mappedStatus === "delivered") {
            updatePayload.fulfillment_status = "delivered";
            updatePayload.status = "completed";
          }
          const { error: upErr } = await supabase.from("orders").update(updatePayload).eq("id", order.id);
          if (upErr) {
            console.error(`[sync] GHDataConnect update failed ${order.id}: ${upErr.message}`);
            errors++;
            results.push({ id: order.id, ref: order.provider_reference, error: upErr.message });
          } else {
            updated++;
            results.push({ id: order.id, ref: order.provider_reference, old: order.order_status, new: mappedStatus, changed: true, phone: order.customer_number });
          }

        } else if (isDakazina && dakazinaApiKey) {
          console.log(`[sync] Checking Dakazina — order=${order.id} ref=${order.provider_reference} network=${network}`);
          const result = await checkDakazinaStatus(order.provider_reference, dakazinaApiKey);
          rawStatus   = result.status;
          rawResponse = result.raw;

          if (!rawStatus) {
            console.warn(`[sync] Dakazina: no status field for ref=${order.provider_reference} — response: ${rawResponse.slice(0, 200)}`);
            errors++;
            continue;
          }

          const mappedStatus = mapDakazinaStatus(rawStatus);
          console.log(`[sync] Dakazina status for ${order.id}: "${rawStatus}" → "${mappedStatus}"`);

          if (order.order_status === mappedStatus) {
            results.push({ id: order.id, ref: order.provider_reference, status: mappedStatus, changed: false });
            continue;
          }

          const updatePayload: Record<string, any> = {
            order_status: mappedStatus,
            updated_at:   new Date().toISOString(),
          };

          if (mappedStatus === "delivered") {
            updatePayload.fulfillment_status = "delivered";
            updatePayload.status             = "completed";
          }

          const { error: upErr } = await supabase
            .from("orders")
            .update(updatePayload)
            .eq("id", order.id);

          if (upErr) {
            console.error(`[sync] Update failed ${order.id}: ${upErr.message}`);
            errors++;
            results.push({ id: order.id, ref: order.provider_reference, error: upErr.message });
          } else {
            console.log(`[sync] UPDATED ${order.id}: "${order.order_status}" → "${mappedStatus}" | ref=${order.provider_reference} phone=${order.customer_number}`);
            updated++;
            results.push({
              id:      order.id,
              ref:     order.provider_reference,
              old:     order.order_status,
              new:     mappedStatus,
              changed: true,
              phone:   order.customer_number,
            });
          }

        } else if (!isDakazina && orisjayApiKey) {
          console.log(`[sync] Checking Orisjay — order=${order.id} ref=${order.provider_reference} network=${network}`);
          const result = await checkOrisjayStatus(order.provider_reference, orisjayApiKey);
          rawStatus   = result.status;
          rawResponse = result.raw;

          if (!rawStatus) {
            console.warn(`[sync] Orisjay: no status field for ref=${order.provider_reference} — response: ${rawResponse.slice(0, 200)}`);
            errors++;
            continue;
          }

          const mappedStatus = mapOrisjayStatus(rawStatus);
          console.log(`[sync] Orisjay status for ${order.id}: "${rawStatus}" → "${mappedStatus}"`);

          if (order.order_status === mappedStatus) {
            results.push({ id: order.id, ref: order.provider_reference, status: mappedStatus, changed: false });
            continue;
          }

          const { error: upErr } = await supabase
            .from("orders")
            .update({ order_status: mappedStatus, updated_at: new Date().toISOString() })
            .eq("id", order.id);

          if (upErr) {
            console.error(`[sync] Orisjay update failed ${order.id}: ${upErr.message}`);
            errors++;
            results.push({ id: order.id, ref: order.provider_reference, error: upErr.message });
          } else {
            console.log(`[sync] UPDATED ${order.id}: "${order.order_status}" → "${mappedStatus}" | ref=${order.provider_reference}`);
            updated++;
            results.push({
              id:      order.id,
              ref:     order.provider_reference,
              old:     order.order_status,
              new:     mappedStatus,
              changed: true,
              phone:   order.customer_number,
            });
          }

        } else {
          // No matching API key for this order's provider — skip silently
          skipped++;
          continue;
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

    const elapsed      = ((Date.now() - startTime) / 1000).toFixed(1);
    const processedCount = results.length + skipped;
    const hasMore      = orders.length === BATCH_SIZE;
    const nextOffset   = hasMore ? batchOffset + BATCH_SIZE : 0;

    console.log(
      `[sync] Done in ${elapsed}s. offset=${batchOffset} checked=${processedCount} updated=${updated} skipped=${skipped} errors=${errors} hasMore=${hasMore}`
    );

    return new Response(
      JSON.stringify({
        success:        true,
        batch_offset:   batchOffset,
        batch_size:     BATCH_SIZE,
        checked:        processedCount,
        updated,
        skipped,
        errors,
        has_more:       hasMore,
        next_offset:    nextOffset,
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
