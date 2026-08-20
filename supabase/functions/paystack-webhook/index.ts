import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-paystack-signature",
};

const PAYSTACK_FEE_PERCENT = 1.98;

async function verifySignature(secret: string, signature: string, rawBody: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = encoder.encode(secret);
    const data = encoder.encode(rawBody);
    const cryptoKey = await crypto.subtle.importKey(
      "raw", key, { name: "HMAC", hash: "SHA-512" }, false, ["sign"]
    );
    const computedSignature = await crypto.subtle.sign("HMAC", cryptoKey, data);
    const computedHex = Array.from(new Uint8Array(computedSignature))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    if (computedHex.length !== signature.length) return false;
    let result = 0;
    for (let i = 0; i < computedHex.length; i++) {
      result |= computedHex.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return result === 0;
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("x-paystack-signature");
    if (!signature) {
      return new Response(JSON.stringify({ error: "No signature provided" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.text();
    const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secret) {
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isValid = await verifySignature(secret, signature, rawBody);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);
    console.log(`Event type: ${payload.event}`);

    if (payload.event !== "charge.success") {
      return new Response(JSON.stringify({ message: "Event ignored" }), { status: 200, headers: corsHeaders });
    }

    const { reference, metadata, amount } = payload.data;
    const paymentType = metadata?.type;

    console.log(`Processing payment: ${reference}, type: ${paymentType}`);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // =====================================
    // PUBLIC SMS PAYMENT HANDLER
    // =====================================
    if (paymentType === "sms_campaign") {
      const recipients = Array.isArray(metadata?.recipients) ? metadata.recipients : [];
      const senderId = String(metadata?.sender_id || "").trim();
      const message = String(metadata?.message || "").trim();
      const apiKey = Deno.env.get("TXT_CONNECT_API") || Deno.env.get("TXTCONNECT_API_KEY") || Deno.env.get("API_KEY");
      if (!recipients.length || !senderId || !message || !apiKey) return new Response(JSON.stringify({ error: "SMS payment metadata is incomplete" }), { status: 400, headers: corsHeaders });
      const cleanRecipients = recipients.map((value: string) => { const digits = String(value).replace(/\\D/g, ""); return digits.startsWith("0") ? `233${digits.slice(1)}` : digits.startsWith("233") ? digits : ""; }).filter(Boolean);
      const results = await Promise.all(cleanRecipients.map(async (to: string) => { const response = await fetch("https://api.txtconnect.net/dev/api/sms/send", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ to, from: senderId, unicode: /[^\\x00-\\x7F]/.test(message) ? "unicode" : "regular", sms: message }) }); const raw = await response.text(); let body: unknown = {}; try { body = JSON.parse(raw); } catch { body = { raw }; } return { to, status: response.status, body }; }));
      const failed = results.filter((item) => item.status < 200 || item.status >= 300);
      await supabaseClient.from("sms_messages").insert({ user_id: metadata?.user_id || null, owner_type: "customer", owner_id: metadata?.owner_id || null, recipients: cleanRecipients, sender_id: senderId, message, total_charge: Number(metadata?.base_amount || 0), unit_price: 0.09, status: failed.length === results.length ? "failed" : failed.length ? "partial" : "sent", provider_response: results, completed_at: new Date().toISOString(), error_message: failed.length ? `${failed.length} message(s) failed` : null });
      return new Response(JSON.stringify({ success: !failed.length, sent: results.length - failed.length, failed: failed.length }), { status: failed.length ? 502 : 200, headers: corsHeaders });
    }

    // =====================================
    // SUBAGENT REGISTRATION PAYMENT HANDLER
    // =====================================
    const isSubagentRegistration =
      paymentType === "subagent_registration" ||
      paymentType === "subagent-registration" ||
      metadata?.subagent_registration_id ||
      metadata?.subagentRegistrationId ||
      metadata?.registration_type === "subagent";

    if (isSubagentRegistration) {
      console.log(`[SUBAGENT REGISTRATION] === STARTING ===`);

      const subagentRegistrationId =
        metadata.subagent_registration_id ||
        metadata.subagentRegistrationId ||
        metadata.registration_id;

      const agentStoreId =
        metadata.agent_store_id ||
        metadata.agentStoreId ||
        metadata.agent_store;

      const baseAmount = Number(metadata.base_amount) || Number(metadata.amount) || (Number(amount) / 100);

      let regId = subagentRegistrationId;
      let agentId = agentStoreId;

      if (!regId) {
        const { data: foundReg } = await supabaseClient
          .from("subagent_registrations")
          .select("id, agent_store_id")
          .eq("payment_reference", reference)
          .maybeSingle();

        if (foundReg) {
          regId = foundReg.id;
          agentId = agentId || foundReg.agent_store_id;
        } else {
          console.error(`[SUBAGENT REGISTRATION] Cannot find registration for reference: ${reference}`);
          return new Response(JSON.stringify({ error: "Registration not found" }), {
            status: 400, headers: corsHeaders,
          });
        }
      }

      if (!agentId) {
        return new Response(JSON.stringify({ error: "Missing agent store ID" }), {
          status: 400, headers: corsHeaders,
        });
      }

      const { data: existingReg, error: fetchError } = await supabaseClient
        .from("subagent_registrations")
        .select("id, payment_status, status, fee_amount, agent_store_id")
        .eq("id", regId)
        .maybeSingle();

      if (fetchError) {
        console.error(`[SUBAGENT REGISTRATION] Fetch error:`, fetchError);
        return new Response(JSON.stringify({ error: "Failed to fetch registration" }), {
          status: 500, headers: corsHeaders,
        });
      }

      if (existingReg?.status === "completed") {
        console.log(`[SUBAGENT REGISTRATION] Already completed — skipping duplicate`);
        return new Response(
          JSON.stringify({ message: "Already completed — no duplicate credit applied" }),
          { status: 200, headers: corsHeaders }
        );
      }

      if (!existingReg) {
        const { error: createError } = await supabaseClient
          .from("subagent_registrations")
          .insert({
            id: regId,
            agent_store_id: agentId,
            payment_status: "processing",
            payment_reference: reference,
            status: "pending_payment",
            fee_amount: baseAmount,
          });
        if (createError) {
          console.error(`[SUBAGENT REGISTRATION] Create error:`, createError);
          return new Response(JSON.stringify({ error: "Failed to create registration" }), {
            status: 500, headers: corsHeaders,
          });
        }
      }

      await supabaseClient
        .from("subagent_registrations")
        .update({ payment_status: "processing" })
        .eq("id", regId)
        .in("payment_status", ["pending", "pending_payment", "failed"]);

      const { data: agentStore, error: agentFetchError } = await supabaseClient
        .from("agent_stores")
        .select("id, wallet_balance, store_name")
        .eq("id", agentId)
        .single();

      if (agentFetchError || !agentStore) {
        await supabaseClient
          .from("subagent_registrations")
          .update({ payment_status: "failed", status: "failed" })
          .eq("id", regId);
        return new Response(JSON.stringify({ error: "Agent store not found" }), {
          status: 404, headers: corsHeaders,
        });
      }

      const previousBalance = Number(agentStore.wallet_balance) || 0;
      const newBalance = previousBalance + baseAmount;

      console.log(`[SUBAGENT REGISTRATION] Crediting GHS ${baseAmount} to ${agentStore.store_name}`);
      console.log(`[SUBAGENT REGISTRATION] ${previousBalance} -> ${newBalance}`);

      const { error: walletError } = await supabaseClient
        .from("agent_stores")
        .update({ wallet_balance: newBalance })
        .eq("id", agentId);

      if (walletError) {
        console.error(`[SUBAGENT REGISTRATION] Wallet credit failed:`, walletError);
        await supabaseClient
          .from("subagent_registrations")
          .update({ payment_status: "failed", status: "failed" })
          .eq("id", regId);
        return new Response(JSON.stringify({ error: "Failed to credit agent wallet" }), {
          status: 500, headers: corsHeaders,
        });
      }

      console.log(`[SUBAGENT REGISTRATION] ✅ Wallet credited`);

      const { error: completeError } = await supabaseClient
        .from("subagent_registrations")
        .update({
          status: "completed",
          payment_status: "paid",
          payment_reference: reference,
          fee_amount: baseAmount,
        })
        .eq("id", regId);

      if (completeError) {
        console.error(`[SUBAGENT REGISTRATION] CRITICAL: Wallet credited but failed to mark completed:`, completeError);
      }

      console.log(`[SUBAGENT REGISTRATION] === COMPLETED ===`);

      return new Response(
        JSON.stringify({
          message: "Subagent registration payment processed successfully",
          subagent_registration_id: regId,
          agent_store_id: agentId,
          status: "completed",
          amount_credited: baseAmount,
          previous_balance: previousBalance,
          new_balance: newBalance,
          transaction_reference: reference,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // =====================================
    // API USER WALLET TOPUP HANDLER
    // =====================================
    if (paymentType === "api_wallet_topup") {
      const apiUserId = metadata.api_user_id;
      const baseAmount = Number(metadata.base_amount) || (Number(amount) / 100);
      const feeAmount = Number(metadata.fee_amount) || 0;
      const totalAmount = Number(amount) / 100;

      if (!apiUserId) {
        console.error("[API WALLET TOPUP] Missing api_user_id");
        return new Response(JSON.stringify({ error: "Missing api_user_id" }), {
          status: 400, headers: corsHeaders,
        });
      }

      const { data: existingTopup } = await supabaseClient
        .from("api_wallet_topups")
        .select("id, status")
        .eq("paystack_reference", reference)
        .maybeSingle();

      if (existingTopup?.status === "completed") {
        console.log(`[API WALLET TOPUP] Already processed for reference ${reference}`);
        return new Response(JSON.stringify({ message: "Topup already processed" }), {
          status: 200, headers: corsHeaders,
        });
      }

      const { data: apiUser, error: userError } = await supabaseClient
        .from("api_users")
        .select("id, wallet")
        .eq("id", apiUserId)
        .single();

      if (userError || !apiUser) {
        console.error(`[API WALLET TOPUP] API user not found: ${apiUserId}`);
        return new Response(JSON.stringify({ error: "API user not found" }), {
          status: 404, headers: corsHeaders,
        });
      }

      const currentBalance = Number(apiUser.wallet) || 0;
      const newBalance = currentBalance + baseAmount;

      const { error: updateError } = await supabaseClient
        .from("api_users")
        .update({ wallet: newBalance })
        .eq("id", apiUserId);

      if (updateError) {
        console.error(`[API WALLET TOPUP] Failed to update wallet:`, updateError);
        return new Response(JSON.stringify({ error: "Failed to update wallet" }), {
          status: 500, headers: corsHeaders,
        });
      }

      await supabaseClient
        .from("api_wallet_topups")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("paystack_reference", reference);

      console.log(`[API WALLET TOPUP] ✅ Wallet topped up: GHS ${baseAmount} for user ${apiUserId}`);

      return new Response(
        JSON.stringify({
          message: "API wallet topup processed successfully",
          api_user_id: apiUserId,
          amount_credited: baseAmount,
          fee_charged: feeAmount,
          total_paid: totalAmount,
          previous_balance: currentBalance,
          new_balance: newBalance,
          transaction_reference: reference,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // =====================================
    // NORMAL WALLET TOPUP HANDLER FOR CUSTOMERS
    // =====================================
    if (paymentType === "user_wallet_topup") {
      const customerId = metadata.customer_id;
      const baseAmount = Number(metadata.base_amount) || (Number(amount) / 100);

      console.log(`[USER WALLET TOPUP] === STARTING ===`);

      if (!customerId) {
        return new Response(JSON.stringify({ error: "Missing customer_id" }), {
          status: 400, headers: corsHeaders,
        });
      }

      const { data: existingTopup } = await supabaseClient
        .from("user_wallet_topups")
        .select("id, status")
        .eq("paystack_reference", reference)
        .maybeSingle();

      if (existingTopup?.status === "completed") {
        return new Response(JSON.stringify({ message: "Topup already processed" }), {
          status: 200, headers: corsHeaders,
        });
      }

      let customer = null;
      const { data: byId } = await supabaseClient
        .from("customers").select("id, wallet_balance, email").eq("id", customerId).maybeSingle();
      if (byId) {
        customer = byId;
      } else {
        const { data: byUserId } = await supabaseClient
          .from("customers").select("id, wallet_balance, email").eq("user_id", customerId).maybeSingle();
        customer = byUserId;
      }

      if (!customer) {
        return new Response(JSON.stringify({ error: "Customer not found" }), {
          status: 404, headers: corsHeaders,
        });
      }

      const realCustomerId = customer.id;
      const currentBalance = Number(customer.wallet_balance) || 0;
      const newBalance = currentBalance + baseAmount;

      const { error: updateError } = await supabaseClient
        .from("customers")
        .update({ wallet_balance: newBalance, updated_at: new Date().toISOString() })
        .eq("id", realCustomerId);

      if (updateError) {
        return new Response(JSON.stringify({ error: "Failed to update wallet" }), {
          status: 500, headers: corsHeaders,
        });
      }

      if (existingTopup) {
        await supabaseClient
          .from("user_wallet_topups")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("paystack_reference", reference);
      } else {
        await supabaseClient
          .from("user_wallet_topups")
          .insert({ customer_id: realCustomerId, amount: baseAmount, paystack_reference: reference, status: "completed", created_at: new Date().toISOString() });
      }

      console.log(`[USER WALLET TOPUP] ✅ Wallet topped up: GHS ${baseAmount}`);

      return new Response(
        JSON.stringify({
          message: "Customer wallet topup processed successfully",
          customer_id: realCustomerId,
          amount_credited: baseAmount,
          previous_balance: currentBalance,
          new_balance: newBalance,
          transaction_reference: reference,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // =====================================
    // AFA REGISTRATION PAYMENT HANDLER
    // =====================================
    if (paymentType === "afa_registration") {
      const {
        fullName, phoneNumber, idNumber, dateOfBirth,
        town, occupation, region, cropProduce,
        agent_store_id, subagent_store_id,
        subsubagent_store_id,
      } = metadata;

      const baseAmount = Number(metadata.base_amount) || (Number(amount) / 100);
      const afaApiKey = Deno.env.get("CLEDANET_API_KEY");
      const callbackUrl = metadata.callback_url || `${Deno.env.get("SUPABASE_URL")}/functions/v1/afa-webhook`;

      if (!fullName || !phoneNumber || !idNumber || !dateOfBirth || !town || !occupation || !region || !cropProduce) {
        return new Response(JSON.stringify({ error: "Missing required AFA registration fields" }), {
          status: 400, headers: corsHeaders,
        });
      }

      // Duplicate guard — check registration_status column
      const { data: existingReg } = await supabaseClient
        .from("afa_registrations")
        .select("id, registration_status")
        .eq("paystack_reference", reference)
        .maybeSingle();

      if (existingReg?.registration_status === "completed" || existingReg?.registration_status === "failed") {
        return new Response(JSON.stringify({ message: "AFA registration already processed" }), {
          status: 200, headers: corsHeaders,
        });
      }

      // Upsert the registration record
      const { data: afaReg, error: updateError } = await supabaseClient
        .from("afa_registrations")
        .update({ registration_status: "processing", amount_paid: baseAmount, updated_at: new Date().toISOString() })
        .eq("paystack_reference", reference)
        .select()
        .single();

      let registrationToUse = afaReg;

      if (updateError || !afaReg) {
        const { data: newReg, error: insertError } = await supabaseClient
          .from("afa_registrations")
          .insert({
            customer_name: fullName, customer_phone: phoneNumber, customer_id: idNumber,
            date_of_birth: dateOfBirth, town, occupation, region, crop: cropProduce,
            agent_store_id: agent_store_id || null,
            subagent_store_id: subagent_store_id || null,
            subsubagent_store_id: subsubagent_store_id || null,
            paystack_reference: reference, amount_paid: baseAmount,
            registration_status: "processing", updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          return new Response(JSON.stringify({ error: "Failed to create AFA registration" }), {
            status: 500, headers: corsHeaders,
          });
        }
        registrationToUse = newReg;
      }

      // ── ADMIN FLOOR PRICE ──
      // Prefer the live afa_settings value; fall back to env var (which should also be set).
      let adminFloorPrice = parseFloat(Deno.env.get("DEFAULT_AFA_PRICE") || "0");
      const { data: afaSettings } = await supabaseClient
        .from("afa_settings")
        .select("registration_fee")
        .maybeSingle();
      if (afaSettings?.registration_fee) {
        adminFloorPrice = Number(afaSettings.registration_fee);
      }

      // ── 3-TIER PROFIT SPLIT ──
      if (subsubagent_store_id) {
        // ── SUB-SUBAGENT SALE ──
        // Fetch sub-subagent store to get parent IDs
        const { data: subsubStore } = await supabaseClient
          .from("sub_subagent_stores")
          .select("subagent_store_id, agent_store_id, wallet_balance")
          .eq("id", subsubagent_store_id)
          .single();

        if (subsubStore) {
          const parentSubagentId = subsubStore.subagent_store_id;
          const agentId = subsubStore.agent_store_id;

          // What the subagent charged the sub-subagent (afa_subsubagent_base_price on subagent_stores)
          let subagentCostToSubsub = adminFloorPrice;
          if (parentSubagentId) {
            const { data: parentSub } = await supabaseClient
              .from("subagent_stores")
              .select("afa_subsubagent_base_price, afa_bundle_price")
              .eq("id", parentSubagentId)
              .single();
            subagentCostToSubsub =
              Number(parentSub?.afa_subsubagent_base_price) ||
              Number(parentSub?.afa_bundle_price) ||
              adminFloorPrice;
          }

          // What the agent charged the subagent (afa_subagent_base_price on agent_stores)
          let agentCostToSubagent = adminFloorPrice;
          if (agentId) {
            const { data: agentStore } = await supabaseClient
              .from("agent_stores")
              .select("afa_subagent_base_price, afa_bundle_price")
              .eq("id", agentId)
              .single();
            agentCostToSubagent =
              Number(agentStore?.afa_subagent_base_price) ||
              Number(agentStore?.afa_bundle_price) ||
              adminFloorPrice;
          }

          const subsubProfit       = baseAmount - subagentCostToSubsub;           // sub-subagent keeps this
          const subagentCommission = subagentCostToSubsub - agentCostToSubagent;  // subagent keeps this
          const agentCommission    = agentCostToSubagent - adminFloorPrice;        // agent keeps this

          // Credit sub-subagent profit
          if (subsubProfit > 0) {
            const newBal = (Number(subsubStore.wallet_balance) || 0) + subsubProfit;
            await supabaseClient
              .from("sub_subagent_stores")
              .update({ wallet_balance: newBal })
              .eq("id", subsubagent_store_id);
          }

          // Credit parent subagent commission
          if (parentSubagentId && subagentCommission > 0) {
            const { data: parentSubData } = await supabaseClient
              .from("subagent_stores").select("wallet_balance").eq("id", parentSubagentId).single();
            if (parentSubData) {
              await supabaseClient
                .from("subagent_stores")
                .update({ wallet_balance: (Number(parentSubData.wallet_balance) || 0) + subagentCommission })
                .eq("id", parentSubagentId);
            }
          }

          // Credit agent commission
          if (agentId && agentCommission > 0) {
            const { data: agentData } = await supabaseClient
              .from("agent_stores").select("wallet_balance").eq("id", agentId).single();
            if (agentData) {
              await supabaseClient
                .from("agent_stores")
                .update({ wallet_balance: (Number(agentData.wallet_balance) || 0) + agentCommission })
                .eq("id", agentId);
            }
          }

          await supabaseClient
            .from("afa_registrations")
            .update({ agent_profit: subsubProfit })
            .eq("id", registrationToUse.id);
        }

      } else if (subagent_store_id) {
        // ── SUBAGENT SALE ──
        const { data: sub } = await supabaseClient
          .from("subagent_stores")
          .select("afa_bundle_price, agent_store_id")
          .eq("id", subagent_store_id)
          .single();

        const subagentSellPrice = Number(sub?.afa_bundle_price) || adminFloorPrice;
        const subagentProfit    = baseAmount - subagentSellPrice;

        // Credit subagent their profit (what customer paid minus what subagent's storefront price is)
        if (subagentProfit > 0) {
          const { data: subData } = await supabaseClient
            .from("subagent_stores").select("wallet_balance").eq("id", subagent_store_id).single();
          if (subData) {
            await supabaseClient
              .from("subagent_stores")
              .update({ wallet_balance: (Number(subData.wallet_balance) || 0) + subagentProfit })
              .eq("id", subagent_store_id);
          }
        }

        // Credit agent their commission (afa_subagent_base_price minus admin floor)
        if (sub?.agent_store_id) {
          const { data: ag } = await supabaseClient
            .from("agent_stores")
            .select("afa_subagent_base_price, afa_bundle_price, wallet_balance")
            .eq("id", sub.agent_store_id)
            .single();
          if (ag) {
            const agentBaseForSubagents =
              Number(ag.afa_subagent_base_price) ||
              Number(ag.afa_bundle_price) ||
              adminFloorPrice;
            const agentCommission = agentBaseForSubagents - adminFloorPrice;
            if (agentCommission > 0) {
              await supabaseClient
                .from("agent_stores")
                .update({ wallet_balance: (Number(ag.wallet_balance) || 0) + agentCommission })
                .eq("id", sub.agent_store_id);
            }
          }
        }

        await supabaseClient
          .from("afa_registrations")
          .update({ agent_profit: subagentProfit })
          .eq("id", registrationToUse.id);

      } else if (agent_store_id) {
        // ── AGENT DIRECT SALE ──
        const { data: ag } = await supabaseClient
          .from("agent_stores")
          .select("afa_bundle_price, wallet_balance")
          .eq("id", agent_store_id)
          .single();
        if (ag) {
          const agentProfit = (Number(ag.afa_bundle_price) || adminFloorPrice) - adminFloorPrice;
          if (agentProfit > 0) {
            await supabaseClient
              .from("agent_stores")
              .update({ wallet_balance: (Number(ag.wallet_balance) || 0) + agentProfit })
              .eq("id", agent_store_id);
          }
          await supabaseClient
            .from("afa_registrations")
            .update({ agent_profit: agentProfit })
            .eq("id", registrationToUse.id);
        }
      }

      // ── Call external AFA API ──
      let externalApiSuccess = false;
      try {
        const res = await fetch("https://backend.mycledanet.com/api/afa-registration", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": afaApiKey || "" },
          body: JSON.stringify({ fullName, phoneNumber, idNumber, dateOfBirth, town, occupation, region, cropProduce, callback: callbackUrl }),
        });
        externalApiSuccess = res.ok;
      } catch (err) {
        console.error("AFA external API failed:", err);
      }

      await supabaseClient
        .from("afa_registrations")
        .update({ registration_status: externalApiSuccess ? "completed" : "failed", updated_at: new Date().toISOString() })
        .eq("id", registrationToUse.id);

      return new Response(JSON.stringify({
        message: externalApiSuccess ? "AFA registration successful" : "AFA registration failed",
        afa_registration_id: registrationToUse.id,
        registration_status: externalApiSuccess ? "completed" : "failed",
      }), { status: 200, headers: corsHeaders });
    }

    // =====================================
    // TRANSFER EVENTS HANDLER
    // =====================================
    if (["transfer.success", "transfer.failed", "transfer.reversed"].includes(payload.event)) {
      const { reference: txRef, transfer_code } = payload.data;
      const { data: payoutReq } = await supabaseClient
        .from("payout_requests").select("id, status").eq("paystack_reference", txRef).maybeSingle();

      if (!payoutReq) return new Response(JSON.stringify({ message: "Payout not found" }), { status: 200, headers: corsHeaders });
      if (["success", "failed"].includes(payoutReq.status)) return new Response(JSON.stringify({ message: "Already processed" }), { status: 200, headers: corsHeaders });

      const newStatus = payload.event === "transfer.success" ? "success" : "failed";
      const upd: any = { status: newStatus, completed_at: new Date().toISOString(), paystack_response: payload.data };
      if (payload.event === "transfer.success") upd.transfer_code = transfer_code;
      else upd.failure_reason = payload.data?.failure_reason || "Transfer failed";

      await supabaseClient.from("payout_requests").update(upd).eq("id", payoutReq.id);
      return new Response(JSON.stringify({ message: `Transfer ${payload.event} processed` }), { status: 200, headers: corsHeaders });
    }

    // =====================================
    // AGENT REGISTRATION PAYMENT HANDLER
    // =====================================
    if (paymentType === "agent_registration") {
      const agentStoreId = metadata.agent_store_id;
      if (!agentStoreId) return new Response(JSON.stringify({ error: "Missing agent store ID" }), { status: 400, headers: corsHeaders });

      const { data: store } = await supabaseClient.from("agent_stores").select("approved").eq("id", agentStoreId).single();
      if (store?.approved) return new Response(JSON.stringify({ message: "Already processed" }), { status: 200, headers: corsHeaders });

      await supabaseClient.from("agent_stores").update({ approved: true }).eq("id", agentStoreId);
      return new Response(JSON.stringify({ message: "Agent store approved", agent_store_id: agentStoreId }), { status: 200, headers: corsHeaders });
    }

    // =====================================
    // WALLET TOPUP HANDLER (Agent)
    // =====================================
    if (paymentType === "wallet_topup") {
      const agentStoreId = metadata.agent_store_id;
      const baseAmount = Number(metadata.base_amount) || (Number(amount) / 100);
      if (!agentStoreId) return new Response(JSON.stringify({ error: "Missing agent store ID" }), { status: 400, headers: corsHeaders });

      const { data: existing } = await supabaseClient.from("wallet_topups").select("id").eq("paystack_reference", reference).maybeSingle();
      if (existing) return new Response(JSON.stringify({ message: "Topup already processed" }), { status: 200, headers: corsHeaders });

      const { data: store } = await supabaseClient.from("agent_stores").select("wallet_balance").eq("id", agentStoreId).single();
      if (store) {
        await supabaseClient.from("agent_stores").update({ wallet_balance: (Number(store.wallet_balance) || 0) + baseAmount }).eq("id", agentStoreId);
        await supabaseClient.from("wallet_topups").insert({ agent_store_id: agentStoreId, amount: baseAmount, paystack_reference: reference });
      }
      return new Response(JSON.stringify({ message: "Wallet topup processed" }), { status: 200, headers: corsHeaders });
    }

    // =====================================
    // SUBAGENT WALLET TOPUP HANDLER
    // =====================================
    if (paymentType === "subagent_wallet_topup") {
      const subagentStoreId = metadata.subagent_store_id;
      const baseAmount = Number(metadata.base_amount) || (Number(amount) / 100);
      if (!subagentStoreId) return new Response(JSON.stringify({ error: "Missing subagent store ID" }), { status: 400, headers: corsHeaders });

      const { data: existing } = await supabaseClient.from("subagent_wallet_topups").select("id").eq("paystack_reference", reference).maybeSingle();
      if (existing) return new Response(JSON.stringify({ message: "Topup already processed" }), { status: 200, headers: corsHeaders });

      const { data: store } = await supabaseClient.from("subagent_stores").select("wallet_balance").eq("id", subagentStoreId).single();
      if (store) {
        await supabaseClient.from("subagent_stores").update({ wallet_balance: (Number(store.wallet_balance) || 0) + baseAmount }).eq("id", subagentStoreId);
        await supabaseClient.from("subagent_wallet_topups").insert({ subagent_store_id: subagentStoreId, amount: baseAmount, paystack_reference: reference });
      }
      return new Response(JSON.stringify({ message: "Subagent wallet topup processed" }), { status: 200, headers: corsHeaders });
    }

    // =====================================
    // SUBSUBAGENT WALLET TOPUP HANDLER
    // =====================================
    if (paymentType === "subsubagent_wallet_topup") {
      const subsubagentStoreId = metadata.subsubagent_store_id;
      const baseAmount = Number(metadata.base_amount) || (Number(amount) / 100);
      if (!subsubagentStoreId) return new Response(JSON.stringify({ error: "Missing subsubagent store ID" }), { status: 400, headers: corsHeaders });

      const { data: existing } = await supabaseClient.from("sub_subagent_wallet_topups").select("id").eq("paystack_reference", reference).maybeSingle();
      if (existing) return new Response(JSON.stringify({ message: "Topup already processed" }), { status: 200, headers: corsHeaders });

      const { data: store } = await supabaseClient.from("sub_subagent_stores").select("wallet_balance").eq("id", subsubagentStoreId).single();
      if (store) {
        await supabaseClient.from("sub_subagent_stores").update({ wallet_balance: (Number(store.wallet_balance) || 0) + baseAmount }).eq("id", subsubagentStoreId);
        await supabaseClient.from("sub_subagent_wallet_topups").insert({ sub_subagent_store_id: subsubagentStoreId, amount: baseAmount, paystack_reference: reference });
      }
      return new Response(JSON.stringify({ message: "Subsubagent wallet topup processed" }), { status: 200, headers: corsHeaders });
    }

    // =====================================
    // BULK ORDER PAYMENT HANDLER
    // =====================================
    if (paymentType === "bulk_order") {
      const network = metadata.network;
      const recipientsJson = metadata.recipients;
      const agentStoreId = metadata.agent_store_id || null;
      const subagentStoreId = metadata.subagent_store_id || null;
      const customerId = metadata.customer_id || null;

      if (!recipientsJson || !network) return new Response(JSON.stringify({ error: "Missing bulk order data" }), { status: 400, headers: corsHeaders });

      const { data: existingBulk } = await supabaseClient.from("orders").select("id").like("paystack_reference", `${reference}%`).maybeSingle();
      if (existingBulk) return new Response(JSON.stringify({ message: "Bulk order already processed" }), { status: 200, headers: corsHeaders });

      let recipients: Array<{ phone: string; size_gb: number; package_id: string; price: number }> = [];
      try { recipients = JSON.parse(recipientsJson); } catch { return new Response(JSON.stringify({ error: "Invalid recipients data" }), { status: 400, headers: corsHeaders }); }

      const { data: pkgData } = await supabaseClient.from("data_packages").select("id, agent_price, price");
      const packagePrices: Record<string, { agent_price: number; price: number }> = {};
      if (pkgData) for (const p of pkgData) packagePrices[p.id] = { agent_price: Number(p.agent_price) || 0, price: Number(p.price) || 0 };

      let parentAgentId: string | null = null;
      let subagentPrices: Record<string, number> = {};

      if (subagentStoreId) {
        const { data: ss } = await supabaseClient.from("subagent_stores").select("agent_store_id").eq("id", subagentStoreId).single();
        if (ss) {
          parentAgentId = ss.agent_store_id;
          const { data: sp } = await supabaseClient.from("subagent_package_prices").select("package_id, base_price").eq("agent_store_id", parentAgentId);
          if (sp) for (const s of sp) subagentPrices[s.package_id] = Number(s.base_price) || 0;
        }
      }

      const createdOrders: string[] = [];
      const failedOrders: string[] = [];
      let totalAgentProfit = 0, totalSubagentProfit = 0, totalAgentCommission = 0;

      for (let i = 0; i < recipients.length; i++) {
        const r = recipients[i];
        try {
          const pkg = packagePrices[r.package_id] || { agent_price: 0, price: r.price };
          const adminBase = pkg.agent_price || pkg.price;
          let base = adminBase, profit = 0;

          if (subagentStoreId && parentAgentId) {
            const agentToSub = subagentPrices[r.package_id] || adminBase;
            base = agentToSub; profit = r.price - agentToSub;
            totalSubagentProfit += profit; totalAgentCommission += agentToSub - adminBase;
          } else if (agentStoreId) {
            profit = r.price - adminBase; totalAgentProfit += profit;
          }

          const od: Record<string, unknown> = {
            customer_number: r.phone, package_id: r.package_id, network,
            size_gb: r.size_gb, amount: r.price, status: "paid", fulfillment_status: "pending",
            paystack_reference: `${reference}_${i + 1}`, payment_method: "paystack",
            selling_price: r.price, base_price: base, profit,
          };
          if (customerId) od.customer_id = customerId;
          if (agentStoreId) od.agent_store_id = agentStoreId;
          if (subagentStoreId) od.subagent_store_id = subagentStoreId;

          const { data: ord, error: oe } = await supabaseClient.from("orders").insert(od).select("id").single();
          if (oe) { failedOrders.push(r.phone); continue; }
          createdOrders.push(ord.id);

          try {
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/fulfill-order`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
              body: JSON.stringify({ order_id: ord.id }),
            });
          } catch (e) { console.error(`Fulfill failed:`, e); }
        } catch { failedOrders.push(r.phone); }
      }

      if (subagentStoreId && totalSubagentProfit > 0) {
        const { data: ss } = await supabaseClient.from("subagent_stores").select("wallet_balance").eq("id", subagentStoreId).single();
        if (ss) await supabaseClient.from("subagent_stores").update({ wallet_balance: (Number(ss.wallet_balance) || 0) + totalSubagentProfit }).eq("id", subagentStoreId);
      }
      if (parentAgentId && totalAgentCommission > 0) {
        const { data: as } = await supabaseClient.from("agent_stores").select("subagent_commission_balance").eq("id", parentAgentId).single();
        if (as) await supabaseClient.from("agent_stores").update({ subagent_commission_balance: (Number(as.subagent_commission_balance) || 0) + totalAgentCommission }).eq("id", parentAgentId);
      }
      if (agentStoreId && !subagentStoreId && totalAgentProfit > 0) {
        const { data: as } = await supabaseClient.from("agent_stores").select("wallet_balance").eq("id", agentStoreId).single();
        if (as) await supabaseClient.from("agent_stores").update({ wallet_balance: (Number(as.wallet_balance) || 0) + totalAgentProfit }).eq("id", agentStoreId);
      }

      return new Response(JSON.stringify({ message: "Bulk order processed", created_orders: createdOrders.length, failed_orders: failedOrders.length }), { status: 200, headers: corsHeaders });
    }

    // =====================================
    // DATA PACKAGE PURCHASE HANDLER (Default)
    // =====================================
    console.log(`[DATA PACKAGE] Processing regular package purchase`);

    const phone = metadata?.phone ?? "";
    const package_id = metadata?.package_id ?? "";
    const network = metadata?.network ?? "";
    const package_name = metadata?.package_name ?? "";
    const agent_store_id = metadata?.agent_store_id ?? null;
    const subagent_store_id = metadata?.subagent_store_id ?? null;
    const subsubagent_store_id = metadata?.subsubagent_store_id ?? null;
    const sizeMatch = package_name.match(/(\d+(?:\.\d+)?)/);
    const sizeGb = sizeMatch ? parseFloat(sizeMatch[1]) : 0;
    const amountPaid = Number(amount) / 100;
    const roundedBaseAmount = Math.round((amountPaid - amountPaid * (PAYSTACK_FEE_PERCENT / 100)) * 100) / 100;

    const { data: existingOrder } = await supabaseClient.from("orders").select("id").eq("paystack_reference", reference).maybeSingle();
    if (existingOrder) return new Response(JSON.stringify({ message: "Order already processed", order_id: existingOrder.id }), { status: 200, headers: corsHeaders });

    const { data: pkgData } = await supabaseClient.from("data_packages").select("agent_price").eq("id", package_id).single();
    const adminBasePrice = pkgData?.agent_price ? Number(pkgData.agent_price) : 0;

    let basePriceForOrder = adminBasePrice;
    let profitForOrder = 0;

    if (subsubagent_store_id) {
      // ========== SUBSUBAGENT PURCHASE (3-tier split) ==========
      const { data: subsubStore } = await supabaseClient
        .from("sub_subagent_stores")
        .select("subagent_store_id, agent_store_id, wallet_balance")
        .eq("id", subsubagent_store_id)
        .single();

      if (!subsubStore) {
        return new Response(JSON.stringify({ error: "SubSubagent store not found" }), { status: 404, headers: corsHeaders });
      }

      const parentSubagentId = subsubStore.subagent_store_id;
      const agentId = subsubStore.agent_store_id;

      // What the SUBSUBAGENT pays the SUBAGENT (their cost from the subagent's price row).
      let subsubCost = adminBasePrice;
      if (parentSubagentId) {
        const { data: costRows } = await supabaseClient
          .from("sub_subagent_package_prices")
          .select("base_price, sub_subagent_store_id")
          .eq("subagent_store_id", parentSubagentId)
          .eq("package_id", package_id);
        if (costRows && costRows.length) {
          const specific = costRows.find((r) => r.sub_subagent_store_id === subsubagent_store_id);
          const template = costRows.find((r) => r.sub_subagent_store_id === null);
          const chosen = specific || template;
          if (chosen && chosen.base_price != null) subsubCost = Number(chosen.base_price);
        }
      }

      // What the SUBAGENT pays the AGENT (subagent_package_prices.base_price).
      // FIX: was using agentSellPrice (agent_package_prices.sell_price) which is a
      // different price tier and caused over-crediting. Use agentPriceToSubagent instead.
      let agentPriceToSubagent = adminBasePrice;
      if (agentId) {
        const { data: subPrice } = await supabaseClient
          .from("subagent_package_prices")
          .select("base_price")
          .eq("agent_store_id", agentId)
          .eq("package_id", package_id)
          .maybeSingle();
        if (subPrice?.base_price != null) agentPriceToSubagent = Number(subPrice.base_price);
      }

      const subsubagentSellingPrice = roundedBaseAmount;
      basePriceForOrder = subsubCost;
      profitForOrder = subsubagentSellingPrice - subsubCost;

      console.log(`[SUBSUBAGENT PURCHASE] selling=${subsubagentSellingPrice.toFixed(2)}, subsubCost=${subsubCost.toFixed(2)}, agentToSub=${agentPriceToSubagent.toFixed(2)}, adminBase=${adminBasePrice.toFixed(2)}`);

      // === CREDIT SUBSUBAGENT PROFIT ===
      if (profitForOrder > 0) {
        const newBal = (Number(subsubStore.wallet_balance) || 0) + profitForOrder;
        await supabaseClient.from("sub_subagent_stores").update({ wallet_balance: newBal }).eq("id", subsubagent_store_id);
        console.log(`[SUBSUBAGENT PURCHASE] SubSubagent profit +${profitForOrder} (balance ${newBal})`);
      }

      // === CREDIT SUBAGENT COMMISSION ===
      if (parentSubagentId) {
        const subagentCommission = subsubCost - agentPriceToSubagent;
        if (subagentCommission > 0) {
          const { data: parentSub } = await supabaseClient.from("subagent_stores").select("wallet_balance").eq("id", parentSubagentId).single();
          if (parentSub) {
            const newBal = (Number(parentSub.wallet_balance) || 0) + subagentCommission;
            await supabaseClient.from("subagent_stores").update({ wallet_balance: newBal }).eq("id", parentSubagentId);
            console.log(`[SUBSUBAGENT PURCHASE] Subagent commission +${subagentCommission} (balance ${newBal})`);
          }
        }
      }

      // === CREDIT AGENT COMMISSION (FIX: use agentPriceToSubagent, not agentSellPrice) ===
      if (agentId) {
        const agentCommission = agentPriceToSubagent - adminBasePrice;
        if (agentCommission > 0) {
          const { data: agentStore } = await supabaseClient.from("agent_stores").select("subagent_commission_balance").eq("id", agentId).single();
          if (agentStore) {
            const newBal = (Number(agentStore.subagent_commission_balance) || 0) + agentCommission;
            await supabaseClient.from("agent_stores").update({ subagent_commission_balance: newBal }).eq("id", agentId);
            console.log(`[SUBSUBAGENT PURCHASE] Agent commission +${agentCommission} (balance ${newBal})`);
          }
        }
      }

    } else if (subagent_store_id) {
      // ========== SUBAGENT PURCHASE ==========
      const { data: subagentStore } = await supabaseClient
        .from("subagent_stores")
        .select("agent_store_id, wallet_balance")
        .eq("id", subagent_store_id)
        .single();

      if (!subagentStore) {
        return new Response(JSON.stringify({ error: "Subagent store not found" }), { status: 404, headers: corsHeaders });
      }

      const { data: packagePrice } = await supabaseClient
        .from("subagent_package_prices")
        .select("base_price")
        .eq("subagent_store_id", subagent_store_id)
        .eq("package_id", package_id)
        .maybeSingle();

      const agentPriceToSubagent = packagePrice?.base_price != null
        ? Number(packagePrice.base_price)
        : adminBasePrice;

      const subagentSellingPrice = roundedBaseAmount;
      basePriceForOrder = agentPriceToSubagent;
      profitForOrder = subagentSellingPrice - basePriceForOrder;

      console.log(`[SUBAGENT PURCHASE] selling=${subagentSellingPrice.toFixed(2)}, cost=${basePriceForOrder.toFixed(2)}, profit=${profitForOrder.toFixed(2)}`);

      if (profitForOrder > 0) {
        const newWalletBalance = (Number(subagentStore.wallet_balance) || 0) + profitForOrder;
        await supabaseClient.from("subagent_stores").update({ wallet_balance: newWalletBalance }).eq("id", subagent_store_id);
        console.log(`[SUBAGENT PURCHASE] Subagent profit: +${profitForOrder}, new balance: ${newWalletBalance}`);
      }

      if (subagentStore.agent_store_id) {
        const { data: agentPrice } = await supabaseClient
          .from("agent_package_prices")
          .select("sell_price")
          .eq("agent_store_id", subagentStore.agent_store_id)
          .eq("package_id", package_id)
          .maybeSingle();

        const agentCommission = (agentPrice?.sell_price != null
          ? Number(agentPrice.sell_price)
          : adminBasePrice) - adminBasePrice;

        if (agentCommission > 0) {
          const { data: agentStore } = await supabaseClient
            .from("agent_stores").select("subagent_commission_balance").eq("id", subagentStore.agent_store_id).single();
          if (agentStore) {
            const newBalance = (Number(agentStore.subagent_commission_balance) || 0) + agentCommission;
            await supabaseClient.from("agent_stores").update({ subagent_commission_balance: newBalance }).eq("id", subagentStore.agent_store_id);
            console.log(`[SUBAGENT PURCHASE] Agent commission: +${agentCommission}, new balance: ${newBalance}`);
          }
        }
      }

    } else if (agent_store_id) {
      // ========== AGENT PURCHASE ==========
      basePriceForOrder = adminBasePrice;
      profitForOrder = roundedBaseAmount - adminBasePrice;

      if (profitForOrder > 0) {
        const { data: agentStore } = await supabaseClient
          .from("agent_stores").select("wallet_balance").eq("id", agent_store_id).single();
        if (agentStore) {
          const newBalance = (Number(agentStore.wallet_balance) || 0) + profitForOrder;
          await supabaseClient.from("agent_stores").update({ wallet_balance: newBalance }).eq("id", agent_store_id);
          console.log(`[AGENT PURCHASE] Agent profit: +${profitForOrder}, new balance: ${newBalance}`);
        }
      }
    }

    const orderData: Record<string, unknown> = {
      customer_number: phone, package_id, network, size_gb: sizeGb,
      amount: roundedBaseAmount, status: "paid", fulfillment_status: "pending",
      paystack_reference: reference, payment_method: "paystack",
      selling_price: roundedBaseAmount, base_price: basePriceForOrder, profit: profitForOrder,
    };
    if (metadata?.customer_id) orderData.customer_id = metadata.customer_id;
    if (agent_store_id) orderData.agent_store_id = agent_store_id;
    if (subagent_store_id) orderData.subagent_store_id = subagent_store_id;
    if (subsubagent_store_id) orderData.sub_subagent_store_id = subsubagent_store_id;

    const { data: order, error: orderInsertError } = await supabaseClient.from("orders").insert(orderData).select("id").single();
    if (orderInsertError) {
      console.error("Failed to insert order:", orderInsertError);
      return new Response(JSON.stringify({ error: "Failed to create order" }), { status: 500, headers: corsHeaders });
    }

    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/fulfill-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
        body: JSON.stringify({ order_id: order.id }),
      });
    } catch (err) { console.error("Fulfill trigger failed:", err); }

    return new Response(JSON.stringify({ message: "Payment processed successfully", order_id: order.id }), { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), { status: 500, headers: corsHeaders });
  }
});
