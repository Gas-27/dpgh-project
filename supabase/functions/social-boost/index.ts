import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EXOBOOST_API_URL = "https://exosupplier.com/api/v2";
const ACTIONS = new Set(["services", "add", "status", "refill", "refill_status", "cancel", "balance"]);
const REQUIRED_FIELDS: Record<string, string[]> = {
  services: [], balance: [], add: ["service", "link", "quantity"], status: ["order"], refill: ["order"], refill_status: ["refill"], cancel: ["orders"],
};

// Provider errors that are NOT the customer's fault (our key, our supplier balance, rate limits,
// outages). These keep the order pending so it can be retried instead of refunding the customer.
const RETRYABLE_PROVIDER_ERRORS = /not enough funds|insufficient|balance temporarily|rate limit|too many requests|maintenance|temporar|try again|timeout|timed out|server error|service unavailable|bad gateway|gateway timeout/i;

function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function asFormValue(value: unknown) { if (typeof value === "string" || typeof value === "number") return String(value); return null; }

// deno-lint-ignore no-explicit-any
type SupabaseAdmin = any;

// Marks an order the provider permanently rejected as failed and refunds the buyer.
// Setting provider_status to "canceled" fires the existing refund trigger, and the explicit RPC call
// below is idempotent (refunded_at) and surfaces any refund error. If the refund fails, the order is
// put back to pending so no money is ever lost and nothing is left half-done.
async function failAndRefundOrder(supabase: SupabaseAdmin, orderNumber: unknown, reason: string) {
  const { data: order, error: failError } = await supabase
    .from("social_boost_orders")
    .update({ status: "failed", provider_status: "canceled" })
    .eq("order_number", orderNumber)
    .is("provider_order_id", null)
    .is("refunded_at", null)
    .select("id")
    .maybeSingle();
  if (failError || !order) {
    console.error(JSON.stringify({ event: "provider_rejection_mark_failed_error", order: orderNumber, error: failError?.message ?? "order not found or already processed" }));
    return false;
  }
  const { error: refundError } = await supabase.rpc("refund_cancelled_social_boost_order", { p_order_id: order.id });
  const { data: after } = await supabase.from("social_boost_orders").select("refunded_at,refund_amount").eq("id", order.id).maybeSingle();
  if (refundError || !after?.refunded_at) {
    await supabase.from("social_boost_orders").update({ status: "pending", provider_status: null }).eq("id", order.id).is("refunded_at", null);
    console.error(JSON.stringify({ event: "provider_rejection_refund_failed", order: orderNumber, reason, error: refundError?.message ?? "refund did not complete" }));
    return false;
  }
  console.warn(JSON.stringify({ event: "provider_rejection_refunded", order: orderNumber, reason, refund_amount: after.refund_amount }));
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST for Social Boost requests." }, 405);
  const providerApiKey = Deno.env.get("EXOBOOST_API_KEY");
  if (!providerApiKey) return json({ error: "Social Boost is not configured." }, 500);
  let input: Record<string, unknown>;
  try { input = await req.json(); } catch { return json({ error: "Request body must be valid JSON." }, 400); }
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!bearer) return json({ error: "Authentication is required." }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: apiUser } = await supabase.from("api_users").select("id,identity_id,api_wallet,wallet,active,order_count").eq("api_key", bearer).maybeSingle();
  let actorUserId: string | null = null;
  const isApiUser = Boolean(apiUser?.active);
  if (!isApiUser) { const { data: authData } = await supabase.auth.getUser(bearer); actorUserId = authData.user?.id ?? null; if (!actorUserId) return json({ error: "Invalid or expired authentication." }, 401); }
  const action = typeof input.action === "string" ? input.action : "";
  if (!ACTIONS.has(action)) return json({ error: "Unsupported action.", allowedActions: [...ACTIONS] }, 400);
  const missing = REQUIRED_FIELDS[action].filter((field) => asFormValue(input[field]) === null);
  if (missing.length > 0) return json({ error: "Missing required fields.", missing }, 400);
  const walletOrderNumber = typeof input.wallet_order_number === "string" ? input.wallet_order_number.trim() : "";
  const isWalletHandoff = action === "add" && !isApiUser && input.payment_method === "wallet" && Boolean(walletOrderNumber);
  if (action === "add" && !isApiUser && !isWalletHandoff) return json({ error: "Payment is required before creating a Social Boost order." }, 402);
  if (isWalletHandoff) {
    const { data: walletOrder } = await supabase.from("social_boost_orders").select("order_number, user_id, provider_order_id, status, service, target_link, quantity").eq("order_number", walletOrderNumber).eq("user_id", actorUserId).maybeSingle();
    if (!walletOrder || walletOrder.provider_order_id || ["failed", "cancelled", "refunded"].includes(String(walletOrder.status))) return json({ error: "Wallet order is invalid or already processed." }, 409);
    input.order = walletOrder.order_number;
    input.service = String(walletOrder.service).split(":", 1)[0].trim();
    input.link = String(walletOrder.target_link);
    input.quantity = Number(walletOrder.quantity);
  }
  let chargedAmount = 0;
  if (action === "services") {
    const { data: catalog, error: catalogError } = await supabase.from("social_boost_service_pricing").select("service_id,service_name,category,admin_price_per_1000,min_quantity,max_quantity,average_completion_time,notes").order("category").order("service_id");
    if (catalogError) return json({ error: "Could not load Social Boost service catalog." }, 500);
    return json({ services: (catalog ?? []).map((service) => ({ id: service.service_id, name: service.service_name, category: service.category, base_price_per_1000: service.admin_price_per_1000, min_quantity: service.min_quantity, max_quantity: service.max_quantity, average_completion_time: service.average_completion_time, notes: service.notes })) });
  }
  if (action === "add" && !isWalletHandoff) {
    const quantity = Number(input.quantity); if (!Number.isInteger(quantity) || quantity <= 0) return json({ error: "quantity must be a positive integer." }, 400);
    const serviceLookup = String(input.service);
    const { data: configuredService } = await supabase.from("social_boost_service_pricing").select("service_id,service_name,admin_price_per_1000,default_price_per_1000,min_quantity,max_quantity").or(`service_id.eq.${serviceLookup},service_name.ilike.${serviceLookup}`).maybeSingle();
    const pricePer1000 = Number(configuredService?.admin_price_per_1000 ?? 0); const minimum = Number(configuredService?.min_quantity ?? 1); const maximum = Number(configuredService?.max_quantity ?? 1000000);
    if (!configuredService || !Number.isFinite(pricePer1000) || pricePer1000 <= 0) return json({ error: "Service is not available for API ordering." }, 400);
    if (quantity < minimum || quantity > maximum) return json({ error: `quantity must be between ${minimum} and ${maximum}.` }, 400);
    const amount = Math.round((quantity / 1000) * pricePer1000 * 100) / 100; chargedAmount = amount;
    if (isApiUser) {
      const walletBalance = Number(apiUser.api_wallet ?? apiUser.wallet ?? 0); if (walletBalance < amount) return json({ error: "Insufficient API wallet balance.", balance: walletBalance, required: amount }, 402);
      const { data: order, error: orderError } = await supabase.from("social_boost_orders").insert({ user_id: apiUser.identity_id, owner_type: "api", owner_store_id: null, platform: String(input.platform ?? "social"), service: String(configuredService.service_id), target_link: String(input.link), quantity, price_per_1000: pricePer1000, amount, payment_method: "api_wallet", status: "processing" }).select("id,order_number").single();
      if (orderError || !order) return json({ error: "Could not create Social Boost order." }, 500);
      const { error: debitError } = await supabase.from("api_users").update({ api_wallet: walletBalance - amount, api_wallet_updated_at: new Date().toISOString(), order_count: Number(apiUser.order_count ?? 0) + 1 }).eq("id", apiUser.id).eq("api_wallet", walletBalance);
      if (debitError) { await supabase.from("social_boost_orders").delete().eq("id", order.id); return json({ error: "Could not debit API wallet." }, 409); }
      input.order = order.order_number;
    }
    chargedAmount = amount;
  }
  const providerInput = { ...input };
  delete providerInput.wallet_order_number;
  delete providerInput.payment_method;

  if (action === "add" && typeof providerInput.service === "string") {
    const serviceId = providerInput.service.split(":", 1)[0].trim();
    if (!/^\d+$/.test(serviceId)) {
      return json({ error: "Invalid Social Boost service ID." }, 400);
    }
    providerInput.service = serviceId;
  }
  const body = new URLSearchParams({ key: providerApiKey, action }); for (const [field, value] of Object.entries(providerInput)) { if (field === "action" || field === "key") continue; const formValue = asFormValue(value); if (formValue !== null) body.set(field, formValue); }
  let upstream: Response | null = null; let lastNetworkError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      upstream = await fetch(EXOBOOST_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
        signal: controller.signal,
      });

      const retryableStatus =
        upstream.status === 408 ||
        upstream.status === 425 ||
        upstream.status === 429 ||
        upstream.status >= 500;

      if (!retryableStatus || attempt === 3) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
    } catch (error) {
      lastNetworkError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  if (!upstream) {
    if (action === "add" && input.order) {
      await supabase
        .from("social_boost_orders")
        .update({ status: "pending" })
        .eq("order_number", input.order)
        .is("provider_order_id", null);
    }
    console.error(JSON.stringify({ event: "provider_unreachable_after_retries", order: input.order ?? null, error: String(lastNetworkError ?? "unknown") }));
    return json({ error: "ExoBoost is temporarily unavailable. The order was preserved for retry.", retryable: true }, 503);
  }
  const text = await upstream.text();
  let payload: unknown = text;
  try {
    payload = JSON.parse(text);
  } catch {
    // Keep the raw response when ExoBoost does not return JSON.
  }
  if (
    !upstream.ok ||
    (payload && typeof payload === "object" && "error" in payload)
  ) {
    const providerError = String((payload as { error?: unknown })?.error ?? "").slice(0, 200);

    if (action === "add" && input.order) {
      const transient =
        upstream.status >= 500 ||
        [408, 425, 429].includes(upstream.status) ||
        RETRYABLE_PROVIDER_ERRORS.test(providerError);

      if (!transient) {
        const refunded = await failAndRefundOrder(supabase, input.order, providerError || `HTTP ${upstream.status}`);
        if (refunded) {
          return json(
            {
              error: "Social Boost provider rejected this order. It has been cancelled and refunded.",
              refunded: true,
              provider_message: providerError || null,
            },
            422,
          );
        }
      }

      await supabase
        .from("social_boost_orders")
        .update({ status: "pending" })
        .eq("order_number", input.order)
        .is("provider_order_id", null)
        .is("refunded_at", null);
    }

    console.error(JSON.stringify({
      event: "provider_add_failed",
      order: input.order ?? null,
      http_status: upstream.status,
      provider_error: providerError,
      retryable: transient,
    }));
    return json(
      {
        error: transient
          ? "Social Boost provider is temporarily unavailable. The order remains pending for retry."
          : "Social Boost provider rejected the order. It could not be refunded automatically.",
        provider_message: providerError || null,
        retryable: transient,
      },
      transient ? 503 : upstream.status >= 400 ? upstream.status : 422,
    );
  }

  if (action === "add" && input.order) {
    const providerOrderId = (payload as { order?: unknown })?.order;

    if (
      typeof providerOrderId !== "string" &&
      typeof providerOrderId !== "number"
    ) {
      await supabase
        .from("social_boost_orders")
        .update({ status: "pending" })
        .eq("order_number", input.order)
        .is("provider_order_id", null);

      return json(
        { error: "Provider did not return an order ID; order saved for retry." },
        502,
      );
    }

    const { error: saveError } = await supabase
      .from("social_boost_orders")
      .update({
        provider_order_id: String(providerOrderId),
        status: "processing",
        provider_status: "processing",
      })
      .eq("order_number", input.order)
      .is("provider_order_id", null);

    if (saveError) {
      console.error(
        JSON.stringify({
          event: "provider_order_id_save_failed",
          order: input.order,
          provider_order_id: String(providerOrderId),
          error: saveError.message,
        }),
      );

      return json(
        {
          error: "Provider order was created but could not be saved locally.",
          provider_order_id: String(providerOrderId),
        },
        500,
      );
    }
  }

  if (action === "status" && payload && typeof payload === "object" && typeof (payload as { status?: unknown }).status === "string") {
    const live = payload as { status: string; start_count?: unknown; remains?: unknown };
    const providerStatus = live.status.trim().toLowerCase();
    const localStatus = ["completed", "complete", "delivered"].includes(providerStatus)
      ? "completed"
      : ["canceled", "cancelled", "failed", "failure"].includes(providerStatus)
        ? "failed"
        : "processing";
    await supabase.from("social_boost_orders").update({ status: localStatus, provider_status: live.status, start_count: live.start_count == null ? null : Number(live.start_count), remains: live.remains == null ? null : Number(live.remains) }).eq("provider_order_id", String(input.order));
  }
  return json(payload, upstream.status);
});
