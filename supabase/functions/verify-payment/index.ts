import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { reference } = await req.json();

    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing reference" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "Paystack not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify payment with Paystack
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });

    const verifyData = await verifyRes.json();
    console.log("[v0] Paystack verification response:", verifyData.data?.status);

    if (!verifyData.status || verifyData.data?.status !== "success") {
      return new Response(JSON.stringify({ error: "Payment not verified", details: verifyData.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const txData = verifyData.data;
    const metadata = txData.metadata || {};
    const paymentType = metadata.type;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Both orders.user_id and orders.customer_id reference auth.users(id).
    // Keep the authenticated UUID directly on both columns; customers.id is a
    // separate profile-row UUID and must not be written to orders.customer_id.
    const authenticatedUserId = String(metadata.user_id || metadata.customer_id || "").trim();
    let resolvedCustomerId: string | null = authenticatedUserId || null;
    const paystackEmail = String(txData.customer?.email || "").trim().toLowerCase();
    if (!resolvedCustomerId && paystackEmail) {
      const { data: customerByEmail } = await supabase
        .from("customers")
        .select("user_id")
        .eq("email", paystackEmail)
        .maybeSingle();
      resolvedCustomerId = customerByEmail?.user_id ?? null;
    }

    // =====================================
    // SMS CAMPAIGN PAYMENT + PROVIDER DELIVERY
    // =====================================
    if (paymentType === "sms_campaign") {
      const { data: alreadyProcessed } = await supabase.from("sms_messages").select("id,status,sent_count,failed_count").eq("paystack_reference", reference).maybeSingle();
      if (alreadyProcessed) {
        return new Response(JSON.stringify({ success: true, sent: Number(alreadyProcessed.sent_count || 0), failed: Number(alreadyProcessed.failed_count || 0), status: alreadyProcessed.status, already_processed: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const recipients = Array.isArray(metadata.recipients) ? metadata.recipients : [];
      const senderId = String(metadata.sender_id || "").trim();
      const message = String(metadata.message || "").trim();
      const providerAuth = Deno.env.get("CURL_AUTH_HEADER_12") || Deno.env.get("CURL_AUTH_HEADER") || Deno.env.get("TXT_CONNECT_API") || Deno.env.get("TXTCONNECT_API_KEY") || Deno.env.get("API_KEY");
      const providerHeaders = { Authorization: providerAuth?.startsWith("Bearer ") ? providerAuth : `Bearer ${providerAuth || ""}`, "Content-Type": "application/json" };
      if (!recipients.length || !senderId || !message || !providerAuth) {
        return new Response(JSON.stringify({ error: "SMS payment metadata or provider configuration is incomplete" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const cleanRecipients = recipients.map((value: string) => { let digits = String(value).replace(/\\D/g, ""); if (digits.startsWith("00233")) digits = digits.slice(5); else if (digits.startsWith("233") && digits.length >= 12) digits = `0${digits.slice(3)}`; if (!digits.startsWith("0")) digits = `0${digits}`; return /^0[2-5]\\d{8}$/.test(digits) ? digits : ""; }).filter(Boolean);
      const { data: claim, error: claimError } = await supabase.from("sms_messages").insert({ paystack_reference: reference, user_id: metadata.user_id || null, owner_type: metadata.owner_type || "customer", owner_id: metadata.owner_id || null, recipients: cleanRecipients, sender_id: senderId, message, total_charge: Number(metadata.base_amount || txData.amount / 100), unit_price: 0, status: "processing", sent_count: 0, failed_count: 0 }).select("id").single();
      if (claimError || !claim) {
        const { data: existing } = await supabase.from("sms_messages").select("status,sent_count,failed_count").eq("paystack_reference", reference).maybeSingle();
        if (existing) return new Response(JSON.stringify({ success: true, already_processed: true, sent: existing.sent_count || 0, failed: existing.failed_count || 0, status: existing.status }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "Could not reserve this SMS payment for delivery" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const results = await Promise.all(cleanRecipients.map(async (to: string) => { const response = await fetch("https://api.txtconnect.net/dev/api/sms/send", { method: "POST", headers: providerHeaders, body: JSON.stringify({ to, from: senderId, unicode: /[^\\x00-\\x7F]/.test(message), sms: message }) }); const raw = await response.text(); let body: unknown = {}; try { body = JSON.parse(raw); } catch { body = { raw }; } return { to, status: response.status, body }; }));
      const failed = results.filter((item) => item.status < 200 || item.status >= 300);
      const status = failed.length === results.length ? "failed" : failed.length ? "partial" : "sent";
      await supabase.from("sms_messages").update({ sent_count: results.length - failed.length, failed_count: failed.length, status, provider_response: results, completed_at: new Date().toISOString(), error_message: failed.length ? `${failed.length} message(s) failed` : null }).eq("id", claim.id);
      return new Response(JSON.stringify({ success: failed.length === 0, sent: results.length - failed.length, failed: failed.length, status }), { status: failed.length ? 502 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // =====================================
    // DIGITAL SERVICE PAYMENT + AUTO-ASSIGN
    // =====================================
    if (metadata.service_payment === true || metadata.service_payment === "true") {
      const serviceId = metadata.service_id;
      const phone = String(metadata.customer_phone || metadata.phone || "");
      const pin = String(metadata.access_pin || "");
      if (!serviceId || !/^\d{10}$/.test(phone) || !/^\d{4}$/.test(pin)) {
        return new Response(JSON.stringify({ error: "Invalid service payment metadata" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
      const pinHash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      const { data: existing } = await supabase.from("digital_service_orders").select("id,credential_id").eq("paystack_reference", reference).maybeSingle();
      if (existing) return new Response(JSON.stringify({ success: true, order_id: existing.id, credential_id: existing.credential_id, already_processed: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: slots } = await supabase.from("digital_service_credentials").select("id,slot_number").eq("service_id", serviceId).eq("active", true).is("assigned_order_id", null).order("slot_number").limit(4);
      const slot = slots?.[0];
      if (!slot) return new Response(JSON.stringify({ error: "This service is currently sold out" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: order, error: orderError } = await supabase.from("digital_service_orders").insert({ service_id: serviceId, credential_id: slot.id, customer_phone: phone, access_pin_hash: pinHash, paystack_reference: reference, payment_status: "paid", access_granted_at: new Date().toISOString() }).select("id,credential_id").single();
      if (orderError || !order) {
        console.error("[v0] Service order insert failed", { code: orderError?.code, message: orderError?.message, details: orderError?.details, hint: orderError?.hint, reference, serviceId });
        return new Response(JSON.stringify({ error: "Unable to create service order", details: orderError?.message || "The payment was verified but the order could not be assigned." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: assignedCredential, error: assignError } = await supabase.from("digital_service_credentials").update({ assigned_order_id: order.id, assigned_phone: phone, assigned_pin_hash: pinHash, assigned_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", slot.id).is("assigned_order_id", null).select("id").maybeSingle();
      if (assignError || !assignedCredential) {
        console.error("[v0] Service credential assignment failed", { code: assignError?.code, message: assignError?.message, orderId: order.id, credentialId: slot.id });
        return new Response(JSON.stringify({ error: "Unable to assign service access", details: assignError?.message || "That service slot was assigned by another request." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: true, message: "Service payment successful. Your access is ready.", order_id: order.id, credential_id: order.credential_id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ==========================
    // SPIN WHEEL PAYMENT HANDLER
    // ==========================
    if (paymentType === "spin_wheel") {
      console.log("[v0] Processing spin_wheel payment");
      const { data: existing } = await supabase
        .from("spin_wheel_payments")
        .select("id")
        .eq("reference", reference)
        .maybeSingle();

      if (existing) {
        console.log("[v0] Spin wheel payment already exists");
        return new Response(JSON.stringify({
          success: true,
          message: "Payment already redeemed – spins already granted.",
          grant_spins: false,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userId = metadata.userId || null;
      const phone = metadata.phone || "";
      const { error: insertErr } = await supabase
        .from("spin_wheel_payments")
        .insert({
          reference,
          user_id: userId,
          phone,
          amount: txData.amount / 100,
          used_at: new Date().toISOString(),
        });

      if (insertErr) {
        console.error("[v0] Failed to record spin payment:", insertErr);
        return new Response(JSON.stringify({ error: "Internal error recording payment" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("[v0] Spin wheel payment recorded successfully");
      return new Response(JSON.stringify({
        success: true,
        grant_spins: true,
        spins: 2,
        message: "Payment confirmed! You have 2 spins now.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =========================================================
    // AGENT REGISTRATION VERIFY-ONLY (called from callback page)
    // Just confirms Paystack says success — store is created by the frontend
    // =========================================================
    if (paymentType === "agent_registration_verify_only") {
      console.log("[v0] Agent registration payment verified (verify-only mode)");
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================
    // AGENT REGISTRATION PAYMENT HANDLER
    // =====================================
    if (paymentType === "agent_registration") {
      console.log("[v0] Processing agent_registration payment");
      const regAgentStoreId = metadata.agent_store_id;
      
      if (!regAgentStoreId) {
        return new Response(JSON.stringify({ error: "Missing agent store ID" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: storeData } = await supabase
        .from("agent_stores")
        .select("approved")
        .eq("id", regAgentStoreId)
        .single();

      if (storeData?.approved) {
        console.log("[v0] Agent store already approved");
        return new Response(JSON.stringify({
          success: true,
          approved: true,
          message: "Store already approved",
          already_processed: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: approveError } = await supabase
        .from("agent_stores")
        .update({ approved: true })
        .eq("id", regAgentStoreId);

      if (approveError) {
        console.error("[v0] Failed to approve store:", approveError);
        return new Response(JSON.stringify({ error: "Failed to approve store" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log("[v0] Agent store approved successfully");
      return new Response(JSON.stringify({
        success: true,
        approved: true,
        message: "Payment confirmed! Your store has been approved.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================
    // SUBAGENT REGISTRATION FEE PAYMENT
    // =====================================
    if (paymentType === "subagent_registration") {
      console.log("[v0] Processing subagent_registration payment");
      const registrationId = metadata.subagent_registration_id;
      const regAgentStoreId = metadata.agent_store_id;

      if (!registrationId || !regAgentStoreId) {
        return new Response(JSON.stringify({ error: "Missing registration or agent store ID" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get the registration record
      const { data: registration, error: regError } = await supabase
        .from("subagent_registrations")
        .select("*")
        .eq("id", registrationId)
        .single();

      if (regError || !registration) {
        console.error("[v0] Registration record not found:", regError);
        return new Response(JSON.stringify({ error: "Registration record not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already processed
      if (registration.payment_status === "paid" || registration.status === "approved") {
        console.log("[v0] Subagent registration payment already verified");
        return new Response(JSON.stringify({
          success: true,
          message: "Registration payment already verified",
          already_processed: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark as paid and APPROVED
      const { error: updateError } = await supabase
        .from("subagent_registrations")
        .update({
          payment_status: "paid",
          status: "completed",
          payment_reference: reference,
          updated_at: new Date().toISOString(),
        })
        .eq("id", registrationId);

      if (updateError) {
        console.error("[v0] Failed to update registration:", updateError);
        return new Response(JSON.stringify({ error: "Failed to verify registration" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // =====================================
      // CREATE SUBAGENT STORE AFTER PAYMENT
      // =====================================
      const { data: fullRegistration } = await supabase
        .from("subagent_registrations")
        .select("*")
        .eq("id", registrationId)
        .single();

      if (fullRegistration && fullRegistration.user_id && fullRegistration.agent_store_id) {
        const storeData = fullRegistration.registration_data || {};
        
        const { data: newStore, error: storeError } = await supabase
          .from("subagent_stores")
          .insert({
            user_id: fullRegistration.user_id,
            agent_store_id: fullRegistration.agent_store_id,
            store_name: storeData.store_name || fullRegistration.business_name,
            whatsapp_number: storeData.whatsapp_number || "",
            support_number: storeData.support_number || fullRegistration.phone_number,
            momo_name: storeData.momo_name || "",
            momo_number: storeData.momo_number || "",
            momo_network: storeData.momo_network || "mtn",
            wallet_balance: 0,
            approved: true
          })
          .select("id")
          .single();

        if (storeError) {
          console.error("[v0] Failed to create subagent store:", storeError);
        } else {
          console.log(`[v0] Subagent store created: ${newStore.id}`);
        }
      }

      console.log(`[v0] Subagent registration ${registrationId} payment verified and store created`);

      return new Response(JSON.stringify({
        success: true,
        message: "Registration payment verified successfully",
        type: "subagent_registration",
        registration_id: registrationId,
        verified: true,
        redirect_to: "/subagent-dashboard"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================
    // SUBSUBAGENT WALLET TOPUP HANDLER
    // =====================================
    if (paymentType === "subsubagent_wallet_topup") {
      console.log("[v0] Processing subsubagent_wallet_topup");
      const topupSubsubagentStoreId = metadata.subsubagent_store_id;
      const baseAmount = Number(metadata.base_amount) || (txData.amount / 100);
      
      if (!topupSubsubagentStoreId) {
        return new Response(JSON.stringify({ error: "Missing subsubagent store ID" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const { data: existingTopup } = await supabase
        .from("sub_subagent_wallet_topups")
        .select("id")
        .eq("paystack_reference", reference)
        .maybeSingle();
      
      // Wallet credit and topup record insert are handled exclusively by the
      // Paystack webhook (paystack-webhook-fixed). verify-payment only confirms
      // that Paystack reports the payment as successful — it does NOT touch
      // sub_subagent_stores.wallet_balance or sub_subagent_wallet_topups here
      // to prevent double-crediting.
      const alreadyDone = !!existingTopup;
      console.log(`[v0] Subsubagent topup verified via Paystack. Webhook handles credit. already_processed=${alreadyDone}`);
      return new Response(JSON.stringify({
        success: true,
        message: alreadyDone ? "Topup already processed" : "Payment verified — wallet will be credited shortly",
        already_processed: alreadyDone,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================
    // WALLET TOP UP PAYMENT HANDLER (Agent)
    // =====================================
    if (paymentType === "wallet_topup") {
      console.log("[v0] Processing wallet_topup for agent");
      const topupAgentStoreId = metadata.agent_store_id;
      const baseAmount = Number(metadata.base_amount) || (txData.amount / 100);
      
      if (!topupAgentStoreId) {
        return new Response(JSON.stringify({ error: "Missing agent store ID" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const { data: existingTopup } = await supabase
        .from("wallet_topups")
        .select("id")
        .eq("paystack_reference", reference)
        .maybeSingle();
      
      if (existingTopup) {
        console.log("[v0] Agent topup already processed");
        return new Response(JSON.stringify({
          success: true,
          message: "Topup already processed",
          already_processed: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const { data: store, error: storeError } = await supabase
        .from("agent_stores")
        .select("wallet_balance")
        .eq("id", topupAgentStoreId)
        .single();
      
      if (storeError || !store) {
        console.error("[v0] Agent store not found:", storeError);
        return new Response(JSON.stringify({ error: "Agent store not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const newBalance = (Number(store.wallet_balance) || 0) + baseAmount;
      
      const { error: updateError } = await supabase
        .from("agent_stores")
        .update({ wallet_balance: newBalance })
        .eq("id", topupAgentStoreId);
      
      if (updateError) {
        console.error("[v0] Failed to update agent wallet:", updateError);
        return new Response(JSON.stringify({ error: "Failed to update wallet" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      await supabase.from("wallet_topups").insert({
        agent_store_id: topupAgentStoreId,
        amount: baseAmount,
        paystack_reference: reference,
      });
      
      console.log(`[v0] Agent wallet topup: +${baseAmount}, new balance=${newBalance}`);
      return new Response(JSON.stringify({
        success: true,
        message: `Wallet topped up with GH₵${baseAmount.toFixed(2)}`,
        new_balance: newBalance,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================
    // SUBAGENT WALLET TOP UP PAYMENT HANDLER
    // =====================================
    if (paymentType === "subagent_wallet_topup") {
      console.log("[v0] Processing wallet_topup for subagent");
      const topupSubagentStoreId = metadata.subagent_store_id;
      const baseAmount = Number(metadata.base_amount) || (txData.amount / 100);
      
      if (!topupSubagentStoreId) {
        return new Response(JSON.stringify({ error: "Missing subagent store ID" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const { data: existingTopup } = await supabase
        .from("subagent_wallet_topups")
        .select("id")
        .eq("paystack_reference", reference)
        .maybeSingle();
      
      if (existingTopup) {
        console.log("[v0] Subagent topup already processed");
        return new Response(JSON.stringify({
          success: true,
          message: "Topup already processed",
          already_processed: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const { data: store, error: storeError } = await supabase
        .from("subagent_stores")
        .select("wallet_balance")
        .eq("id", topupSubagentStoreId)
        .single();
      
      if (storeError || !store) {
        console.error("[v0] Subagent store not found:", storeError);
        return new Response(JSON.stringify({ error: "Subagent store not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const newBalance = (Number(store.wallet_balance) || 0) + baseAmount;
      
      const { error: updateError } = await supabase
        .from("subagent_stores")
        .update({ wallet_balance: newBalance })
        .eq("id", topupSubagentStoreId);
      
      if (updateError) {
        console.error("[v0] Failed to update subagent wallet:", updateError);
        return new Response(JSON.stringify({ error: "Failed to update wallet" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      await supabase.from("subagent_wallet_topups").insert({
        subagent_store_id: topupSubagentStoreId,
        amount: baseAmount,
        paystack_reference: reference,
      });
      
      console.log(`[v0] Subagent wallet topup: +${baseAmount}, new balance=${newBalance}`);
      return new Response(JSON.stringify({
        success: true,
        message: `Wallet topped up with GH₵${baseAmount.toFixed(2)}`,
        new_balance: newBalance,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================
    // SUBSUBAGENT DATA PACKAGE PURCHASE
    // =====================================
    if (metadata?.subsubagent_store_id) {
      console.log("[v0] Processing data package for subsubagent");
      const pkgSubsubagentStoreId = metadata.subsubagent_store_id;
      const phone = metadata.phone || "";
      const packageId = metadata.package_id || "";
      const network = metadata.network || "";
      const packageName = metadata.package_name || "";
      const sizeGbText = metadata.size_gb_text || "";

      const sizeMatch = packageName.match(/(\d+(?:\.\d+)?)/);
      let sizeGb = sizeMatch ? parseFloat(sizeMatch[1]) : 0;

      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("paystack_reference", reference)
        .maybeSingle();

      if (existing) {
        console.log("[v0] Subsubagent order already exists");
        return new Response(JSON.stringify({
          success: true,
          message: "Payment already processed – your data is on the way!",
          order_id: existing.id,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const amount = txData.amount / 100;

      const { data: pkgData } = await supabase
        .from("data_packages")
        .select("agent_price")
        .eq("id", packageId)
        .single();

      const adminBasePrice = pkgData?.agent_price ? Number(pkgData.agent_price) : 0;

            const { data: subsubStore } = await supabase
        .from("sub_subagent_stores")
        .select("subagent_store_id, agent_store_id, wallet_balance")
        .eq("id", pkgSubsubagentStoreId)
        .single();

      if (!subsubStore) {
        console.error("[v0] SubSubagent store not found");
        return new Response(JSON.stringify({ error: "SubSubagent store not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const parentSubagentId = subsubStore.subagent_store_id;

      // What the SUBSUBAGENT pays the SUBAGENT (the subsubagent's COST, i.e. "Cost from Agent").
      // Built exactly like the sub-subagent dashboard, priority (lowest → highest):
      //   1. admin base price
      //   2. parent subagent's own cost from their agent (subagent_package_prices.base_price by agent_store_id)
      //   3. parent subagent's sub-subagent template price (sub_subagent_package_prices.base_price, sub_subagent_store_id IS NULL)
      // NEVER the subsubagent's own row (its columns all equal their selling price, which would zero out profit).
      let costThatSubSubAgentPaid = adminBasePrice;
      if (subsubStore.agent_store_id) {
        const { data: agentCostRow } = await supabase
          .from("subagent_package_prices")
          .select("base_price")
          .eq("agent_store_id", subsubStore.agent_store_id)
          .eq("package_id", packageId)
          .maybeSingle();
        if (agentCostRow?.base_price != null) costThatSubSubAgentPaid = Number(agentCostRow.base_price);
      }
      if (parentSubagentId) {
        const { data: templateRow } = await supabase
          .from("sub_subagent_package_prices")
          .select("base_price")
          .eq("subagent_store_id", parentSubagentId)
          .is("sub_subagent_store_id", null)
          .eq("package_id", packageId)
          .maybeSingle();
        if (templateRow?.base_price != null) costThatSubSubAgentPaid = Number(templateRow.base_price);
      }

      // What the SUBAGENT pays the AGENT (subagent's cost, e.g. 4.20).
      // Mirrors the working subagent handler: subagent_package_prices.base_price keyed by subagent_store_id.
      let agentPriceToSubagent = adminBasePrice;
      if (parentSubagentId) {
        const { data: subPrice } = await supabase
          .from("subagent_package_prices")
          .select("base_price")
          .eq("subagent_store_id", parentSubagentId)
          .eq("package_id", packageId)
          .maybeSingle();
        if (subPrice?.base_price != null) agentPriceToSubagent = Number(subPrice.base_price);
      }

      const sellingPrice = amount;                              // customer pays (e.g. 5.00)
      const basePriceForOrder = costThatSubSubAgentPaid;        // subsubagent's cost (e.g. 4.70)
      const profitForOrder = sellingPrice - costThatSubSubAgentPaid; // subsubagent profit (e.g. 0.30)

      console.log(`[v0] SUBSUBAGENT: selling=${sellingPrice.toFixed(2)}, subsubCost=${basePriceForOrder.toFixed(2)}, agentToSub=${agentPriceToSubagent.toFixed(2)}, adminBase=${adminBasePrice.toFixed(2)}`);

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_number: phone,
          package_id: packageId,
          network,
          size_gb: sizeGb,
          size_gb_text: sizeGbText,
          amount: amount,
          status: "paid",
          fulfillment_status: "pending",
          paystack_reference: reference,
          payment_method: "paystack",
          selling_price: sellingPrice,
          base_price: basePriceForOrder,
          profit: profitForOrder,
          profit_credited: false,
          agent_store_id: subsubStore.agent_store_id,
          subagent_store_id: subsubStore.subagent_store_id,
          sub_subagent_store_id: pkgSubsubagentStoreId,
        })
        .select("id")
        .single();

      if (orderError) {
        console.error("[v0] Failed to create subsubagent order:", orderError);
        return new Response(JSON.stringify({ error: "Failed to create order" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[v0] Subsubagent order created: ${order.id}`);

      // === CREDIT SUBSUBAGENT PROFIT -> sub_subagent_stores.wallet_balance ===
      if (profitForOrder > 0) {
        const newBalance = (Number(subsubStore.wallet_balance) || 0) + profitForOrder;
        await supabase
          .from("sub_subagent_stores")
          .update({ wallet_balance: newBalance })
          .eq("id", pkgSubsubagentStoreId);

        console.log(`[v0] SUBSUBAGENT: Credited +${profitForOrder.toFixed(2)}, new balance=${newBalance.toFixed(2)}`);
      }

      // === CREDIT PARENT SUBAGENT COMMISSION -> subagent_stores.wallet_balance ===
      if (parentSubagentId) {
        const parentCommission = costThatSubSubAgentPaid - agentPriceToSubagent;
        if (parentCommission > 0) {
          const { data: parentStore } = await supabase
            .from("subagent_stores")
            .select("wallet_balance")
            .eq("id", parentSubagentId)
            .single();
          if (parentStore) {
            const newBalance = (Number(parentStore.wallet_balance) || 0) + parentCommission;
            await supabase
              .from("subagent_stores")
              .update({ wallet_balance: newBalance })
              .eq("id", parentSubagentId);

            console.log(`[v0] PARENT SUBAGENT: Credited +${parentCommission.toFixed(2)}, new balance=${newBalance.toFixed(2)}`);
          }
        }
      }

      // === CREDIT AGENT COMMISSION -> agent_stores.subagent_commission_balance ===
      if (subsubStore.agent_store_id) {
        const agentCommission = agentPriceToSubagent - adminBasePrice;
        if (agentCommission > 0) {
          const { data: agentStore } = await supabase
            .from("agent_stores")
            .select("subagent_commission_balance")
            .eq("id", subsubStore.agent_store_id)
            .single();
          if (agentStore) {
            const newBalance = (Number(agentStore.subagent_commission_balance) || 0) + agentCommission;
            await supabase
              .from("agent_stores")
              .update({ subagent_commission_balance: newBalance })
              .eq("id", subsubStore.agent_store_id);

            console.log(`[v0] AGENT: Credited +${agentCommission.toFixed(2)}, new balance=${newBalance.toFixed(2)}`);
          }
        }
      }

      // Trigger fulfillment
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/fulfill-order`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({ order_id: order.id }),
        });
      } catch (err) {
        console.error("[v0] Failed to trigger fulfillment:", err);
      }

      return new Response(JSON.stringify({
        success: true,
        message: "SubSubagent order processed successfully",
        order_id: order.id,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================
    // REGULAR DATA PACKAGE PURCHASE HANDLER
    // =====================================
    console.log("[v0] Processing regular data package purchase");
    const phone = metadata.phone || "";
    const packageId = metadata.package_id || "";
    const network = metadata.network || "";
    const packageName = metadata.package_name || "";
    const sizeGbText = metadata.size_gb_text || "";
    const pkgAgentStoreId = metadata.agent_store_id || null;
    const pkgSubagentStoreId = metadata.subagent_store_id || null;

    const sizeMatch = packageName.match(/(\d+(?:\.\d+)?)/);
    let sizeGb = sizeMatch ? parseFloat(sizeMatch[1]) : 0;
    
    if ((network === "mashup" || network === "mtn_mashup") && sizeGbText) {
      const gbMatch = sizeGbText.match(/(\d+(?:\.\d+)?)\s*GB/i);
      if (gbMatch) {
        sizeGb = parseFloat(gbMatch[1]);
        console.log(`[v0] Mashup package detected - extracted sizeGb: ${sizeGb} from sizeGbText: "${sizeGbText}"`);
      }
    }
    
    const amount = txData.amount / 100;

    const { data: existing } = await supabase
      .from("orders")
      .select("id")
      .eq("paystack_reference", reference)
      .maybeSingle();

    if (existing) {
      console.log("[v0] Order already exists");
      return new Response(JSON.stringify({
        success: true,
        message: "Payment already processed – your data is on the way!",
        order_id: existing.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sellingPrice = amount;
    let basePriceForOrder = 0;
    let profitForOrder = 0;

    const { data: pkgData } = await supabase
      .from("data_packages")
      .select("agent_price")
      .eq("id", packageId)
      .single();

    const adminBasePrice = pkgData?.agent_price ? Number(pkgData.agent_price) : 0;

    if (pkgSubagentStoreId) {
      console.log("[v0] Processing order for subagent");
      const { data: subagentStore } = await supabase
        .from("subagent_stores")
        .select("agent_store_id, wallet_balance")
        .eq("id", pkgSubagentStoreId)
        .single();

      const { data: packagePrice } = await supabase
        .from("subagent_package_prices")
        .select("base_price")
        .eq("subagent_store_id", pkgSubagentStoreId)
        .eq("package_id", packageId)
        .maybeSingle();

      const agentPriceToSubagent = packagePrice?.base_price != null 
        ? Number(packagePrice.base_price) 
        : adminBasePrice;
      
      sellingPrice = amount;
      basePriceForOrder = agentPriceToSubagent;
      profitForOrder = sellingPrice - basePriceForOrder;

      if (subagentStore && profitForOrder > 0) {
        const newWalletBalance = (Number(subagentStore.wallet_balance) || 0) + profitForOrder;
        await supabase
          .from("subagent_stores")
          .update({ wallet_balance: newWalletBalance })
          .eq("id", pkgSubagentStoreId);
        
        console.log(`[v0] Credited subagent ${pkgSubagentStoreId}: +${profitForOrder}, new balance=${newWalletBalance}`);
      }

      if (subagentStore?.agent_store_id && packageId) {
        const agentCommission = basePriceForOrder - adminBasePrice;
        
        if (agentCommission > 0) {
          const { data: agentStore } = await supabase
            .from("agent_stores")
            .select("subagent_commission_balance")
            .eq("id", subagentStore.agent_store_id)
            .single();
          
          if (agentStore) {
            const newBalance = (agentStore.subagent_commission_balance || 0) + agentCommission;
            await supabase
              .from("agent_stores")
              .update({ subagent_commission_balance: newBalance })
              .eq("id", subagentStore.agent_store_id);
            
            console.log(`[v0] Credited agent ${subagentStore.agent_store_id}: +${agentCommission}, new balance=${newBalance}`);
          }
        }
      }

    } else if (pkgAgentStoreId) {
      console.log("[v0] Processing order for agent");
      sellingPrice = amount;
      basePriceForOrder = adminBasePrice;
      profitForOrder = sellingPrice - basePriceForOrder;
    } else {
      console.log("[v0] Processing regular customer order");
      sellingPrice = amount;
      basePriceForOrder = adminBasePrice;
      profitForOrder = 0;
    }

    const orderInsert: Record<string, unknown> = {
      customer_number: phone,
      package_id: packageId,
      network,
      size_gb: sizeGb,
      size_gb_text: sizeGbText || null,
      amount,
      status: "paid",
      fulfillment_status: "pending",
      paystack_reference: reference,
      selling_price: sellingPrice,
      base_price: basePriceForOrder,
      profit: profitForOrder,
      profit_credited: false,
      agent_store_id: null,
      subagent_store_id: null,
      // Authenticated customer purchases carry this through Paystack metadata.
      // Agent/subagent orders intentionally remain attributed to their store.
      customer_id: resolvedCustomerId,
      user_id: resolvedCustomerId,
    };
    
    if (pkgAgentStoreId) {
      orderInsert.agent_store_id = pkgAgentStoreId;
    }
    if (pkgSubagentStoreId) {
      orderInsert.subagent_store_id = pkgSubagentStoreId;
      
      const { data: subagentStore } = await supabase
        .from("subagent_stores")
        .select("agent_store_id")
        .eq("id", pkgSubagentStoreId)
        .maybeSingle();
      
      if (subagentStore?.agent_store_id) {
        orderInsert.agent_store_id = subagentStore.agent_store_id;
      }
    }

    let orderId = "";

    try {
      const { data: order, error: insertErr } = await supabase
        .from("orders")
        .insert(orderInsert)
        .select("id")
        .single();

      if (insertErr) throw insertErr;
      orderId = order.id;
    } catch (insertErr: any) {
      if (insertErr.code === "23505") {
        const { data: actualOrder } = await supabase
          .from("orders")
          .select("id")
          .eq("paystack_reference", reference)
          .single();

        if (actualOrder) {
          console.log("[v0] Duplicate order detected, returning existing order");
          return new Response(JSON.stringify({
            success: true,
            message: "Payment already processed – your data is on the way!",
            order_id: actualOrder.id,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      console.error("[v0] Order insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to create order", details: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[v0] Order created successfully: ${orderId}`);

    // Fulfill the order (non-blocking)
    try {
      const fulfillUrl = `${supabaseUrl}/functions/v1/fulfill-order`;
      await fetch(fulfillUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({ order_id: orderId }),
      });
    } catch (fulfillErr) {
      console.error("[v0] Fulfillment attempt error:", fulfillErr);
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Payment confirmed – your data is on the way!",
      order_id: orderId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[v0] Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
