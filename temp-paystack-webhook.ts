// supabase/functions/paystack-webhook/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-paystack-signature",
};

const PAYSTACK_FEE_PERCENT = 1.98;

// Simple HMAC-SHA512 verification - matches Python's hmac.new()
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

    // Constant time comparison
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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get signature from header
    const signature = req.headers.get("x-paystack-signature");

    if (!signature) {
      console.error("Missing x-paystack-signature header");
      return new Response(JSON.stringify({ error: "No signature provided" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Get raw body as string (don't parse yet - verification needs raw bytes)
    const rawBody = await req.text();

    // Get secret key
    const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secret) {
      console.error("PAYSTACK_SECRET_KEY environment variable not set");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verify signature
    const isValid = await verifySignature(secret, signature, rawBody);

    if (!isValid) {
      console.error("Invalid signature - webhook rejected");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log("✅ Signature verified successfully");

    // Parse the verified payload
    const payload = JSON.parse(rawBody);
    console.log(`📦 Event type: ${payload.event}`);

    // Only process charge.success events
    if (payload.event !== "charge.success") {
      console.log(`⚠️ Ignoring event: ${payload.event}`);
      return new Response(JSON.stringify({ message: "Event ignored" }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // Extract data from payload
    const { reference, metadata, amount } = payload.data;
    const paymentType = metadata?.type;

    console.log(`💰 Processing payment: ${reference}`);
    console.log(`💵 Amount paid (including fee): GHS ${Number(amount) / 100}`);
    console.log(`📋 Payment type: ${paymentType || "package_purchase"}`);

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // =====================================
    // AGENT REGISTRATION PAYMENT HANDLER
    // =====================================
    if (paymentType === "agent_registration") {
      const agentStoreId = metadata.agent_store_id;
      
      if (!agentStoreId) {
        console.error("❌ Missing agent_store_id for registration payment");
        return new Response(JSON.stringify({ error: "Missing agent store ID" }), {
          status: 400,
          headers: corsHeaders
        });
      }

      // Check if already processed
      const { data: existingPayment } = await supabaseClient
        .from("agent_registration_payments")
        .select("id")
        .eq("paystack_reference", reference)
        .maybeSingle();

      if (existingPayment) {
        console.log(`⚠️ Registration payment already processed for reference ${reference}`);
        return new Response(JSON.stringify({ message: "Payment already processed" }), {
          status: 200,
          headers: corsHeaders
        });
      }

      // Approve the agent store
      const { error: approveError } = await supabaseClient
        .from("agent_stores")
        .update({ approved: true })
        .eq("id", agentStoreId);

      if (approveError) {
        console.error("❌ Failed to approve agent store:", approveError);
        return new Response(JSON.stringify({ error: "Failed to approve store" }), {
          status: 500,
          headers: corsHeaders
        });
      }

      // Record the payment
      await supabaseClient.from("agent_registration_payments").insert({
        agent_store_id: agentStoreId,
        amount: metadata.base_amount || (Number(amount) / 100),
        paystack_reference: reference,
      });

      console.log(`✅ Agent store ${agentStoreId} approved via Paystack payment`);

      return new Response(JSON.stringify({
        message: "Agent store approved successfully",
        agent_store_id: agentStoreId
      }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // =====================================
    // DATA PURCHASE / PACKAGE PAYMENT HANDLER
    // =====================================
    const { package_id, agent_store_id, subagent_store_id, phone, network, package_name } = metadata || {};

    if (!package_id) {
      console.log(`⚠️ No package_id in metadata - ignoring`);
      return new Response(JSON.stringify({ message: "No package_id - event ignored" }), {
        status: 200,
        headers: corsHeaders
      });
    }

    console.log(`📱 Phone: ${phone}, Network: ${network}, Package: ${package_name}`);
    console.log(`🏪 Agent Store ID: ${agent_store_id || "none"}, Subagent Store ID: ${subagent_store_id || "none"}`);

    // Check for duplicate webhook (idempotency)
    const { data: existingOrder } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("paystack_reference", reference)
      .maybeSingle();

    if (existingOrder) {
      console.log(`⚠️ Order already exists for reference ${reference} - skipping`);
      return new Response(JSON.stringify({ message: "Order already processed" }), {
        status: 200,
        headers: corsHeaders
      });
    }

    // Calculate base amount by removing Paystack fee (1.98%)
    const amountPaid = Number(amount) / 100;
    // Use base_amount from metadata if available (more accurate)
    const baseAmount = metadata.base_amount || (amountPaid / (1 + (PAYSTACK_FEE_PERCENT / 100)));
    const roundedBaseAmount = Math.round(baseAmount * 100) / 100;
    const feePaid = amountPaid - roundedBaseAmount;

    console.log(`💰 Base amount (without fee): GHS ${roundedBaseAmount.toFixed(2)}`);
    console.log(`💰 Paystack fee paid by customer: GHS ${feePaid.toFixed(2)}`);

    // Extract size from package name (e.g., "5GB" -> 5)
    const sizeMatch = package_name?.match(/(\d+(?:\.\d+)?)/);
    const sizeGb = sizeMatch ? parseFloat(sizeMatch[1]) : 0;

    // Create the order - include subagent_store_id
    const { data: orderData, error: orderError } = await supabaseClient
      .from("orders")
      .insert({
        customer_number: phone,
        network: network,
        size_gb: sizeGb,
        amount: roundedBaseAmount,
        package_id: package_id,
        agent_store_id: agent_store_id || null,
        subagent_store_id: subagent_store_id || null,
        status: "paid",
        fulfillment_status: "pending",
        payment_method: "paystack",
        paystack_reference: reference,
      })
      .select("id")
      .single();

    if (orderError) {
      console.error("❌ Failed to create order:", orderError);
      return new Response(JSON.stringify({ error: "Failed to create order" }), {
        status: 500,
        headers: corsHeaders
      });
    }

    console.log(`✅ Order created successfully: ${orderData.id}`);

    // ==============================================
    // PROFIT CALCULATION FOR SUBAGENT ORDERS
    // ==============================================
    if (subagent_store_id) {
      try {
        console.log(`🔄 Processing subagent profit for subagent_store_id: ${subagent_store_id}`);

        // Get the subagent store to find the parent agent
        const { data: subagentStore, error: subagentError } = await supabaseClient
          .from("subagent_stores")
          .select("id, agent_store_id, wallet_balance")
          .eq("id", subagent_store_id)
          .single();

        if (subagentError || !subagentStore) {
          console.error(`❌ Failed to fetch subagent store:`, subagentError);
        } else {
          const parentAgentId = subagentStore.agent_store_id;
          console.log(`👤 Parent agent ID: ${parentAgentId}`);

          // Get the package's agent_price (cost to agent/subagent)
          const { data: pkg, error: pkgError } = await supabaseClient
            .from("data_packages")
            .select("agent_price")
            .eq("id", package_id)
            .single();

          if (pkgError || !pkg) {
            console.error(`❌ Failed to fetch package:`, pkgError);
          } else {
            const agentCost = pkg.agent_price;
            const customerAmount = roundedBaseAmount;
            const totalProfit = customerAmount - agentCost;

            console.log(`💰 Agent cost: GHS ${agentCost.toFixed(2)}`);
            console.log(`💰 Customer payment (after fee): GHS ${customerAmount.toFixed(2)}`);
            console.log(`💰 Total profit: GHS ${totalProfit.toFixed(2)}`);

            if (totalProfit > 0) {
              // Get agent's commission rate for subagents (default 10%)
              const { data: agentStore } = await supabaseClient
                .from("agent_stores")
                .select("wallet_balance, subagent_commission_rate")
                .eq("id", parentAgentId)
                .single();

              const commissionRate = agentStore?.subagent_commission_rate || 10;
              const agentCommission = (totalProfit * commissionRate) / 100;
              const subagentProfit = totalProfit - agentCommission;

              console.log(`📊 Commission rate: ${commissionRate}%`);
              console.log(`💵 Agent commission: GHS ${agentCommission.toFixed(2)}`);
              console.log(`💵 Subagent profit: GHS ${subagentProfit.toFixed(2)}`);

              // Update subagent wallet
              const newSubagentBalance = (subagentStore.wallet_balance || 0) + subagentProfit;
              const { error: subagentUpdateError } = await supabaseClient
                .from("subagent_stores")
                .update({ wallet_balance: newSubagentBalance })
                .eq("id", subagent_store_id);

              if (subagentUpdateError) {
                console.error(`❌ Failed to update subagent wallet:`, subagentUpdateError);
              } else {
                console.log(`✅ Subagent wallet updated: GHS ${newSubagentBalance.toFixed(2)}`);
              }

              // Update agent wallet with commission
              if (agentStore && agentCommission > 0) {
                const newAgentBalance = (agentStore.wallet_balance || 0) + agentCommission;
                const { error: agentUpdateError } = await supabaseClient
                  .from("agent_stores")
                  .update({ wallet_balance: newAgentBalance })
                  .eq("id", parentAgentId);

                if (agentUpdateError) {
                  console.error(`❌ Failed to update agent wallet:`, agentUpdateError);
                } else {
                  console.log(`✅ Agent commission added: GHS ${agentCommission.toFixed(2)}`);
                  console.log(`✅ Agent wallet updated: GHS ${newAgentBalance.toFixed(2)}`);
                }
              }
            }
          }
        }
      } catch (profitError) {
        console.error("❌ Error processing subagent profit:", profitError);
      }
    }
    // ==============================================
    // PROFIT CALCULATION FOR AGENT ORDERS (no subagent)
    // ==============================================
    else if (agent_store_id) {
      try {
        // Get the package to find agent_price
        const { data: pkg, error: pkgError } = await supabaseClient
          .from("data_packages")
          .select("agent_price")
          .eq("id", package_id)
          .single();

        if (pkgError) {
          console.error(`❌ Failed to fetch package ${package_id}:`, pkgError);
        } else if (pkg) {
          const agentCost = pkg.agent_price;
          const customerAmount = roundedBaseAmount;
          const profit = customerAmount - agentCost;

          console.log(`💰 Agent cost: GHS ${agentCost.toFixed(2)}`);
          console.log(`💰 Customer payment (after fee): GHS ${customerAmount.toFixed(2)}`);
          console.log(`💰 Calculated profit: GHS ${profit.toFixed(2)}`);

          if (profit > 0) {
            const { data: agent, error: agentError } = await supabaseClient
              .from("agent_stores")
              .select("wallet_balance")
              .eq("id", agent_store_id)
              .single();

            if (agentError) {
              console.error(`❌ Failed to fetch agent ${agent_store_id}:`, agentError);
            } else {
              const newBalance = (agent?.wallet_balance || 0) + profit;

              const { error: updateError } = await supabaseClient
                .from("agent_stores")
                .update({ wallet_balance: newBalance })
                .eq("id", agent_store_id);

              if (updateError) {
                console.error(`❌ Failed to update wallet for agent ${agent_store_id}:`, updateError);
              } else {
                console.log(`✅ Added GHS ${profit.toFixed(2)} profit to agent ${agent_store_id}`);
                console.log(`✅ New wallet balance: GHS ${newBalance.toFixed(2)}`);
              }
            }
          }
        }
      } catch (profitError) {
        console.error("❌ Error adding profit to wallet:", profitError);
      }
    } else {
      console.log("ℹ️ No agent_store_id or subagent_store_id - skipping wallet update");
    }

    // Trigger fulfillment asynchronously
    supabaseClient.functions.invoke("fulfill-order", {
      body: { order_id: orderData.id },
    }).catch(err => {
      console.error(`❌ Fulfillment error for order ${orderData.id}:`, err);
    });

    console.log(`🚀 Fulfillment triggered for order ${orderData.id}`);

    return new Response(JSON.stringify({
      message: "Webhook processed successfully",
      order_id: orderData.id
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (err) {
    console.error("❌ Webhook processing error:", err);
    return new Response(JSON.stringify({
      error: "Internal server error",
      details: (err as Error).message
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});