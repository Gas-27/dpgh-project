import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadProviders, resolveActionProvider, resolveRoute } from "../_shared/social-boost-providers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ACTIONS = new Set(["services", "add", "status", "refill", "refill_status", "cancel", "balance", "provider_status"]);
const REQUIRED_FIELDS: Record<string, string[]> = {
  services: [], balance: [], provider_status: [], add: ["service", "link", "quantity"], status: ["order"], refill: ["order"], refill_status: ["refill"], cancel: ["orders"],
};

// Provider errors that are NOT the customer's fault (our key, our supplier balance, rate limits,
// outages). These keep the order pending so it can be retried instead of refunding the customer.
const RETRYABLE_PROVIDER_ERRORS = /api key|not enough funds|insufficient|balance|rate limit|too many|maintenance|temporar|try again|timeout|timed out|server error|service unavailable|bad gateway|gateway timeout|unauthori[sz]ed|forbidden/i;

function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function asFormValue(value: unknown) { if (typeof value === "string" || typeof value === "number") return String(value); return null; }

// deno-lint-ignore no-explicit-any
type SupabaseAdmin = any;

const textEncoder = new TextEncoder();

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

// Compares fixed-length digests so the comparison time does not leak how much of the secret matched.
async function sameSecret(a: string, b: string) {
  if (!a || !b) return false;
  const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", textEncoder.encode(a)), crypto.subtle.digest("SHA-256", textEncoder.encode(b))]);
  const xa = new Uint8Array(x);
  const ya = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < xa.length; i += 1) diff |= xa[i] ^ ya[i];
  return diff === 0;
}

// True only for a genuine service credential: an exact key match, or a JWT whose HS256 signature verifies.
// The role claim of an unsigned or unverified token is never trusted.
async function isServiceBearer(bearer: string) {
  if (await sameSecret(bearer, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "")) return true;
  if (await sameSecret(bearer, Deno.env.get("SUPABASE_SECRET_KEY") ?? "")) return true;
  const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET");
  const parts = bearer.split(".");
  if (!jwtSecret || parts.length !== 3) return false;
  try {
    const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[0])));
    if (header.alg !== "HS256") return false;
    const key = await crypto.subtle.importKey("raw", textEncoder.encode(jwtSecret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, base64UrlToBytes(parts[2]), textEncoder.encode(`${parts[0]}.${parts[1]}`));
    if (!valid) return false;
    const claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[1])));
    return claims.role === "service_role" && (claims.exp == null || Number(claims.exp) * 1000 > Date.now());
  } catch {
    return false;
  }
}

// Only one caller may submit a given order to ExoBoost at a time. The claim is a single atomic UPDATE,
// so a double-click, an overlapping cron run, or a webhook retry cannot send the same order twice.
// A claim older than 10 minutes is treated as abandoned (the caller crashed before releasing it).
async function claimOrderForProvider(supabase: SupabaseAdmin, orderNumber: unknown) {
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("social_boost_orders")
    .update({ provider_claimed_at: new Date().toISOString() })
    .eq("order_number", orderNumber)
    .is("provider_order_id", null)
    .is("refunded_at", null)
    .or(`provider_claimed_at.is.null,provider_claimed_at.lt.${staleBefore}`)
    .select("order_number")
    .maybeSingle();
  return Boolean(data);
}

