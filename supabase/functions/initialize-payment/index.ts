import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { BLOCKED_MESSAGE, containsBlockedNumber } from "../_shared/blocklist.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYSTACK_FEE_PERCENT = 1.98;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, phone, metadata: requestMetadata, callback_url, amount: requestedAmount } = await req.json();
    if (await containsBlockedNumber(phone, requestMetadata)) {
      return new Response(JSON.stringify({ error: BLOCKED_MESSAGE }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const authHeader = req.headers.get("Authorization");
    let sessionUserId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const authClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await authClient.auth.getUser();
      sessionUserId = user?.id ?? null;
    }
    const isStorefrontPurchase = Boolean(
      requestMetadata?.agent_store_id ||
      requestMetadata?.subagent_store_id ||
      requestMetadata?.subsubagent_store_id
    );
    const metadata = isStorefrontPurchase
      ? { ...(requestMetadata || {}) }
      : {
          ...(requestMetadata || {}),
          // For normal User Dashboard and Packages purchases, the signed-in
          // Supabase session is authoritative and both legacy ownership keys
          // are populated for existing dashboard/report queries.
          user_id: sessionUserId,
          customer_id: sessionUserId,
        };
    if (!isStorefrontPurchase && metadata?.type !== "social_boost" && !sessionUserId) {
      return new Response(JSON.stringify({ error: "Please sign in again before starting this payment." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    console.log("[PAYMENT] Payment type:", metadata?.type, "storefront:", isStorefrontPurchase);
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      console.error("PAYSTACK_SECRET_KEY not set");
      return new Response(JSON.stringify({ error: "Paystack not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================
    // PAYSTACK STOREFRONT -> KORBA PAYMENT
    // =====================================
    if (metadata?.type === "storefront_korba_purchase") {
      const productType = String(metadata.product_type || "").toLowerCase();
      const supportedProducts = ["data", "airtime", "ecg", "water", "startimes", "gotv", "dstv"];
      const purchaseAmount = Number(metadata.amount ?? requestedAmount);
      const customerNumber = String(metadata.customer_number || "").replace(/\s+/g, "");
      const sellerStoreId = String(metadata.seller_store_id || "").trim();
      const sellerStoreKind = String(metadata.seller_store_kind || "").trim().toLowerCase();
      const isUtility = ["ecg", "water", "startimes", "gotv", "dstv"].includes(productType);
      const jsonError = (error: string, status = 400) => new Response(JSON.stringify({ error }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      if (!supportedProducts.includes(productType)) return jsonError("Unsupported Korba product");
      if (!Number.isFinite(purchaseAmount) || purchaseAmount <= 0 || purchaseAmount > 5000) return jsonError("Enter an amount between GHC 0.01 and GHC 5,000");
      if (!customerNumber) return jsonError("Customer number is required");
      if (!isUtility && !/^0[235]\d{8}$/.test(customerNumber)) return jsonError("Enter a valid Ghana phone number");
      if (productType === "data" && (!metadata.network_code || !metadata.package_code)) return jsonError("Select a data bundle");
      if (productType === "ecg" && (!metadata.meter_id || !metadata.meter_number || !metadata.phone_number)) return jsonError("Verify the ECG meter before paying");
      if (!["agent", "subagent", "subsubagent"].includes(sellerStoreKind) || !sellerStoreId) return jsonError("Storefront information is missing");

      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const storeTable = sellerStoreKind === "agent" ? "agent_stores" : sellerStoreKind === "subagent" ? "subagent_stores" : "sub_subagent_stores";
      const { data: store, error: storeError } = await adminClient.from(storeTable).select("id").eq("id", sellerStoreId).maybeSingle();
      if (storeError || !store) return jsonError("Storefront not found", 404);

      const feeAmount = Math.round(purchaseAmount * (PAYSTACK_FEE_PERCENT / 100) * 100) / 100;
      const payerEmail = typeof email === "string" && /^\S+@\S+\.\S+$/.test(email) ? email : `${customerNumber}@guest.dataplug.app`;
      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: payerEmail,
          amount: Math.round((purchaseAmount + feeAmount) * 100),
          currency: "GHS",
          callback_url,
          metadata: {
            ...metadata,
            type: "storefront_korba_purchase",
            amount: purchaseAmount,
            fee_amount: feeAmount,
            customer_number: customerNumber,
            seller_store_kind: sellerStoreKind,
            seller_store_id: sellerStoreId,
            purchase_source: "storefront",
          },
        }),
      });
      const result = await paystackRes.json();
      if (!result.status) return jsonError(result.message || "Payment initialization failed");
      return new Response(JSON.stringify({ authorization_url: result.data.authorization_url, reference: result.data.reference, amount: purchaseAmount + feeAmount }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================
    // SOCIAL BOOST PAYMENT
    // ==========================
    if (metadata?.type === "social_boost" || metadata?.kind === "social_boost") {
      const serviceId = Number(metadata.service_id);
      const quantity = Number(metadata.quantity);
      let userId = String(metadata.user_id || sessionUserId || "").trim();
      const targetLink = String(metadata.target_link || "").trim();
      const isValidUserId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
      if (!Number.isInteger(serviceId) || !Number.isInteger(quantity) || quantity <= 0 || !targetLink || !email) {
        return new Response(JSON.stringify({ error: "Provide a valid Social Boost service, link, quantity, and email." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Guest checkouts keep the payer email only in Paystack/order metadata.
      // Never create or reuse an Auth user from a payment email; doing so can
      // make a customer's account appear to change after a Social Boost purchase.
      if (!isValidUserId) userId = "";
      const { data: serviceRow, error: serviceError } = await adminClient.from("social_boost_service_pricing").select("admin_price_per_1000,base_price_per_1000,default_price_per_1000,max_reseller_price_per_1000,min_quantity,max_quantity").eq("service_id", serviceId).maybeSingle();
      if (serviceError) {
        console.error("[SOCIAL BOOST] Service pricing lookup failed:", serviceError);
        return new Response(JSON.stringify({ error: "Unable to load Social Boost pricing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const minQuantity = Number(serviceRow?.min_quantity ?? 1);
      const maxQuantity = Number(serviceRow?.max_quantity ?? 100000000);
      if (quantity < minQuantity || quantity > maxQuantity) return new Response(JSON.stringify({ error: "Invalid Social Boost quantity" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: linkError, error: linkCheckError } = await adminClient.rpc("validate_social_boost_link", { p_platform: String(metadata.platform || ""), p_link: targetLink });
      if (linkCheckError) console.error("[SOCIAL BOOST] Link validation failed to run:", linkCheckError);
      if (typeof linkError === "string" && linkError) return new Response(JSON.stringify({ error: linkError }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const normalizeTarget = (value: string) => value.trim().toLowerCase().replace(/\/+$/, "");
      const terminalStatuses = ["completed", "complete", "canceled", "cancelled", "failed", "refunded", "partial"];
      const { data: sameServiceOrders } = await adminClient.from("social_boost_orders").select("target_link,provider_status,status").eq("user_id", userId).like("service", `${serviceId}:%`).order("created_at", { ascending: false }).limit(50);
      const hasActiveDuplicate = (sameServiceOrders ?? []).some((order: { target_link: string | null; provider_status: string | null; status: string | null }) => {
        if (normalizeTarget(String(order.target_link ?? "")) !== normalizeTarget(targetLink)) return false;
        const providerStatus = String(order.provider_status ?? "").trim().toLowerCase();
        const status = String(order.status ?? "").trim().toLowerCase();
        return !terminalStatuses.includes(providerStatus) && !terminalStatuses.includes(status);
      });
      if (hasActiveDuplicate) {
        return new Response(JSON.stringify({ code: "duplicate_order", error: "NOTICE: Make sure you do not have another order for the same link and service is not permitted while an active Social Boost order is processing. Please wait for it to be completed or cancelled or failed before ordering again. If an order becomes a duplicate, the system will cancel one of the orders." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const userPrice = Number(serviceRow?.admin_price_per_1000 ?? 0);
      const agentBasePrice = Number(serviceRow?.base_price_per_1000 ?? 0) > 0 ? Number(serviceRow?.base_price_per_1000) : userPrice;
      const defaultAgentPrice = Number(serviceRow?.default_price_per_1000 ?? 0) > 0 ? Number(serviceRow?.default_price_per_1000) : agentBasePrice;
      const maxResellerPrice = Number(serviceRow?.max_reseller_price_per_1000 ?? 0);
      if (!Number.isFinite(userPrice) || userPrice <= 0) return new Response(JSON.stringify({ error: "Social Boost price is not configured" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const sellerKind = ["agent", "subagent", "subsubagent"].includes(String(metadata.seller_store_kind)) ? String(metadata.seller_store_kind) : null;
      const sellerStoreId = typeof metadata.seller_store_id === "string" ? metadata.seller_store_id : null;
      let basePrice = userPrice;
      let sellingPrice = userPrice;
      if (sellerKind && sellerStoreId) {
        const table = sellerKind === "agent" ? "agent_stores" : sellerKind === "subagent" ? "subagent_stores" : "sub_subagent_stores";
        const { data: storeRow, error: storeError } = await adminClient.from(table).select("user_id").eq("id", sellerStoreId).maybeSingle();
        if (storeError) {
          console.error("[SOCIAL BOOST] Storefront lookup failed:", storeError);
          return new Response(JSON.stringify({ error: "Unable to load storefront pricing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (!storeRow) return new Response(JSON.stringify({ error: "Storefront not found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        basePrice = agentBasePrice;
        sellingPrice = defaultAgentPrice;
        if (storeRow.user_id) {
          const { data: customPrice, error: customPriceError } = await adminClient.from("social_boost_reseller_pricing").select("price_per_1000").eq("user_id", storeRow.user_id).eq("service_id", serviceId).maybeSingle();
          if (customPriceError) console.error("[SOCIAL BOOST] Custom storefront price lookup failed:", customPriceError);
          const candidate = Number(customPrice?.price_per_1000);
          if (Number.isFinite(candidate) && candidate >= agentBasePrice && (!maxResellerPrice || candidate <= maxResellerPrice)) sellingPrice = candidate;
        }
      }
      const baseAmount = Math.round((quantity / 1000) * basePrice * 100) / 100;
      const sellingAmount = Math.round((quantity / 1000) * sellingPrice * 100) / 100;
      const feeAmount = Math.round(sellingAmount * (PAYSTACK_FEE_PERCENT / 100) * 100) / 100;
      // Paystack truncates metadata at the first emoji (4-byte character), which breaks the JSON and makes the webhook see {}.
      const stripEmoji = (value: unknown) => typeof value === "string" ? value.replace(/[\u{10000}-\u{10FFFF}\uFE0F\u200D]/gu, "").replace(/\s+/g, " ").trim() : value;
      const rawSocialMetadata = { ...metadata, type: "social_boost", user_id: userId, provider_service_id: String(serviceId), target_link: targetLink, quantity, base_amount: baseAmount, selling_amount: sellingAmount, profit_amount: Math.max(0, sellingAmount - baseAmount), fee_amount: feeAmount };
      const socialMetadata = Object.fromEntries(Object.entries(rawSocialMetadata).map(([key, value]) => [key, key === "comments" ? value : stripEmoji(value)]));
      const socialReference = `SB_${Date.now()}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", { method: "POST", headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, reference: socialReference, amount: Math.round((sellingAmount + feeAmount) * 100), currency: "GHS", callback_url, metadata: socialMetadata }) });
      const result = await paystackRes.json();
      if (!result.status) return new Response(JSON.stringify({ error: result.message || "Social Boost payment initialization failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.log("[SOCIAL BOOST] Payment initialized:", result.data.reference, "user:", userId, "service:", serviceId, "qty:", quantity);
      return new Response(JSON.stringify({ authorization_url: result.data.authorization_url, reference: result.data.reference, amount: sellingAmount + feeAmount, base_amount: baseAmount, selling_amount: sellingAmount, profit_amount: Math.max(0, sellingAmount - baseAmount) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================
    // AFA BUNDLE PAYMENT
    // ==========================
    if (metadata?.type === "afa_bundle") {
      if (!requestedAmount || !email || !metadata?.afa_package_id) {
        return new Response(JSON.stringify({ error: "Missing required fields for AFA bundle payment" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Add 1.98% Paystack fee for AFA bundles
      const baseAmount = Number(requestedAmount);
      const feeAmount = baseAmount * 0.0198;
      const totalWithFee = Math.round((baseAmount + feeAmount) * 100) / 100;
      const amountInPesewas = Math.round(totalWithFee * 100);

      const afaMetadata: Record<string, unknown> = {
        type: "afa_bundle",
        afa_package_id: metadata.afa_package_id,
        customer_phone: phone,
        customer_name: metadata.customer_name || "",
        customer_id: metadata.customer_id || "",
        date_of_birth: metadata.date_of_birth || null,
        town: metadata.town || "",
        occupation: metadata.occupation || "",
        region: metadata.region || "",
        crop: metadata.crop || "",
        phone,
        base_amount: baseAmount,
        fee_amount: feeAmount,
      };

      // Add agent/subagent if provided
      if (metadata.agent_store_id) {
        afaMetadata.agent_store_id = metadata.agent_store_id;
      }
      if (metadata.subagent_store_id) {
        afaMetadata.subagent_store_id = metadata.subagent_store_id;
      }
      if (metadata.subsubagent_store_id) {
        afaMetadata.subsubagent_store_id = metadata.subsubagent_store_id;
      }

      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amountInPesewas,
          currency: "GHS",
          callback_url,
          metadata: afaMetadata,
        }),
      });

      const result = await paystackRes.json();

      if (!result.status) {
        console.error("Paystack AFA bundle error:", result);
        return new Response(JSON.stringify({ error: result.message || "AFA payment initialization failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        authorization_url: result.data.authorization_url,
        reference: result.data.reference,
        amount: totalWithFee,
        base_amount: baseAmount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================
    // AGENT REGISTRATION PAYMENT
    // ==========================
    if (metadata?.type === "agent_registration") {
      if (!requestedAmount || !email || !metadata?.agent_store_id) {
        return new Response(JSON.stringify({ error: "Missing required fields for agent registration" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amountInPesewas = Math.round(Number(requestedAmount) * 100);

      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amountInPesewas,
          currency: "GHS",
          callback_url,
          metadata: {
            ...metadata,
            phone,
          },
        }),
      });

      const result = await paystackRes.json();

      if (!result.status) {
        console.error("Paystack agent registration error:", result);
        return new Response(JSON.stringify({ error: result.message || "Payment initialization failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        authorization_url: result.data.authorization_url,
        reference: result.data.reference,
        amount: requestedAmount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================
    // SUBAGENT REGISTRATION PAYMENT
    // ==========================
    if (metadata?.type === "subagent_registration") {
      if (!requestedAmount || !email || !metadata?.subagent_registration_id || !metadata?.agent_store_id) {
        return new Response(JSON.stringify({ error: "Missing required fields for subagent registration" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amountInPesewas = Math.round(Number(requestedAmount) * 100);

      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amountInPesewas,
          currency: "GHS",
          callback_url,
          metadata: {
            ...metadata,
            phone,
          },
        }),
      });

      const result = await paystackRes.json();

      if (!result.status) {
        console.error("Paystack subagent registration error:", result);
        return new Response(JSON.stringify({ error: result.message || "Payment initialization failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        authorization_url: result.data.authorization_url,
        reference: result.data.reference,
        amount: requestedAmount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================
    // SPIN WHEEL PAYMENT
    // ==========================
    if (metadata?.type === "spin_wheel") {
      if (!requestedAmount || !email || !phone) {
        return new Response(JSON.stringify({ error: "Missing required fields for spin wheel payment" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amountInPesewas = Math.round(Number(requestedAmount) * 100);

      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amountInPesewas,
          currency: "GHS",
          callback_url,
          metadata: {
            ...metadata,
            phone,
          },
        }),
      });

      const result = await paystackRes.json();

      if (!result.status) {
        console.error("Paystack spin wheel error:", result);
        return new Response(JSON.stringify({ error: result.message || "Payment initialization failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        authorization_url: result.data.authorization_url,
        reference: result.data.reference,
        amount: requestedAmount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================
    // AGENT WALLET TOPUP
    // ==========================
    if (metadata?.type === "wallet_topup") {
      if (!requestedAmount || !email || !metadata?.agent_store_id) {
        return new Response(JSON.stringify({ error: "Missing required fields for wallet topup" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const baseAmount = Number(requestedAmount);
      const feeAmount = baseAmount * 0.0198;
      const totalWithFee = Math.round((baseAmount + feeAmount) * 100) / 100;
      const amountInPesewas = Math.round(totalWithFee * 100);

      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amountInPesewas,
          currency: "GHS",
          callback_url,
          metadata: {
            ...metadata,
            phone,
            base_amount: baseAmount,
            fee_amount: feeAmount,
          },
        }),
      });

      const result = await paystackRes.json();

      if (!result.status) {
        console.error("Paystack wallet topup error:", result);
        return new Response(JSON.stringify({ error: result.message || "Payment initialization failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        authorization_url: result.data.authorization_url,
        reference: result.data.reference,
        amount: totalWithFee,
        base_amount: baseAmount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================
    // SUBAGENT WALLET TOPUP
    // ==========================
    if (metadata?.type === "subagent_wallet_topup") {
      if (!requestedAmount || !email || !metadata?.subagent_store_id) {
        return new Response(JSON.stringify({ error: "Missing required fields for subagent wallet topup" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const baseAmount = Number(requestedAmount);
      const feeAmount = baseAmount * 0.0198;
      const totalWithFee = Math.round((baseAmount + feeAmount) * 100) / 100;
      const amountInPesewas = Math.round(totalWithFee * 100);

      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amountInPesewas,
          currency: "GHS",
          callback_url,
          metadata: {
            ...metadata,
            phone,
            base_amount: baseAmount,
            fee_amount: feeAmount,
          },
        }),
      });

      const result = await paystackRes.json();

      if (!result.status) {
        console.error("Paystack subagent wallet topup error:", result);
        return new Response(JSON.stringify({ error: result.message || "Payment initialization failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        authorization_url: result.data.authorization_url,
        reference: result.data.reference,
        amount: totalWithFee,
        base_amount: baseAmount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================
    // SUB-SUBAGENT WALLET TOPUP
    // ==========================
    if (metadata?.type === "subsubagent_wallet_topup") {
      if (!requestedAmount || !email || !metadata?.subsubagent_store_id) {
        return new Response(JSON.stringify({ error: "Missing required fields for sub-subagent wallet topup" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const baseAmount = Number(requestedAmount);
      const feeAmount = baseAmount * 0.0198;
      const totalWithFee = Math.round((baseAmount + feeAmount) * 100) / 100;
      const amountInPesewas = Math.round(totalWithFee * 100);

      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amountInPesewas,
          currency: "GHS",
          callback_url,
          metadata: {
            ...metadata,
            phone,
            base_amount: baseAmount,
            fee_amount: feeAmount,
          },
        }),
      });

      const result = await paystackRes.json();

      if (!result.status) {
        console.error("Paystack sub-subagent wallet topup error:", result);
        return new Response(JSON.stringify({ error: result.message || "Payment initialization failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        authorization_url: result.data.authorization_url,
        reference: result.data.reference,
        amount: totalWithFee,
        base_amount: baseAmount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================
    // AFA REGISTRATION PAYMENT
    // ==========================
    if (metadata?.type === "afa_registration") {
      if (!requestedAmount || !email) {
        return new Response(JSON.stringify({ error: "Missing required fields for AFA registration" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amountInPesewas = Math.round(Number(requestedAmount) * 100);

      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amountInPesewas,
          currency: "GHS",
          callback_url,
          metadata: {
            ...metadata,
            phone,
            // carry all three store IDs through to webhook
            agent_store_id: metadata.agent_store_id || null,
            subagent_store_id: metadata.subagent_store_id || null,
            subsubagent_store_id: metadata.subsubagent_store_id || null,
          },
        }),
      });

      const result = await paystackRes.json();

      if (!result.status) {
        return new Response(JSON.stringify({ error: result.message || "AFA registration payment initialization failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        authorization_url: result.data.authorization_url,
        reference: result.data.reference,
        amount: requestedAmount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ==========================
    // BULK ORDER PAYMENT
    // ==========================
    if (metadata?.type === "bulk_order") {
      if (!requestedAmount || !email || !metadata?.recipients || !metadata?.network) {
        return new Response(JSON.stringify({ error: "Missing required fields for bulk order" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amountInPesewas = Math.round(Number(requestedAmount) * 100);

      const bulkMetadata: Record<string, unknown> = {
        type: "bulk_order",
        network: metadata.network,
        recipients: JSON.stringify(metadata.recipients),
        total_gb: metadata.total_gb,
        recipient_count: metadata.recipient_count,
        phone: phone || metadata.recipients[0]?.phone,
        user_id: metadata.user_id,
      };

      if (metadata.agent_store_id) {
        bulkMetadata.agent_store_id = metadata.agent_store_id;
      }

      if (metadata.subagent_store_id) {
        bulkMetadata.subagent_store_id = metadata.subagent_store_id;
      }

      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amountInPesewas,
          currency: "GHS",
          callback_url,
          metadata: bulkMetadata,
        }),
      });

      const result = await paystackRes.json();

      if (!result.status) {
        console.error("Paystack bulk order error:", result);
        return new Response(JSON.stringify({ error: result.message || "Bulk payment initialization failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        authorization_url: result.data.authorization_url,
        reference: result.data.reference,
        amount: requestedAmount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ==========================
    // PUBLIC SMS CAMPAIGN PAYMENT
    // ==========================
    if (metadata?.type === "sms_campaign") {
      const recipients = Array.isArray(metadata.recipients)
        ? metadata.recipients
        : [];

      const senderId = String(metadata.sender_id || "").trim();
      const message = String(metadata.message || "").trim();

      const cleanPhone = String(phone || recipients[0] || "")
        .replace(/\D/g, "");

      const paymentEmail =
        String(email || `sms-${cleanPhone}@dataplug.store`)
          .trim()
          .toLowerCase();

      const baseAmount = Number(requestedAmount);

      if (
        !cleanPhone ||
        !/^\d{9,15}$/.test(cleanPhone) ||
        !paymentEmail ||
        !Number.isFinite(baseAmount) ||
        baseAmount <= 0 ||
        recipients.length === 0 ||
        !senderId ||
        !message
      ) {
        console.error("[SMS PAYMENT] Missing required fields", {
          hasPhone: Boolean(cleanPhone),
          recipientCount: recipients.length,
          hasSenderId: Boolean(senderId),
          hasMessage: Boolean(message),
          amount: baseAmount,
        });

        return new Response(
          JSON.stringify({
            error: "Missing required fields for SMS payment",
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      const feeAmount =
        Math.round(baseAmount * (PAYSTACK_FEE_PERCENT / 100) * 100) / 100;

      const totalAmount =
        Math.round((baseAmount + feeAmount) * 100) / 100;

      const requestedCallback =
        typeof callback_url === "string"
          ? callback_url.trim()
          : "";

      const safeCallback =
        /^https:\/\/(?!localhost|127\.0\.0\.1)[^\s]+$/i.test(
          requestedCallback
        )
          ? requestedCallback
          : "https://dataplug.store/packages";

      const paystackRes = await fetch(
        "https://api.paystack.co/transaction/initialize",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: paymentEmail,
            amount: Math.round(totalAmount * 100),
            currency: "GHS",
            callback_url: safeCallback,
            metadata: {
              type: "sms_campaign",
              recipients,
              sender_id: senderId,
              message,
              phone: cleanPhone,
              base_amount: baseAmount,
              fee_amount: feeAmount,
              owner_type: metadata.owner_type || "customer",
              owner_id: metadata.owner_id || null,
              user_id: metadata.user_id || null,
            },
          }),
        }
      );

      const rawPaystackResponse = await paystackRes.text();

      let paystackResult: any;

      try {
        paystackResult = JSON.parse(rawPaystackResponse);
      } catch {
        paystackResult = {
          message: rawPaystackResponse,
        };
      }

      if (
        !paystackRes.ok ||
        !paystackResult.status ||
        !paystackResult.data?.authorization_url
      ) {
        console.error("[SMS PAYMENT] Paystack initialization failed", {
          status: paystackRes.status,
          response: paystackResult,
        });

        return new Response(
          JSON.stringify({
            error:
              paystackResult.message ||
              "SMS payment initialization failed",
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      return new Response(
        JSON.stringify({
          authorization_url: paystackResult.data.authorization_url,
          reference: paystackResult.data.reference,
          amount: totalAmount,
          base_amount: baseAmount,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    // ==========================
    // DIGITAL SERVICE SUBSCRIPTION PAYMENT
    // ==========================
    if (
      metadata?.type === "service_payment" ||
      metadata?.type === "subscription" ||
      metadata?.service_payment === true ||
      metadata?.service_payment === "true"
    ) {
      const serviceId = String(metadata.service_id || "").trim();

      const customerPhone = String(
        metadata.customer_phone || phone || ""
      ).replace(/\D/g, "");

      const accessPin = String(
        metadata.access_pin || metadata.access_code || ""
      ).trim();

      const baseAmount = Number(requestedAmount);

      const paymentEmail = String(
        email || `customer-${customerPhone}@dataplug.store`
      )
        .trim()
        .toLowerCase();

      if (
        !serviceId ||
        !/^\d{10}$/.test(customerPhone) ||
        !/^\d{4}$/.test(accessPin) ||
        !Number.isFinite(baseAmount) ||
        baseAmount <= 0
      ) {
        console.error("[SUBSCRIPTION PAYMENT] Missing required fields", {
          serviceId,
          customerPhone,
          hasAccessPin: Boolean(accessPin),
          amount: baseAmount,
        });

        return new Response(
          JSON.stringify({
            error: "Missing required fields for subscription payment",
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      const feeAmount =
        Math.round(baseAmount * (PAYSTACK_FEE_PERCENT / 100) * 100) / 100;

      const totalAmount =
        Math.round((baseAmount + feeAmount) * 100) / 100;

      const subscriptionMetadata = {
        ...metadata,
        type: "service_payment",
        service_payment: true,
        service_id: serviceId,
        customer_phone: customerPhone,
        access_pin: accessPin,
        customer_id: metadata.customer_id || null,
        customer_name: metadata.customer_name || metadata.name || "",
        customer_email: paymentEmail,
        service_name: metadata.service_name || metadata.service_title || "Private-share subscription",
        service_link: metadata.service_link || metadata.link || "",
        service_type: metadata.service_type || "private_shared",
        private_delivery_mode: metadata.private_delivery_mode || "whatsapp",
        seller_store_kind: metadata.seller_store_kind || (metadata.subsubagent_store_id ? "subsubagent" : metadata.subagent_store_id ? "subagent" : metadata.agent_store_id ? "agent" : null),
        seller_store_id: metadata.seller_store_id || metadata.subsubagent_store_id || metadata.subagent_store_id || metadata.agent_store_id || null,
        agent_store_id: metadata.agent_store_id || null,
        subagent_store_id: metadata.subagent_store_id || null,
        subsubagent_store_id: metadata.subsubagent_store_id || null,
        base_amount: baseAmount,
        selling_price: baseAmount,
        fee_amount: feeAmount,
      };

      const paystackResponse = await fetch(
        "https://api.paystack.co/transaction/initialize",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: paymentEmail,
            amount: Math.round(totalAmount * 100),
            currency: "GHS",
            callback_url:
              callback_url ||
              "https://dataplug.store/packages?payment=subscription",
            metadata: subscriptionMetadata,
          }),
        }
      );

      const rawResponse = await paystackResponse.text();

      let paystackResult: any;

      try {
        paystackResult = JSON.parse(rawResponse);
      } catch {
        paystackResult = {
          message: rawResponse,
        };
      }

      if (
        !paystackResponse.ok ||
        !paystackResult.status ||
        !paystackResult.data?.authorization_url
      ) {
        console.error(
          "[SUBSCRIPTION PAYMENT] Paystack initialization failed",
          paystackResult
        );

        return new Response(
          JSON.stringify({
            error:
              paystackResult.message ||
              "Subscription payment initialization failed",
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      return new Response(
        JSON.stringify({
          authorization_url: paystackResult.data.authorization_url,
          reference: paystackResult.data.reference,
          amount: totalAmount,
          base_amount: baseAmount,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
    // ==========================
    // REGULAR PACKAGE PAYMENT
    // ==========================
    if (!email || !phone || !metadata?.package_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: packageData, error: packageError } = await supabaseClient
      .from("data_packages")
      .select("agent_price, price, size_gb, network")
      .eq("id", metadata.package_id)
      .single();

    if (packageError || !packageData) {
      console.error("Package not found:", metadata.package_id);
      return new Response(JSON.stringify({ error: "Package not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The dashboards apply admin overrides from agent_custom_base_prices before
    // displaying the Buy Data price. Paystack must use the same override instead
    // of falling back to data_packages.agent_price.
    let customAgentBasePrice: number | null = null;
    if (metadata.agent_store_id) {
      const { data: customPrice } = await supabaseClient
        .from("agent_custom_base_prices")
        .select("custom_base_price")
        .eq("agent_store_id", metadata.agent_store_id)
        .eq("package_id", metadata.package_id)
        .maybeSingle();
      if (customPrice?.custom_base_price != null) {
        customAgentBasePrice = Number(customPrice.custom_base_price);
      }
    }

    let baseAmount: number;
    let priceType: string;
    // ==========================
    // CHECK FOR SUBSUBAGENT FIRST
    // ==========================
    if (metadata.subsubagent_store_id) {
      // Step 1: check if the sub-subagent set their OWN customer-facing
      // price. This lives in `customer_sell_price` on this table, filtered
      // by their own id (`sub_subagent_store_id`). The `sell_price` column
      // on this same table is what the PARENT subagent charges THIS
      // sub-subagent (their cost) — using it here was the bug that made the
      // Paystack checkout show the subagent's price instead of the
      // sub-subagent's own configured price.
      const { data: subsubagentPrice } = await supabaseClient
        .from("sub_subagent_package_prices")
        .select("customer_sell_price")
        .eq("sub_subagent_store_id", metadata.subsubagent_store_id)
        .eq("package_id", metadata.package_id)
        .maybeSingle();

      if (subsubagentPrice?.customer_sell_price != null) {
        baseAmount = Number(subsubagentPrice.customer_sell_price);
        priceType = "subsubagent_customer_sell_price";
      } else {
        // No custom price: charge the "Cost from Agent" — 3-level hierarchy
        const { data: subsubStore } = await supabaseClient
          .from("sub_subagent_stores")
          .select("subagent_store_id, agent_store_id")
          .eq("id", metadata.subsubagent_store_id)
          .single();

        // Level 1: admin price (default)
        baseAmount = Number(packageData.price);
        priceType = "admin_user_price";

        // Level 2: parent subagent's own cost from their agent
        // (subagent_package_prices.base_price by agent_store_id)
        if (subsubStore?.agent_store_id) {
          const { data: agentCostRow } = await supabaseClient
            .from("subagent_package_prices")
            .select("base_price")
            .eq("agent_store_id", subsubStore.agent_store_id)
            .eq("package_id", metadata.package_id)
            .maybeSingle();
          if (agentCostRow?.base_price != null) {
            baseAmount = Number(agentCostRow.base_price);
            priceType = "parent_subagent_agent_cost";
          }
        }

        // Level 3: parent's sub-subagent template price (highest priority)
        // (sub_subagent_package_prices.base_price where sub_subagent_store_id IS NULL)
        if (subsubStore?.subagent_store_id) {
          const { data: templateRow } = await supabaseClient
            .from("sub_subagent_package_prices")
            .select("base_price")
            .eq("subagent_store_id", subsubStore.subagent_store_id)
            .is("sub_subagent_store_id", null)
            .eq("package_id", metadata.package_id)
            .maybeSingle();
          if (templateRow?.base_price != null) {
            baseAmount = Number(templateRow.base_price);
            priceType = "parent_subagent_template_cost";
          }
        }
      }
    } else if (metadata.subagent_store_id) {
      const { data: subagentPrice } = await supabaseClient
        .from("subagent_package_prices")
        .select("sell_price")
        .eq("subagent_store_id", metadata.subagent_store_id)
        .eq("package_id", metadata.package_id)
        .maybeSingle();

      if (subagentPrice?.sell_price != null) {
        baseAmount = Number(subagentPrice.sell_price);
        priceType = "subagent_sell_price";
      } else {
        const { data: subagentStore } = await supabaseClient
          .from("subagent_stores")
          .select("agent_store_id")
          .eq("id", metadata.subagent_store_id)
          .single();

        if (subagentStore?.agent_store_id) {
          const { data: agentPrice } = await supabaseClient
            .from("agent_package_prices")
            .select("sell_price")
            .eq("agent_store_id", subagentStore.agent_store_id)
            .eq("package_id", metadata.package_id)
            .maybeSingle();

          if (agentPrice?.sell_price != null) {
            baseAmount = Number(agentPrice.sell_price);
            priceType = "agent_sell_price_fallback";
          } else {
            baseAmount = customAgentBasePrice ?? Number(packageData.agent_price);
            priceType = customAgentBasePrice != null ? "custom_agent_base_price_fallback" : "agent_base_price_fallback";
          }
        } else {
          baseAmount = customAgentBasePrice ?? Number(packageData.agent_price);
          priceType = customAgentBasePrice != null ? "custom_agent_base_price_fallback" : "agent_base_price_fallback";
        }
      }
    } else if (metadata.agent_store_id) {
      const { data: agentPrice } = await supabaseClient
        .from("agent_package_prices")
        .select("sell_price")
        .eq("agent_store_id", metadata.agent_store_id)
        .eq("package_id", metadata.package_id)
        .maybeSingle();

      if (agentPrice?.sell_price != null && !metadata.use_agent_price) {
        baseAmount = Number(agentPrice.sell_price);
        priceType = "agent_sell_price";
      } else {
        baseAmount = customAgentBasePrice ?? Number(packageData.agent_price);
        priceType = customAgentBasePrice != null ? "custom_agent_base_price" : "agent_base_price";
      }
    } else {
      baseAmount = Number(packageData.price);
      priceType = "admin_user_price";
    }

    const feeAmount = baseAmount * (PAYSTACK_FEE_PERCENT / 100);
    const totalWithFee = baseAmount + feeAmount;
    const amountToCharge = Math.round(totalWithFee * 100) / 100;
    const amountInPesewas = Math.round(amountToCharge * 100);

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountInPesewas,
        currency: "GHS",
        callback_url,
        metadata: {
          ...metadata,
          phone,
          price_type: priceType,
          base_amount: baseAmount,
          fee_amount: feeAmount,
        },
      }),
    });

    const result = await paystackRes.json();

    if (!result.status) {
      console.error("Paystack error:", result);
      return new Response(JSON.stringify({ error: result.message || "Payment initialization failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      authorization_url: result.data.authorization_url,
      reference: result.data.reference,
      amount: amountToCharge,
      base_amount: baseAmount,
      fee_amount: feeAmount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Payment initialization error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
