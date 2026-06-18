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
      "raw",
      key,
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
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
      console.error("Missing x-paystack-signature header");
      return new Response(JSON.stringify({ error: "No signature provided" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const rawBody = await req.text();

    const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secret) {
      console.error("PAYSTACK_SECRET_KEY environment variable not set");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const isValid = await verifySignature(secret, signature, rawBody);

    if (!isValid) {
      console.error("Invalid signature - webhook rejected");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("Signature verified successfully");

    const payload = JSON.parse(rawBody);
    console.log(`Event type: ${payload.event}`);

    if (payload.event !== "charge.success") {
      console.log(`Ignoring event: ${payload.event}`);
      return new Response(JSON.stringify({ message: "Event ignored" }), {
        status: 200,
        headers: corsHeaders
      });
    }

    const { reference, metadata, amount } = payload.data;
    const paymentType = metadata?.type;

    console.log(`Processing payment: ${reference}`);
    console.log(`Processing payment: ${metadata?.data_package_id}`);
    console.log(`Amount paid (including fee): GHS ${Number(amount) / 100}`);
    console.log(`Payment type: ${paymentType || "package_purchase"}`);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // =====================================
    // SUBAGENT REGISTRATION PAYMENT HANDLER
    // =====================================
    if (paymentType === "subagent_registration") {
      const subagentRegistrationId = metadata.subagent_registration_id;
      const agentStoreId = metadata.agent_store_id;
      const baseAmount = Number(metadata.base_amount) || (Number(amount) / 100);

      if (!subagentRegistrationId || !agentStoreId) {
        console.error("Missing subagent_registration_id or agent_store_id");
        return new Response(JSON.stringify({ error: "Missing registration or agent store ID" }), {
          status: 400,
          headers: corsHeaders
        });
      }

      console.log(`Processing subagent registration payment for registration: ${subagentRegistrationId}, agent: ${agentStoreId}`);

      // Check if registration payment already processed
      const { data: existingRegistration } = await supabaseClient
        .from("subagent_registrations")
        .select("id, status, payment_status")
        .eq("id", subagentRegistrationId)
        .maybeSingle();

      if (existingRegistration) {
        if (existingRegistration.payment_status === "paid" || existingRegistration.status === "completed") {
          console.log(`Subagent registration already processed for ${subagentRegistrationId}`);
          return new Response(JSON.stringify({ message: "Registration already processed" }), {
            status: 200,
            headers: corsHeaders
          });
        }
      }

      // Update registration payment status
      const { data: updatedRegistration, error: updateError } = await supabaseClient
        .from("subagent_registrations")
        .update({
          payment_status: "paid",
          payment_reference: reference,
          status: "approved",
          updated_at: new Date().toISOString(),
        })
        .eq("id", subagentRegistrationId)
        .select()
        .single();

      if (updateError || !updatedRegistration) {
        console.error("Failed to update subagent registration:", updateError);
        return new Response(JSON.stringify({ error: "Failed to update registration" }), {
          status: 500,
          headers: corsHeaders
        });
      }

      console.log(`Subagent registration ${subagentRegistrationId} payment processed successfully`);

      // Credit agent wallet with the subagent registration fee
      const { data: agentStore } = await supabaseClient
        .from("agent_stores")
        .select("wallet_balance")
        .eq("id", agentStoreId)
        .single();

      if (agentStore) {
        const newWalletBalance = (Number(agentStore.wallet_balance) || 0) + baseAmount;
        const { error: walletUpdateError } = await supabaseClient
          .from("agent_stores")
          .update({ wallet_balance: newWalletBalance })
          .eq("id", agentStoreId);

        if (walletUpdateError) {
          console.error("Failed to update agent wallet balance:", walletUpdateError);
        } else {
          console.log(`Agent wallet credited: +GHS ${baseAmount.toFixed(2)}, new balance: GHS ${newWalletBalance.toFixed(2)}`);
        }
      }

      return new Response(JSON.stringify({
        message: "Subagent registration payment processed successfully",
        subagent_registration_id: subagentRegistrationId,
        status: "completed",
        amount_paid: baseAmount
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // =====================================
    // AFA REGISTRATION PAYMENT HANDLER
    // =====================================
    if (paymentType === "afa_registration") {
      const {
        fullName,
        phoneNumber,
        idNumber,
        dateOfBirth,
        town,
        occupation,
        region,
        cropProduce,
        agent_store_id,
        subagent_store_id,
      } = metadata;

      const baseAmount = Number(metadata.base_amount) || (Number(amount) / 100);
      const ******** = Deno.env.get("AFA_API_KEY");
      const callbackUrl = metadata.callback_url || `${Deno.env.get("SUPABASE_URL")}/functions/v1/afa-webhook`;

      // Validate required fields
      if (!fullName || !phoneNumber || !idNumber || !dateOfBirth || !town || !occupation || !region || !cropProduce) {
        console.error("Missing required AFA registration fields");
        return new Response(JSON.stringify({ error: "Missing required AFA registration fields" }), {
          status: 400,
          headers: corsHeaders
        });
      }

      // Check if AFA registration has already been processed
      const { data: existingRegistration } = await supabaseClient
        .from("afa_registrations")
        .select("id, status, external_api_response")
        .eq("paystack_reference", reference)
        .maybeSingle();

      if (existingRegistration) {
        // Only skip if already completed or processing (not pending_payment)
        if (existingRegistration.status === "completed" || existingRegistration.status === "failed") {
          console.log(`AFA registration already processed for reference ${reference} with status: ${existingRegistration.status}`);
          return new Response(JSON.stringify({ message: "AFA registration already processed" }), {
            status: 200,
            headers: corsHeaders
          });
        }
        
        // If status is still "pending_payment" or "processing", continue to process
        console.log(`AFA registration exists but status is ${existingRegistration.status}, continuing to process...`);
      }

      // Update the registration record from pending_payment to processing
      const { data: afaRegistration, error: updateError } = await supabaseClient
        .from("afa_registrations")
        .update({
          registration_status: "processing",
          amount_paid: baseAmount,
          updated_at: new Date().toISOString(),
        })
        .eq("paystack_reference", reference)
        .select()
        .single();

      if (updateError || !afaRegistration) {
        console.error("Failed to update AFA registration:", updateError);
        
        // Try to create if update fails (should not happen normally)
        const { data: newRegistration, error: insertError } = await supabaseClient
          .from("afa_registrations")
          .insert({
            customer_name: fullName,
            customer_phone: phoneNumber,
            customer_id: idNumber,
            date_of_birth: dateOfBirth,
            town: town,
            occupation: occupation,
            region: region,
            crop: cropProduce,
            agent_store_id: agent_store_id || null,
            subagent_store_id: subagent_store_id || null,
            paystack_reference: reference,
            amount_paid: baseAmount,
            registration_status: "processing",
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (insertError) {
          console.error("Failed to create AFA registration:", insertError);
          return new Response(JSON.stringify({ error: "Failed to create AFA registration" }), {
            status: 500,
            headers: corsHeaders
          });
        }
        
        // Continue with the new registration
        var registrationToUse = newRegistration;
      } else {
        var registrationToUse = afaRegistration;
      }

      console.log(`AFA registration record updated: ${registrationToUse.id} for ${phoneNumber}`);

      // Calculate profit for agent/subagent
      let profitAmount = 0;
      const DEFAULT_AFA_PRICE = parseFloat(Deno.env.get("DEFAULT_AFA_PRICE") || "0");

      if (subagent_store_id) {
        // Get subagent's afa_bundle_price
        const { data: subagent } = await supabaseClient
          .from("subagent_stores")
          .select("afa_bundle_price")
          .eq("id", subagent_store_id)
          .single();

        if (subagent && subagent.afa_bundle_price) {
          profitAmount = baseAmount - subagent.afa_bundle_price;
          console.log(`Subagent profit: GHS ${profitAmount.toFixed(2)} (${baseAmount} - ${subagent.afa_bundle_price})`);
        }
      } 
      else if (agent_store_id) {
        // Get agent's afa_bundle_price
        const { data: agent } = await supabaseClient
          .from("agent_stores")
          .select("afa_bundle_price")
          .eq("id", agent_store_id)
          .single();

        if (agent && agent.afa_bundle_price) {
          profitAmount = agent.afa_bundle_price - DEFAULT_AFA_PRICE;
          console.log(`Agent profit: GHS ${profitAmount.toFixed(2)} ( ${agent.afa_bundle_price} - ${DEFAULT_AFA_PRICE})`);
        }
      }

      // Update afa_profit field if profit exists
      if (profitAmount > 0 && agent_store_id) {
        const { data: agent } = await supabaseClient
          .from("agent_stores")
          .select("wallet_balance")
          .eq("id", agent_store_id)
          .single();

        if (agent) {
          const newWalletBalance = (Number(agent.wallet_balance) || 0) + profitAmount;
          const { error: walletUpdateError } = await supabaseClient
            .from("agent_stores")
            .update({ wallet_balance: newWalletBalance })
            .eq("id", agent_store_id);

          if (walletUpdateError) {
            console.error("Failed to update agent wallet balance:", walletUpdateError);
          } else {
            console.log(`Agent wallet balance updated: +GHS ${profitAmount.toFixed(2)}, new balance: GHS ${newWalletBalance.toFixed(2)}`);
          }
        }
      }

      // Prepare payload for external API
      const externalApiPayload = {
        fullName: fullName,
        phoneNumber: phoneNumber,
        idNumber: idNumber,
        dateOfBirth: dateOfBirth,
        town: town,
        occupation: occupation,
        region: region,
        cropProduce: cropProduce,
        callback: callbackUrl,
      };

      console.log(`Sending registration to external API for ${phoneNumber}...`);

      // Send to external API
      let externalApiResponse;
      let externalApiSuccess = false;
      let externalApiMessage = "";

      try {
        const response = await fetch("https://backend.mycledanet.com/api/afa-registration", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ******** || "",
          },
          body: JSON.stringify(externalApiPayload),
        });

        externalApiResponse = await response.json();
        externalApiSuccess = response.ok;
        externalApiMessage = externalApiResponse.message || (externalApiSuccess ? "Registration sent successfully" : "Registration failed");

        console.log(`External API response:`, JSON.stringify(externalApiResponse));
      } catch (err) {
        console.error("External API request failed:", err);
        externalApiSuccess = false;
        externalApiMessage = err instanceof Error ? err.message : "Network error";
      }

      // Update registration with external API response
      const finalStatus = externalApiSuccess ? "completed" : "failed";
      const finalErrorMessage = externalApiSuccess ? null : externalApiMessage;

      const { error: finalUpdateError } = await supabaseClient
        .from("afa_registrations")
        .update({
          registration_status: finalStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", registrationToUse.id);

      if (finalUpdateError) {
        console.error("Failed to update final status:", finalUpdateError);
      }

      console.log(`AFA registration completed: ${registrationToUse.id}, status: ${finalStatus}`);

      return new Response(JSON.stringify({
        message: externalApiSuccess ? "AFA registration successful" : "AFA registration failed",
        afa_registration_id: registrationToUse.id,
        registration_status: finalStatus,
        external_api_response: externalApiResponse,
        profit: profitAmount,
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // =====================================
    // TRANSFER EVENTS HANDLER (Payouts)
    // =====================================
    if (payload.event === "transfer.success" || payload.event === "transfer.failed" || payload.event === "transfer.reversed") {
      const { reference, amount, transfer_code, recipient, status } = payload.data;
      
      console.log(`[WEBHOOK] Transfer event: ${payload.event}, reference: ${reference}, transfer_code: ${transfer_code}`);

      // Find the payout request by paystack_reference
      const { data: payoutRequest, error: findError } = await supabaseClient
        .from("payout_requests")
        .select("id, status, amount, requester_type, requester_id")
        .eq("paystack_reference", reference)
        .maybeSingle();

      if (findError || !payoutRequest) {
        console.log(`[WEBHOOK] Payout request not found for reference: ${reference}`);
        return new Response(JSON.stringify({ message: "Payout request not found" }), {
          status: 200,
          headers: corsHeaders
        });
      }

      // Check if already processed
      if (payoutRequest.status === "success" || payoutRequest.status === "failed") {
        console.log(`[WEBHOOK] Payout request ${payoutRequest.id} already ${payoutRequest.status}`);
        return new Response(JSON.stringify({ message: "Already processed" }), {
          status: 200,
          headers: corsHeaders
        });
      }

      if (payload.event === "transfer.success") {
        console.log(`[WEBHOOK] Transfer successful for ${payoutRequest.id}`);

        const { error: updateError } = await supabaseClient
          .from("payout_requests")
          .update({
            status: "success",
            transfer_code: transfer_code,
            completed_at: new Date().toISOString(),
            paystack_response: payload.data
          })
          .eq("id", payoutRequest.id);

        if (updateError) {
          console.error(`[WEBHOOK] Failed to update payout request:`, updateError.message);
          return new Response(JSON.stringify({ error: "Failed to update status" }), {
            status: 500,
            headers: corsHeaders
          });
        }

        console.log(`[WEBHOOK] Payout request ${payoutRequest.id} marked as success`);
      }

      else if (payload.event === "transfer.failed" || payload.event === "transfer.reversed") {
        const failureReason = payload.data?.failure_reason || 
                              (payload.event === "transfer.reversed" ? "Transfer reversed by bank" : "Transfer failed");
        
        console.log(`[WEBHOOK] Transfer failed for ${payoutRequest.id}, reason: ${failureReason}`);

        const { error: updateError } = await supabaseClient
          .from("payout_requests")
          .update({
            status: "failed",
            failure_reason: failureReason,
            completed_at: new Date().toISOString(),
            paystack_response: payload.data
          })
          .eq("id", payoutRequest.id);

        if (updateError) {
          console.error(`[WEBHOOK] Failed to update payout request:`, updateError.message);
          return new Response(JSON.stringify({ error: "Failed to update status" }), {
            status: 500,
            headers: corsHeaders
          });
        }

        console.log(`[WEBHOOK] Payout request ${payoutRequest.id} marked as failed. No wallet refund - admin handling required.`);
      }

      return new Response(JSON.stringify({ 
        message: `Transfer ${payload.event} processed`,
        payout_request_id: payoutRequest.id
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // =====================================
    // AGENT REGISTRATION PAYMENT HANDLER
    // =====================================
    if (paymentType === "agent_registration") {
      const agentStoreId = metadata.agent_store_id;
      
      if (!agentStoreId) {
        console.error("Missing agent_store_id for registration payment");
        return new Response(JSON.stringify({ error: "Missing agent store ID" }), {
          status: 400,
          headers: corsHeaders
        });
      }

      const { data: storeData } = await supabaseClient
        .from("agent_stores")
        .select("approved")
        .eq("id", agentStoreId)
        .single();

      if (storeData?.approved) {
        console.log(`Registration already processed for reference ${reference}`);
        return new Response(JSON.stringify({ message: "Payment already processed" }), {
          status: 200,
          headers: corsHeaders
        });
      }

      const { error: approveError } = await supabaseClient
        .from("agent_stores")
        .update({ approved: true })
        .eq("id", agentStoreId);

      if (approveError) {
        console.error("Failed to approve agent store:", approveError);
        return new Response(JSON.stringify({ error: "Failed to approve store" }), {
          status: 500,
          headers: corsHeaders
        });
      }

      console.log(`Agent store ${agentStoreId} approved via Paystack payment`);

      return new Response(JSON.stringify({
        message: "Agent store approved successfully",
        agent_store_id: agentStoreId
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // =====================================
    // WALLET TOPUP HANDLER (Agent)
    // =====================================
    if (paymentType === "wallet_topup") {
      const agentStoreId = metadata.agent_store_id;
      const baseAmount = Number(metadata.base_amount) || (Number(amount) / 100);

      if (!agentStoreId) {
        console.error("Missing agent_store_id for wallet topup");
        return new Response(JSON.stringify({ error: "Missing agent store ID" }), {
          status: 400,
          headers: corsHeaders
        });
      }

      const { data: existingTopup } = await supabaseClient
        .from("wallet_topups")
        .select("id")
        .eq("paystack_reference", reference)
        .maybeSingle();

      if (existingTopup) {
        console.log(`Wallet topup already processed for reference ${reference}`);
        return new Response(JSON.stringify({ message: "Topup already processed" }), {
          status: 200,
          headers: corsHeaders
        });
      }

      const { data: store } = await supabaseClient
        .from("agent_stores")
        .select("wallet_balance")
        .eq("id", agentStoreId)
        .single();

      if (store) {
        const newBalance = (Number(store.wallet_balance) || 0) + baseAmount;
        await supabaseClient
          .from("agent_stores")
          .update({ wallet_balance: newBalance })
          .eq("id", agentStoreId);

        await supabaseClient.from("wallet_topups").insert({
          agent_store_id: agentStoreId,
          amount: baseAmount,
          paystack_reference: reference,
        });

        console.log(`Agent wallet topped up: ${baseAmount} for store ${agentStoreId}`);
      }

      return new Response(JSON.stringify({ message: "Wallet topup processed" }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // =====================================
    // SUBAGENT WALLET TOPUP HANDLER
    // =====================================
    if (paymentType === "subagent_wallet_topup") {
      const subagentStoreId = metadata.subagent_store_id;
      const baseAmount = Number(metadata.base_amount) || (Number(amount) / 100);

      if (!subagentStoreId) {
        console.error("Missing subagent_store_id for wallet topup");
        return new Response(JSON.stringify({ error: "Missing subagent store ID" }), {
          status: 400,
          headers: corsHeaders
        });
      }

      const { data: existingTopup } = await supabaseClient
        .from("subagent_wallet_topups")
        .select("id")
        .eq("paystack_reference", reference)
        .maybeSingle();

      if (existingTopup) {
        console.log(`Subagent wallet topup already processed for reference ${reference}`);
        return new Response(JSON.stringify({ message: "Topup already processed" }), {
          status: 200,
          headers: corsHeaders
        });
      }

      const { data: store } = await supabaseClient
        .from("subagent_stores")
        .select("wallet_balance")
        .eq("id", subagentStoreId)
        .single();

      if (store) {
        const newBalance = (Number(store.wallet_balance) || 0) + baseAmount;
        await supabaseClient
          .from("subagent_stores")
          .update({ wallet_balance: newBalance })
          .eq("id", subagentStoreId);

        await supabaseClient.from("subagent_wallet_topups").insert({
          subagent_store_id: subagentStoreId,
          amount: baseAmount,
          paystack_reference: reference,
        });

        console.log(`Subagent wallet topped up: ${baseAmount} for store ${subagentStoreId}`);
      }

      return new Response(JSON.stringify({ message: "Subagent wallet topup processed" }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // =====================================
    // BULK ORDER PAYMENT HANDLER
    // =====================================
    if (paymentType === "bulk_order") {
      const network = metadata.network;
      const recipientsJson = metadata.recipients;
      const totalGb = metadata.total_gb;
      const recipientCount = metadata.recipient_count;
      const agentStoreId = metadata.agent_store_id || null;
      const subagentStoreId = metadata.subagent_store_id || null;

      console.log(`Processing bulk order: ${recipientCount} recipients, ${totalGb}GB total, network: ${network}`);
      console.log(`Agent Store ID: ${agentStoreId}, Subagent Store ID: ${subagentStoreId}`);

      if (!recipientsJson || !network) {
        console.error("Missing recipients or network for bulk order");
        return new Response(JSON.stringify({ error: "Missing bulk order data" }), {
          status: 400,
          headers: corsHeaders
        });
      }

      const { data: existingBulkOrder } = await supabaseClient
        .from("orders")
        .select("id")
        .like("paystack_reference", `${reference}%`)
        .maybeSingle();

      if (existingBulkOrder) {
        console.log(`Bulk order already processed for reference ${reference}`);
        return new Response(JSON.stringify({ message: "Bulk order already processed" }), {
          status: 200,
          headers: corsHeaders
        });
      }

      let recipients: Array<{ phone: string; size_gb: number; package_id: string; price: number }> = [];
      try {
        recipients = JSON.parse(recipientsJson);
      } catch (parseErr) {
        console.error("Failed to parse recipients JSON:", parseErr);
        return new Response(JSON.stringify({ error: "Invalid recipients data" }), {
          status: 400,
          headers: corsHeaders
        });
      }

      console.log(`Parsed ${recipients.length} recipients`);

      const { data: pkgData } = await supabaseClient
        .from("data_packages")
        .select("id, agent_price, price");

      const packagePrices: Record<string, { agent_price: number; price: number }> = {};
      if (pkgData) {
        for (const pkg of pkgData) {
          packagePrices[pkg.id] = { agent_price: Number(pkg.agent_price) || 0, price: Number(pkg.price) || 0 };
        }
      }

      let parentAgentId: string | null = null;
      let subagentPrices: Record<string, number> = {};

      if (subagentStoreId) {
        const { data: subagentStore } = await supabaseClient
          .from("subagent_stores")
          .select("agent_store_id")
          .eq("id", subagentStoreId)
          .single();

        if (subagentStore) {
          parentAgentId = subagentStore.agent_store_id;

          const { data: subagentPriceData } = await supabaseClient
            .from("subagent_package_prices")
            .select("package_id, base_price")
            .eq("agent_store_id", parentAgentId);

          if (subagentPriceData) {
            for (const sp of subagentPriceData) {
              subagentPrices[sp.package_id] = Number(sp.base_price) || 0;
            }
          }
        }
      }

      const createdOrders: string[] = [];
      const failedOrders: string[] = [];
      let totalAgentProfit = 0;
      let totalSubagentProfit = 0;
      let totalAgentCommission = 0;

      for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        const orderReference = `${reference}_${i + 1}`;

        try {
          const pkgInfo = packagePrices[recipient.package_id] || { agent_price: 0, price: recipient.price };
          const adminBasePrice = pkgInfo.agent_price || pkgInfo.price;

          let sellingPrice = recipient.price;
          let basePriceForOrder = adminBasePrice;
          let profitForOrder = 0;

          if (subagentStoreId && parentAgentId) {
            const agentPriceToSubagent = subagentPrices[recipient.package_id] || adminBasePrice;
            basePriceForOrder = agentPriceToSubagent;
            profitForOrder = sellingPrice - agentPriceToSubagent;
            const agentCommission = agentPriceToSubagent - adminBasePrice;

            totalSubagentProfit += profitForOrder;
            totalAgentCommission += agentCommission;

            console.log(`Recipient ${i + 1}: Subagent profit: ${profitForOrder.toFixed(2)}, Agent commission: ${agentCommission.toFixed(2)}`);
          } else if (agentStoreId) {
            basePriceForOrder = adminBasePrice;
            profitForOrder = sellingPrice - adminBasePrice;
            totalAgentProfit += profitForOrder;

            console.log(`Recipient ${i + 1}: Agent profit: ${profitForOrder.toFixed(2)}`);
          } else {
            basePriceForOrder = adminBasePrice;
            profitForOrder = 0;
          }

          const orderData: Record<string, unknown> = {
            customer_number: recipient.phone,
            package_id: recipient.package_id,
            network: network,
            size_gb: recipient.size_gb,
            amount: recipient.price,
            status: "paid",
            fulfillment_status: "pending",
            paystack_reference: orderReference,
            payment_method: "paystack",
            selling_price: sellingPrice,
            base_price: basePriceForOrder,
            profit: profitForOrder,
          };

          if (agentStoreId) {
            orderData.agent_store_id = agentStoreId;
          }
          if (subagentStoreId) {
            orderData.subagent_store_id = subagentStoreId;
          }

          const { data: order, error: orderError } = await supabaseClient
            .from("orders")
            .insert(orderData)
            .select("id")
            .single();

          if (orderError) {
            console.error(`Failed to create order for ${recipient.phone}:`, orderError);
            failedOrders.push(recipient.phone);
            continue;
          }

          createdOrders.push(order.id);
          console.log(`Created order ${order.id} for ${recipient.phone} - ${recipient.size_gb}GB`);

          try {
            const fulfillUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/fulfill-order`;
            await fetch(fulfillUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              },
              body: JSON.stringify({ order_id: order.id }),
            });
          } catch (fulfillErr) {
            console.error(`Failed to trigger fulfillment for order ${order.id}:`, fulfillErr);
          }

        } catch (err) {
          console.error(`Error processing recipient ${recipient.phone}:`, err);
          failedOrders.push(recipient.phone);
        }
      }

      if (subagentStoreId && totalSubagentProfit > 0) {
        const { data: subagentStore } = await supabaseClient
          .from("subagent_stores")
          .select("wallet_balance")
          .eq("id", subagentStoreId)
          .single();

        if (subagentStore) {
          const newBalance = (Number(subagentStore.wallet_balance) || 0) + totalSubagentProfit;
          await supabaseClient
            .from("subagent_stores")
            .update({ wallet_balance: newBalance })
            .eq("id", subagentStoreId);

          console.log(`Subagent wallet credited: GHS ${totalSubagentProfit.toFixed(2)}, new balance: GHS ${newBalance.toFixed(2)}`);
        }
      }

      if (parentAgentId && totalAgentCommission > 0) {
        const { data: agentStore } = await supabaseClient
          .from("agent_stores")
          .select("subagent_commission_balance")
          .eq("id", parentAgentId)
          .single();

        if (agentStore) {
          const newCommissionBalance = (Number(agentStore.subagent_commission_balance) || 0) + totalAgentCommission;
          await supabaseClient
            .from("agent_stores")
            .update({ subagent_commission_balance: newCommissionBalance })
            .eq("id", parentAgentId);

          console.log(`Agent commission credited: GHS ${totalAgentCommission.toFixed(2)}, new balance: GHS ${newCommissionBalance.toFixed(2)}`);
        }
      }

      if (agentStoreId && !subagentStoreId && totalAgentProfit > 0) {
        const { data: agentStore } = await supabaseClient
          .from("agent_stores")
          .select("wallet_balance")
          .eq("id", agentStoreId)
          .single();

        if (agentStore) {
          const newBalance = (Number(agentStore.wallet_balance) || 0) + totalAgentProfit;
          await supabaseClient
            .from("agent_stores")
            .update({ wallet_balance: newBalance })
            .eq("id", agentStoreId);

          console.log(`Agent wallet credited: GHS ${totalAgentProfit.toFixed(2)}, new balance: GHS ${newBalance.toFixed(2)}`);
        }
      }

      console.log(`Bulk order complete: ${createdOrders.length} created, ${failedOrders.length} failed`);

      return new Response(JSON.stringify({
        message: "Bulk order processed",
        created_orders: createdOrders.length,
        failed_orders: failedOrders.length,
        order_ids: createdOrders,
        agent_profit: totalAgentProfit,
        subagent_profit: totalSubagentProfit,
        agent_commission: totalAgentCommission
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // =====================================
    // DATA PACKAGE PURCHASE HANDLER
    // =====================================
    const phone = metadata?.phone ?? "";
    const package_id = metadata?.package_id ?? "";
    const network = metadata?.network ?? "";
    const package_name = metadata?.package_name ?? "";
    const agent_store_id = metadata?.agent_store_id ?? null;
    const subagent_store_id = metadata?.subagent_store_id ?? null;
    const data_package_id = metadata?.data_package_id ?? "not included"

    const sizeMatch = package_name.match(/(\d+(?:\.\d+)?)/);
    const sizeGb = sizeMatch ? parseFloat(sizeMatch[1]) : 0;

    const amountPaid = Number(amount) / 100;
    const paymentFee = amountPaid * (PAYSTACK_FEE_PERCENT / 100);
    const roundedBaseAmount = Math.round((amountPaid - paymentFee) * 100) / 100;

    console.log(`Base amount (after fee): GHS ${roundedBaseAmount}`);
    console.log(`Package ID: ${package_id}, Size: ${sizeGb}GB, Network: ${network}, data_package_id: ${data_package_id}`);

    const { data: existingOrder } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("paystack_reference", reference)
      .maybeSingle();

    if (existingOrder) {
      console.log(`Order already exists for reference ${reference}`);
      return new Response(JSON.stringify({ 
        message: "Order already processed",
        order_id: existingOrder.id
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    let sellingPrice = roundedBaseAmount;
    let basePriceForOrder = 0;
    let profitForOrder = 0;

    const { data: pkgData } = await supabaseClient
      .from("data_packages")
      .select("agent_price")
      .eq("id", package_id)
      .single();

    const adminBasePrice = pkgData?.agent_price ? Number(pkgData.agent_price) : 0;
    console.log(`Admin base price (agent_price from data_packages): GHS ${adminBasePrice}`);

    if (subagent_store_id) {
      const { data: subagentStore, error: subagentError } = await supabaseClient
        .from("subagent_stores")
        .select("agent_store_id, wallet_balance")
        .eq("id", subagent_store_id)
        .single();

      if (subagentError) {
        console.error("Failed to fetch subagent store:", subagentError);
      }

      const parentAgentId = subagentStore?.agent_store_id;
      console.log(`Parent agent ID: ${parentAgentId}`);

      let agentPriceToSubagent = adminBasePrice;
      
      if (parentAgentId && package_id) {
        const { data: subagentPriceData, error: priceError } = await supabaseClient
          .from("subagent_package_prices")
          .select("base_price")
          .eq("agent_store_id", parentAgentId)
          .eq("package_id", package_id)
          .maybeSingle();

        if (priceError) {
          console.error("Failed to fetch subagent package price:", priceError);
        }

        if (subagentPriceData?.base_price) {
          agentPriceToSubagent = Number(subagentPriceData.base_price);
          console.log(`Found subagent_package_prices.base_price: GHS ${agentPriceToSubagent}`);
        } else {
          console.log(`No subagent_package_prices found, using admin base price: GHS ${adminBasePrice}`);
        }
      }

      sellingPrice = roundedBaseAmount;
      basePriceForOrder = agentPriceToSubagent;
      profitForOrder = sellingPrice - basePriceForOrder;
      
      const agentProfitFromSubagent = agentPriceToSubagent - adminBasePrice;

      console.log(`SUBAGENT ORDER PRICING:`);
      console.log(`  Customer paid (selling_price): GHS ${sellingPrice.toFixed(2)}`);
      console.log(`  Agent's price to subagent (base_price): GHS ${basePriceForOrder.toFixed(2)}`);
      console.log(`  Admin's price to agent: GHS ${adminBasePrice.toFixed(2)}`);
      console.log(`  Subagent profit: GHS ${profitForOrder.toFixed(2)}`);
      console.log(`  Agent profit from subagent: GHS ${agentProfitFromSubagent.toFixed(2)}`);

      if (profitForOrder > 0 && subagentStore) {
        const currentSubagentBalance = Number(subagentStore.wallet_balance) || 0;
        const newSubagentBalance = currentSubagentBalance + profitForOrder;

        const { error: subagentUpdateError } = await supabaseClient
          .from("subagent_stores")
          .update({ wallet_balance: newSubagentBalance })
          .eq("id", subagent_store_id);

        if (subagentUpdateError) {
          console.error("Failed to update subagent wallet:", subagentUpdateError);
        } else {
          console.log(`Subagent wallet credited: GHS ${profitForOrder.toFixed(2)}, new balance: GHS ${newSubagentBalance.toFixed(2)}`);
        }
      }

      if (parentAgentId && agentProfitFromSubagent > 0) {
        const { data: agentStore } = await supabaseClient
          .from("agent_stores")
          .select("subagent_commission_balance")
          .eq("id", parentAgentId)
          .single();

        if (agentStore) {
          const newCommissionBalance = (Number(agentStore.subagent_commission_balance) || 0) + agentProfitFromSubagent;

          const { error: agentUpdateError } = await supabaseClient
            .from("agent_stores")
            .update({ subagent_commission_balance: newCommissionBalance })
            .eq("id", parentAgentId);

          if (agentUpdateError) {
            console.error("Failed to update agent commission:", agentUpdateError);
          } else {
            console.log(`Agent commission credited: GHS ${agentProfitFromSubagent.toFixed(2)}, new balance: GHS ${newCommissionBalance.toFixed(2)}`);
          }
        }
      }

    } else if (agent_store_id) {
      sellingPrice = roundedBaseAmount;
      basePriceForOrder = adminBasePrice;
      profitForOrder = sellingPrice - basePriceForOrder;

      console.log(`AGENT ORDER PRICING:`);
      console.log(`  Customer paid (selling_price): GHS ${sellingPrice.toFixed(2)}`);
      console.log(`  Admin base price (base_price): GHS ${basePriceForOrder.toFixed(2)}`);
      console.log(`  Agent profit: GHS ${profitForOrder.toFixed(2)}`);

      if (profitForOrder > 0) {
        const { data: agent } = await supabaseClient
          .from("agent_stores")
          .select("wallet_balance")
          .eq("id", agent_store_id)
          .single();

        if (agent) {
          const newBalance = (Number(agent.wallet_balance) || 0) + profitForOrder;

          const { error: updateError } = await supabaseClient
            .from("agent_stores")
            .update({ wallet_balance: newBalance })
            .eq("id", agent_store_id);

          if (updateError) {
            console.error("Failed to update agent wallet:", updateError);
          } else {
            console.log(`Agent wallet credited: GHS ${profitForOrder.toFixed(2)}, new balance: GHS ${newBalance.toFixed(2)}`);
          }
        }
      }

    } else {
      sellingPrice = roundedBaseAmount;
      basePriceForOrder = adminBasePrice;
      profitForOrder = 0;

      console.log(`DIRECT USER ORDER (no agent):`);
      console.log(`  Customer paid (selling_price): GHS ${sellingPrice.toFixed(2)}`);
      console.log(`  Admin base price: GHS ${basePriceForOrder.toFixed(2)}`);
    }

    const orderData: Record<string, unknown> = {
      customer_number: phone,
      package_id: package_id,
      network: network,
      size_gb: sizeGb,
      amount: roundedBaseAmount,
      status: "paid",
      fulfillment_status: "pending",
      paystack_reference: reference,
      payment_method: "paystack",
      selling_price: sellingPrice,
      base_price: basePriceForOrder,
      profit: profitForOrder,
    };

    if (agent_store_id) {
      orderData.agent_store_id = agent_store_id;
    }
    if (subagent_store_id) {
      orderData.subagent_store_id = subagent_store_id;
    }

    const { data: order, error: orderInsertError } = await supabaseClient
      .from("orders")
      .insert(orderData)
      .select("id")
      .single();

    if (orderInsertError) {
      console.error("Failed to insert order:", orderInsertError);
      return new Response(JSON.stringify({ error: "Failed to create order" }), {
        status: 500,
        headers: corsHeaders
      });
    }

    console.log(`Order created: ${order.id} for ${phone}`);

    try {
      const fulfillUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/fulfill-order`;
      await fetch(fulfillUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({ order_id: order.id }),
      });
    } catch (fulfillErr) {
      console.error("Failed to trigger fulfillment:", fulfillErr);
    }

    return new Response(JSON.stringify({
      message: "Payment processed successfully",
      order_id: order.id,
      order_status: "paid"
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