async function releaseProviderClaim(supabase: SupabaseAdmin, orderNumber: unknown) {
  await supabase.from("social_boost_orders").update({ provider_claimed_at: null }).eq("order_number", orderNumber).is("provider_order_id", null);
}

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
  let input: Record<string, unknown>;
  try { input = await req.json(); } catch { return json({ error: "Request body must be valid JSON." }, 400); }
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!bearer) return json({ error: "Authentication is required." }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  if (input.action === "retry_pending") {
    if (!(await isServiceBearer(bearer))) return json({ error: "Forbidden." }, 403);
    const { data: stuck, error: stuckError } = await supabase.from("social_boost_orders").select("order_number,platform,service,target_link,quantity").is("provider_order_id", null).is("refunded_at", null).eq("status", "pending").lt("created_at", new Date(Date.now() - 3 * 60 * 1000).toISOString()).order("order_number").limit(10);
    if (stuckError) return json({ error: stuckError.message }, 500);
    const results: Record<string, unknown>[] = [];
    for (const order of stuck ?? []) {
      const { data: linkError } = await supabase.rpc("validate_social_boost_link", { p_platform: order.platform, p_link: order.target_link });
      if (linkError) { results.push({ order: order.order_number, skipped: String(linkError) }); continue; }
      if (/comment/i.test(String(order.service))) { results.push({ order: order.order_number, skipped: "custom comments need manual handling" }); continue; }
      const resolved = await resolveRoute(supabase, order.service);
      if ("error" in resolved) { results.push({ order: order.order_number, skipped: resolved.error }); continue; }
      const { route } = resolved;
      if (!(await claimOrderForProvider(supabase, order.order_number))) { results.push({ order: order.order_number, skipped: "already being submitted" }); continue; }
      try {
        const res = await fetch(route.provider.api_url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams({ key: route.apiKey, action: "add", service: route.providerServiceId, link: String(order.target_link), quantity: String(order.quantity) }), signal: AbortSignal.timeout(20000) });
        const raw = await res.text();
        let parsed: { order?: unknown; error?: unknown } = {};
        try { parsed = JSON.parse(raw); } catch { /* non-JSON reply */ }
        if (parsed.order == null) { await releaseProviderClaim(supabase, order.order_number); results.push({ order: order.order_number, failed: String(parsed.error ?? raw).slice(0, 200) }); continue; }
        let saveError: { message: string } | null = null;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          const { error } = await supabase.from("social_boost_orders").update({ provider_order_id: String(parsed.order), provider: route.provider.id, status: "processing", provider_status: "processing" }).eq("order_number", order.order_number).is("provider_order_id", null);
          saveError = error;
          if (!error) break;
        }
        if (saveError) console.error(JSON.stringify({ event: "provider_order_id_save_failed", order: order.order_number, provider_order_id: String(parsed.order), error: saveError.message }));
        results.push({ order: order.order_number, provider_order_id: String(parsed.order), saved: !saveError });
      } catch (error) {
        // The request may have reached the provider before failing, so the claim is kept and expires on its own.
        results.push({ order: order.order_number, failed: String(error) });
      }
    }
    return json({ processed: results.length, results });
  }
  const { data: apiUser } = await supabase.from("api_users").select("id,identity_id,api_wallet,wallet,active,order_count").eq("api_key", bearer).maybeSingle();
  let actorUserId: string | null = null;
  const isApiUser = Boolean(apiUser?.active);
  // The paystack-webhook calls this function with the service-role key after it has verified the payment.
  // Only an exact match counts: a JWT's payload is not signed-checked here, so its "role" claim cannot be trusted.
  const isServiceCaller = !isApiUser && (await isServiceBearer(bearer));
  if (!isApiUser && !isServiceCaller) { const { data: authData } = await supabase.auth.getUser(bearer); actorUserId = authData.user?.id ?? null; if (!actorUserId) return json({ error: "Invalid or expired authentication." }, 401); }
  const action = typeof input.action === "string" ? input.action : "";
  if (!ACTIONS.has(action)) return json({ error: "Unsupported action.", allowedActions: [...ACTIONS] }, 400);
  const missing = REQUIRED_FIELDS[action].filter((field) => asFormValue(input[field]) === null);
  if (missing.length > 0) return json({ error: "Missing required fields.", missing }, 400);
  // Status, refill and cancel act on supplier orders, so a caller may only touch orders they own.
  // Service callers and admins may act on any order. The supplier balance is never shown to customers.
  if (["status", "refill", "cancel", "balance"].includes(action) && !isServiceCaller) {
    const isAdmin = actorUserId ? Boolean((await supabase.rpc("has_role", { _user_id: actorUserId, _role: "admin" })).data) : false;
    if (!isAdmin) {
      if (action === "balance") {
        if (!isApiUser) return json({ error: "Forbidden." }, 403);
        return json({ balance: String(Number(apiUser?.api_wallet ?? apiUser?.wallet ?? 0).toFixed(2)), currency: "GHS" });
      }
      const requestedIds = String(input.order ?? input.orders ?? "").split(",").map((id) => id.trim()).filter(Boolean).slice(0, 50);
      const ownerId = isApiUser ? apiUser?.identity_id : actorUserId;
      if (requestedIds.length === 0 || !ownerId) return json({ error: "Forbidden." }, 403);
      const { data: ownedOrders } = await supabase.from("social_boost_orders").select("provider_order_id").eq("user_id", ownerId).in("provider_order_id", requestedIds);
      const ownedIds = new Set((ownedOrders ?? []).map((row: { provider_order_id: unknown }) => String(row.provider_order_id)));
      if (!requestedIds.every((id) => ownedIds.has(id))) return json({ error: "Order not found." }, 404);
    }
  }
  // order_number is a bigint, so clients send it as a number; accept both forms.
  const walletOrderNumber = typeof input.wallet_order_number === "string" || typeof input.wallet_order_number === "number" ? String(input.wallet_order_number).trim() : "";
  const isWalletHandoff = action === "add" && !isApiUser && input.payment_method === "wallet" && Boolean(walletOrderNumber);
  const paystackOrderNumber = typeof input.order === "string" || typeof input.order === "number" ? String(input.order).trim() : "";
  const isPaystackHandoff = action === "add" && isServiceCaller && input.payment_method === "paystack" && Boolean(paystackOrderNumber);
  if (action === "add" && !isApiUser && !isWalletHandoff && !isPaystackHandoff) return json({ error: "Payment is required before creating a Social Boost order." }, 402);
  if (isPaystackHandoff) {
    const { data: paidOrder } = await supabase.from("social_boost_orders").select("order_number, provider_order_id, status, service, target_link, quantity").eq("order_number", paystackOrderNumber).eq("payment_method", "paystack").maybeSingle();
    if (!paidOrder || paidOrder.provider_order_id || ["failed", "cancelled", "refunded"].includes(String(paidOrder.status))) return json({ error: "Paystack order is invalid or already processed." }, 409);
    input.order = paidOrder.order_number;
    input.service = String(paidOrder.service).split(":", 1)[0].trim();
    input.link = String(paidOrder.target_link);
    input.quantity = Number(paidOrder.quantity);
  }
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
    const { data: catalog, error: catalogError } = await supabase.from("social_boost_service_pricing").select("service_id,service_name,category,provider,admin_price_per_1000,min_quantity,max_quantity,average_completion_time,notes").order("category").order("service_id").range(0, 4999);
    if (catalogError) return json({ error: "Could not load Social Boost service catalog." }, 500);
    const exoFirst = (row: { provider?: string | null }) => (row.provider && row.provider !== "exoboost" ? 1 : 0);
    const sortedCatalog = [...(catalog ?? [])].sort((a, b) => String(a.category).localeCompare(String(b.category)) || exoFirst(a) - exoFirst(b) || Number(a.service_id) - Number(b.service_id));
    return json({ services: sortedCatalog.map((service) => ({ id: service.service_id, name: service.service_name, category: service.category, base_price_per_1000: service.admin_price_per_1000, min_quantity: service.min_quantity, max_quantity: service.max_quantity, average_completion_time: service.average_completion_time, notes: service.notes })) });
  }
  if (action === "provider_status") {
    if (!actorUserId) return json({ error: "Admin access required." }, 403);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: actorUserId, _role: "admin" });
    if (!isAdmin) return json({ error: "Admin access required." }, 403);
    const providers = await loadProviders(supabase);
    const report = await Promise.all(providers.map(async (provider) => {
      const apiKey = Deno.env.get(provider.api_key_env);
      if (!apiKey) return { id: provider.id, key_configured: false, key_env: provider.api_key_env, balance: null, currency: null, error: `Add the ${provider.api_key_env} secret to this Supabase project.` };
      try {
        const res = await fetch(provider.api_url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams({ key: apiKey, action: "balance" }), signal: AbortSignal.timeout(10000) });
        const data = await res.json().catch(() => ({}));
        if (data?.balance == null) return { id: provider.id, key_configured: true, key_env: provider.api_key_env, balance: null, currency: null, error: String(data?.error ?? `HTTP ${res.status}`).slice(0, 200) };
        return { id: provider.id, key_configured: true, key_env: provider.api_key_env, balance: String(data.balance), currency: data.currency ? String(data.currency) : null, error: null };
      } catch (error) {
        return { id: provider.id, key_configured: true, key_env: provider.api_key_env, balance: null, currency: null, error: `Could not reach ${provider.label}: ${String(error).slice(0, 120)}` };
      }
    }));
    return json({ providers: report });
  }
  let target: { id: string; label: string; url: string; key: string };
  let providerServiceId = "";
  if (action === "add") {
    const resolved = await resolveRoute(supabase, input.service);
    if ("error" in resolved) return json({ error: resolved.error, retryable: resolved.retryable }, resolved.status);
    target = { id: resolved.route.provider.id, label: resolved.route.provider.label, url: resolved.route.provider.api_url, key: resolved.route.apiKey };
    providerServiceId = resolved.route.providerServiceId;
  } else {
    const resolved = await resolveActionProvider(supabase, input);
    if ("error" in resolved) return json({ error: resolved.error, retryable: resolved.retryable }, resolved.status);
    target = { id: resolved.provider.id, label: resolved.provider.label, url: resolved.provider.api_url, key: resolved.apiKey };
  }
  if (action === "add" && !isWalletHandoff && !isPaystackHandoff) {
    const quantity = Number(input.quantity); if (!Number.isInteger(quantity) || quantity <= 0) return json({ error: "quantity must be a positive integer." }, 400);
    const serviceLookup = String(input.service).split(":", 1)[0].trim();
    // Names repeat across providers, so orders are matched on the numeric service ID only.
    if (!/^\d+$/.test(serviceLookup)) return json({ error: "service must be the numeric service id returned by the services action." }, 400);
    const { data: configuredService } = await supabase.from("social_boost_service_pricing").select("service_id,service_name,admin_price_per_1000,default_price_per_1000,min_quantity,max_quantity").eq("service_id", serviceLookup).maybeSingle();
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
  delete providerInput.provider;

  if (action === "add") providerInput.service = providerServiceId;
  if (action === "add" && input.order) {
    const claimed = await claimOrderForProvider(supabase, input.order);
    if (!claimed) return json({ error: "This order is already being submitted or has already been sent.", duplicate_prevented: true }, 409);
  }
  const body = new URLSearchParams({ key: target.key, action }); for (const [field, value] of Object.entries(providerInput)) { if (field === "action" || field === "key") continue; const formValue = asFormValue(value); if (formValue !== null) body.set(field, formValue); }
  let upstream: Response | null = null; let lastNetworkError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      upstream = await fetch(target.url, {
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
        .update({ status: "pending", provider_claimed_at: null })
        .eq("order_number", input.order)
        .is("provider_order_id", null);
    }
    console.error(JSON.stringify({ event: "provider_unreachable_after_retries", order: input.order ?? null, error: String(lastNetworkError ?? "unknown") }));
    return json({ error: `${target.label} is temporarily unavailable. The order was preserved for retry.`, retryable: true }, 503);
  }
  const text = await upstream.text();
  if (action === "add") console.log(JSON.stringify({ event: "provider_add_response", order: input.order ?? null, http_status: upstream.status, raw_body: text.slice(0, 1000) }));
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
    const providerError = String((payload as { error?: unknown })?.error ?? text ?? "").slice(0, 1000);
    const transient =
      upstream.status >= 500 ||
      [401, 403, 408, 425, 429].includes(upstream.status) ||
      RETRYABLE_PROVIDER_ERRORS.test(providerError);

    if (action === "add" && input.order) {
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
        .update({ status: "pending", provider_claimed_at: null })
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
        .update({ status: "pending", provider_claimed_at: null })
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
        provider: target.id,
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
    // Provider order IDs are only unique per provider; orders saved before routing existed have provider = null (ExoBoost).
    const ownedByTarget = supabase.from("social_boost_orders").update({ status: localStatus, provider_status: live.status, start_count: live.start_count == null ? null : Number(live.start_count), remains: live.remains == null ? null : Number(live.remains) }).eq("provider_order_id", String(input.order));
    await (target.id === "exoboost" ? ownedByTarget.or("provider.is.null,provider.eq.exoboost") : ownedByTarget.eq("provider", target.id));
  }
  return json(payload, upstream.status);
});
