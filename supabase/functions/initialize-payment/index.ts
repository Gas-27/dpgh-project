import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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
    const { email, phone, metadata, callback_url, amount: requestedAmount } = await req.json();
    console.log("[v0] Payment type:", metadata?.type);
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      console.error("PAYSTACK_SECRET_KEY not set");
      return new Response(JSON.stringify({ error: "Paystack not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==========================
    // PUBLIC SMS PAYMENT
    // ==========================
    if (metadata?.type === "sms_campaign") {
      const recipients = Array.isArray(metadata.recipients) ? metadata.recipients : [];
      const normalizedPhone = String(phone || recipients[0] || "").replace(/\D/g, "");
      const guestEmail = String(email || `guest-${normalizedPhone}@dataplug.store`).trim().toLowerCase();
      const baseAmount = Math.round(Number(requestedAmount) * 100) / 100;
      const requestedRedirect = typeof callback_url === "string" ? callback_url.trim() : "";
      const redirectUrl = /^https:\/\/(?!localhost|127\.0\.0\.1)[^\s]+$/i.test(requestedRedirect) ? requestedRedirect : "https://dataplug.store/packages";
      if (!normalizedPhone || !/^\d{9,15}$/.test(normalizedPhone) || !/^\S+@\S+\.\S+$/.test(guestEmail) || !Number.isFinite(baseAmount) || baseAmount <= 0 || !metadata.sender_id || !metadata.message || recipients.length === 0) {
        return new Response(JSON.stringify({ error: "Enter a valid phone number and complete the SMS details before payment." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const feeAmount = Math.round(baseAmount * (PAYSTACK_FEE_PERCENT / 100) * 100) / 100;
      const totalWithFee = Math.round((baseAmount + feeAmount) * 100) / 100;
      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", { method: "POST", headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ email: guestEmail, amount: Math.round(totalWithFee * 100), currency: "GHS", callback_url: redirectUrl, metadata: { ...metadata, type: "sms_campaign", phone: normalizedPhone, base_amount: baseAmount, fee_amount: feeAmount } }) });
      const raw = await paystackRes.text();
      let result: any = {};
      try { result = JSON.parse(raw); } catch { result = { message: raw }; }
      if (!paystackRes.ok || !result.status || !result.data?.authorization_url) return new Response(JSON.stringify({ error: result.message || "Paystack could not initialize this SMS payment." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ authorization_url: result.data.authorization_url, reference: result.data.reference, amount: totalWithFee, base_amount: baseAmount }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    // AFA REGISTRATION PAYMENT
    // ==========================
    if (metadata?.type === "afa_registration") {
      const {
        fullName, phoneNumber, idNumber, dateOfBirth,
        town, occupation, region, cropProduce,
        agent_store_id, subagent_store_id, subsubagent_store_id,
        base_amount, callback_url: cbUrl,
      } = metadata;

      if (!fullName || !phoneNumber || !idNumber || !dateOfBirth || !town || !occupation || !region || !cropProduce || !requestedAmount || !email) {
        return new Response(JSON.stringify({ error: "Missing required fields for AFA registration" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const baseAmount = Number(base_amount) || Number(requestedAmount);
      const feeAmount = baseAmount * (PAYSTACK_FEE_PERCENT / 100);
      const totalWithFee = Math.round((baseAmount + feeAmount) * 100) / 100;
      const amountInPesewas = Math.round(totalWithFee * 100);

      const afaRegMetadata: Record<string, unknown> = {
        type: "afa_registration",
        fullName, phoneNumber, idNumber, dateOfBirth,
        town, occupation, region, cropProduce,
        base_amount: baseAmount,
        callback_url: cbUrl || "",
      };
      if (agent_store_id)       afaRegMetadata.agent_store_id       = agent_store_id;
      if (subagent_store_id)    afaRegMetadata.subagent_store_id    = subagent_store_id;
      if (subsubagent_store_id) afaRegMetadata.subsubagent_store_id = subsubagent_store_id;

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
          callback_url: cbUrl || callback_url,
          metadata: afaRegMetadata,
        }),
      });

      const result = await paystackRes.json();

      if (!result.status) {
        console.error("Paystack AFA registration error:", result);
        return new Response(JSON.stringify({ error: result.message || "AFA registration payment initialization failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          authorization_url: result.data.authorization_url,
          reference: result.data.reference,
        },
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
    // DIGITAL SERVICE SUBSCRIPTION PAYMENT
    // ==========================
    // This branch must run before regular package validation because service
    // purchases use service_id, customer_phone, and access_pin instead of package_id.
    if (metadata?.type === "service_payment" || metadata?.service_payment === true || metadata?.service_payment === "true") {
      const serviceId = String(metadata.service_id || "").trim();
      const customerPhone = String(metadata.customer_phone || phone || "").replace(/\D/g, "");
      const accessPin = String(metadata.access_pin || "").trim();
      const baseAmount = Number(requestedAmount);
      const paymentEmail = String(email || `${customerPhone}@dataplug.store`).trim().toLowerCase();

      if (
        !serviceId ||
        !/^\d{10}$/.test(customerPhone) ||
        !/^\d{4}$/.test(accessPin) ||
        !/^\S+@\S+\.\S+$/.test(paymentEmail) ||
        !Number.isFinite(baseAmount) ||
        baseAmount <= 0
      ) {
        console.error("[SERVICE PAYMENT] Invalid metadata", {
          hasServiceId: Boolean(serviceId),
          phone: customerPhone,
          hasAccessPin: Boolean(accessPin),
          amount: baseAmount,
        });
        return new Response(JSON.stringify({ error: "Missing required fields for service payment" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const feeAmount = Math.round(baseAmount * (PAYSTACK_FEE_PERCENT / 100) * 100) / 100;
      const totalWithFee = Math.round((baseAmount + feeAmount) * 100) / 100;
      const serviceMetadata = {
        ...metadata,
        type: "service_payment",
        service_payment: true,
        service_id: serviceId,
        service_name: metadata.service_name || "",
        service_type: metadata.service_type || "",
        customer_phone: customerPhone,
        access_pin: accessPin,
        customer_id: metadata.customer_id || null,
        base_amount: baseAmount,
        fee_amount: feeAmount,
      };

      const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: paymentEmail,
          amount: Math.round(totalWithFee * 100),
          currency: "GHS",
          callback_url: callback_url || "https://dataplug.store/packages?service_payment=verifying",
          metadata: serviceMetadata,
        }),
      });

      const raw = await paystackRes.text();
      let result: any = {};
      try {
        result = JSON.parse(raw);
      } catch {
        result = { message: raw };
      }

      if (!paystackRes.ok || !result.status || !result.data?.authorization_url) {
        console.error("[SERVICE PAYMENT] Paystack initialization failed", result);
        return new Response(JSON.stringify({ error: result.message || "Service payment initialization failed" }), {
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

    let baseAmount: number;
    let priceType: string;
    // ==========================
    // CHECK FOR SUBSUBAGENT FIRST
    // ==========================
    if (metadata.subsubagent_store_id) {
      // First check if sub-subagent has set their own customer price
      const { data: subsubagentPrice } = await supabaseClient
        .from("sub_subagent_package_prices")
        .select("sell_price")
        .eq("sub_subagent_store_id", metadata.subsubagent_store_id)
        .eq("package_id", metadata.package_id)
        .maybeSingle();

      if (subsubagentPrice?.customer_sell_price != null) {
        baseAmount = Number(subsubagentPrice.customer_sell_price);
        priceType = "subsubagent_customer_sell_price";
      } else {
        // No custom price: charge the "Cost from Agent" exactly like the dashboard/storefront.
        // Priority (lowest → highest): admin price → parent subagent's own agent cost
        // (subagent_package_prices.base_price by agent_store_id) → parent's sub-subagent
        // template price (sub_subagent_package_prices.base_price, sub_subagent_store_id IS NULL).
        const { data: subsubStore } = await supabaseClient
          .from("sub_subagent_stores")
          .select("subagent_store_id, agent_store_id")
          .eq("id", metadata.subsubagent_store_id)
          .single();

        // Start from admin price
        baseAmount = Number(packageData.price);
        priceType = "admin_user_price";

        // Level 2: parent subagent's own cost from their agent
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

        // Level 3: parent subagent's sub-subagent template price (highest priority fallback)
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
.select("customer_sell_price")
            .eq("agent_store_id", subagentStore.agent_store_id)
            .eq("package_id", metadata.package_id)
            .maybeSingle();

          if (agentPrice?.sell_price != null) {
            baseAmount = Number(agentPrice.sell_price);
            priceType = "agent_sell_price_fallback";
          } else {
            baseAmount = Number(packageData.price);
            priceType = "admin_user_price";
          }
        } else {
          baseAmount = Number(packageData.price);
          priceType = "admin_user_price";
        }
      }
    } else if (metadata.agent_store_id) {
      const { data: agentPrice } = await supabaseClient
        .from("agent_package_prices")
        .select("sell_price")
        .eq("agent_store_id", metadata.agent_store_id)
        .eq("package_id", metadata.package_id)
        .maybeSingle();

      if (agentPrice?.sell_price != null) {
        baseAmount = Number(agentPrice.sell_price);
        priceType = "agent_sell_price";
      } else {
        baseAmount = Number(packageData.price);
        priceType = "admin_user_price";
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
