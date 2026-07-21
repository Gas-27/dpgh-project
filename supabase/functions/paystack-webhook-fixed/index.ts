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
    const customerId = metadata?.customer_id;

    console.log(`Processing payment: ${reference}`);
    console.log(`Amount paid (including fee): GHS ${Number(amount) / 100}`);
    console.log(`Payment type: ${paymentType || "package_purchase"}`);
    console.log(`Customer ID: ${customerId || "not provided"}`);

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

      const { data: agentStore } = await supabaseClient
        .from("agent_stores")
        .select("wallet_balance")
        .eq("id", agentStoreId)
        .single();

      if (agentStore) {
        const newWalletBalance = (Number(agentStore.wallet_balance) || 0) + baseAmount;
        await supabaseClient
          .from("agent_stores")
          .update({ wallet_balance: newWalletBalance })
          .eq("id", agentStoreId);

        console.log(`Agent wallet credited: +GHS ${baseAmount.toFixed(2)}, new balance: GHS ${newWalletBalance.toFixed(2)}`);
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
    // DATA PACKAGE PURCHASE HANDLER (ONLY HANDLER)
    // =====================================
    
    // Extract order data
    const phone = metadata?.phone ?? "";
    const packageId = metadata?.package_id ?? "";
    const network = metadata?.network ?? "";
    const packageName = metadata?.package_name ?? "";
    const agentStoreId = metadata?.agent_store_id ?? null;
    const subagentStoreId = metadata?.subagent_store_id ?? null;

    // Extract size from package name
    const sizeMatch = packageName.match(/(\d+(?:\.\d+)?)/);
    const sizeGb = sizeMatch ? parseFloat(sizeMatch[1]) : 0;

    const amountPaid = Number(amount) / 100;

    console.log(`Data package order: phone=${phone}, package=${packageId}, network=${network}, size=${sizeGb}GB`);

    // Check if order already exists
    const { data: existingOrder } = await supabaseClient
      .from("orders")
      .select("id")
      .eq("paystack_reference", reference)
      .maybeSingle();

    if (existingOrder) {
      console.log(`Order already exists for reference ${reference}`);
      return new Response(JSON.stringify({
        success: true,
        message: "Order already verified",
        order_id: existingOrder.id,
      }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Get admin base price for this package.
    // We also fetch `price` (the public-facing price before Paystack fee) so we
    // can detect whether a custom agent/subagent price was actually set.
    const { data: packageData } = await supabaseClient
      .from("data_packages")
      .select("agent_price, price")
      .eq("id", packageId)
      .maybeSingle();

    // adminBasePrice = what the admin charges agents (the wholesale cost, fee-exclusive).
    // packagePrice   = the public-facing price set by the admin (fee-exclusive).
    //                  This is what we show as "Sell Price" — not amountPaid which
    //                  includes the Paystack 1.98% fee and is higher than the listed price.
    // amountPaid     = what Paystack actually collected (fee-inclusive). Used only for
    //                  wallet/balance operations, never displayed as a sell price.
    const adminBasePrice = packageData?.agent_price ? Number(packageData.agent_price) : amountPaid;
    const packagePrice   = packageData?.price        ? Number(packageData.price)        : adminBasePrice;

    let sellingPrice = packagePrice;  // show the clean listed price, not the fee-inflated total
    let basePriceForOrder = packagePrice; // default: no profit until custom price confirmed
    let profitForOrder = 0;

    if (subagentStoreId) {
      // SUBAGENT ORDER
      const { data: subagentStore } = await supabaseClient
        .from("subagent_stores")
        .select("agent_store_id, wallet_balance")
        .eq("id", subagentStoreId)
        .single();

      const parentAgentId = subagentStore?.agent_store_id;

      let agentPriceToSubagent = adminBasePrice;
      
      if (parentAgentId && packageId) {
        const { data: subagentPriceData } = await supabaseClient
          .from("subagent_package_prices")
          .select("base_price")
          .eq("agent_store_id", parentAgentId)
          .eq("package_id", packageId)
          .maybeSingle();

        if (subagentPriceData?.base_price) {
          agentPriceToSubagent = Number(subagentPriceData.base_price);
        }
      }

      // Use the clean package price (fee-exclusive) as sell price, not amountPaid
      sellingPrice = packagePrice;
      basePriceForOrder = agentPriceToSubagent;
      profitForOrder = sellingPrice - basePriceForOrder;

      console.log(`Subagent order: selling=${sellingPrice.toFixed(2)}, base=${basePriceForOrder.toFixed(2)}, profit=${profitForOrder.toFixed(2)}`);

      // Create order
      const { data: order, error: orderError } = await supabaseClient
        .from("orders")
        .insert({
          customer_id: customerId,
          customer_number: phone,
          package_id: packageId,
          network,
          size_gb: sizeGb,
          amount: amountPaid,
          status: "paid",
          fulfillment_status: "pending",
          paystack_reference: reference,
          selling_price: sellingPrice,
          base_price: basePriceForOrder,
          profit: profitForOrder,
          profit_credited: false,
          agent_store_id: parentAgentId,
          subagent_store_id: subagentStoreId,
        })
        .select("id")
        .single();

      if (orderError) {
        console.error("Failed to create order:", orderError);
        return new Response(JSON.stringify({ error: "Failed to create order" }), {
          status: 500,
          headers: corsHeaders
        });
      }

      console.log(`Order created: ${order.id}`);

      // CREDIT SUBAGENT WALLET - ONLY ONCE
      if (profitForOrder > 0 && subagentStore) {
        const newBalance = (Number(subagentStore.wallet_balance) || 0) + profitForOrder;
        await supabaseClient
          .from("subagent_stores")
          .update({ wallet_balance: newBalance })
          .eq("id", subagentStoreId);

        console.log(`Subagent wallet credited: +GHS ${profitForOrder.toFixed(2)}, new balance: GHS ${newBalance.toFixed(2)}`);

        // CREDIT AGENT COMMISSION - ONLY ONCE
        if (parentAgentId) {
          const agentCommission = agentPriceToSubagent - adminBasePrice;
          if (agentCommission > 0) {
            const { data: agentStore } = await supabaseClient
              .from("agent_stores")
              .select("subagent_commission_balance")
              .eq("id", parentAgentId)
              .single();

            if (agentStore) {
              const newCommissionBalance = (Number(agentStore.subagent_commission_balance) || 0) + agentCommission;
              await supabaseClient
                .from("agent_stores")
                .update({ subagent_commission_balance: newCommissionBalance })
                .eq("id", parentAgentId);

              console.log(`Agent commission credited: +GHS ${agentCommission.toFixed(2)}, new balance: GHS ${newCommissionBalance.toFixed(2)}`);
            }
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
        console.error("Failed to trigger fulfillment:", err);
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Subagent order processed",
        order_id: order.id,
      }), {
        status: 200,
        headers: corsHeaders,
      });

    } else if (agentStoreId) {
      // AGENT DIRECT ORDER
      // Check if the agent has set a custom sell_price for this package.
      // If they have, profit = amountPaid - adminBasePrice (agent markup).
      // If they have NOT, profit = 0 (selling at cost — base = amountPaid).
      const { data: agentCustomPrice } = await supabaseClient
        .from("agent_package_prices")
        .select("sell_price")
        .eq("agent_store_id", agentStoreId)
        .eq("package_id", packageId)
        .maybeSingle();

      if (agentCustomPrice?.sell_price != null) {
        // Agent has set a custom sell price — show that price, profit vs admin base
        sellingPrice = Number(agentCustomPrice.sell_price);
        basePriceForOrder = adminBasePrice;
      } else {
        // No custom price set — sell at the admin-listed package price, profit = 0
        sellingPrice = packagePrice;
        basePriceForOrder = packagePrice;
      }
      profitForOrder = sellingPrice - basePriceForOrder;

      console.log(`Agent order: selling=${sellingPrice.toFixed(2)}, base=${basePriceForOrder.toFixed(2)}, profit=${profitForOrder.toFixed(2)}`);

      // Create order
      const { data: order, error: orderError } = await supabaseClient
        .from("orders")
        .insert({
          customer_id: customerId,
          customer_number: phone,
          package_id: packageId,
          network,
          size_gb: sizeGb,
          amount: amountPaid,
          status: "paid",
          fulfillment_status: "pending",
          paystack_reference: reference,
          selling_price: sellingPrice,
          base_price: basePriceForOrder,
          profit: profitForOrder,
          profit_credited: false,
          agent_store_id: agentStoreId,
          subagent_store_id: null,
        })
        .select("id")
        .single();

      if (orderError) {
        console.error("Failed to create order:", orderError);
        return new Response(JSON.stringify({ error: "Failed to create order" }), {
          status: 500,
          headers: corsHeaders
        });
      }

      console.log(`Order created: ${order.id}`);

      // CREDIT AGENT WALLET - ONLY ONCE
      if (profitForOrder > 0) {
        const { data: agent } = await supabaseClient
          .from("agent_stores")
          .select("wallet_balance")
          .eq("id", agentStoreId)
          .single();

        if (agent) {
          const newBalance = (Number(agent.wallet_balance) || 0) + profitForOrder;
          await supabaseClient
            .from("agent_stores")
            .update({ wallet_balance: newBalance })
            .eq("id", agentStoreId);

          console.log(`Agent wallet credited: +GHS ${profitForOrder.toFixed(2)}, new balance: GHS ${newBalance.toFixed(2)}`);
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
        console.error("Failed to trigger fulfillment:", err);
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Agent order processed",
        order_id: order.id,
      }), {
        status: 200,
        headers: corsHeaders,
      });

    } else {
      // DIRECT USER ORDER (no agent)
      sellingPrice = amountPaid;
      basePriceForOrder = adminBasePrice;
      profitForOrder = 0;

      console.log(`Direct order: selling=${sellingPrice.toFixed(2)}, base=${basePriceForOrder.toFixed(2)}`);

      // Create order
      const { data: order, error: orderError } = await supabaseClient
        .from("orders")
        .insert({
          customer_id: customerId,
          customer_number: phone,
          package_id: packageId,
          network,
          size_gb: sizeGb,
          amount: amountPaid,
          status: "paid",
          fulfillment_status: "pending",
          paystack_reference: reference,
          selling_price: sellingPrice,
          base_price: basePriceForOrder,
          profit: 0,
          profit_credited: true,
          agent_store_id: null,
          subagent_store_id: null,
        })
        .select("id")
        .single();

      if (orderError) {
        console.error("Failed to create order:", orderError);
        return new Response(JSON.stringify({ error: "Failed to create order" }), {
          status: 500,
          headers: corsHeaders
        });
      }

      console.log(`Order created: ${order.id}`);

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
        console.error("Failed to trigger fulfillment:", err);
      }

      return new Response(JSON.stringify({
        success: true,
        message: "Direct order processed",
        order_id: order.id,
      }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // =====================================
    // NORMAL WALLET TOPUP HANDLER
    // =====================================
    if (paymentType === "user_wallet_topup") {
      const baseAmount = Number(metadata.base_amount) || (Number(amount) / 100);

      console.log(`[USER WALLET TOPUP] Customer: ${customerId}, Amount: GHS ${baseAmount}`);

      if (!customerId) {
        console.error("[USER WALLET TOPUP] Missing customer_id");
        return new Response(JSON.stringify({ error: "Missing customer_id" }), {
          status: 400,
          headers: corsHeaders
        });
      }

      const { data: customer, error: customerError } = await supabaseClient
        .from("customers")
        .select("id, wallet_balance, email")
        .eq("id", customerId)
        .single();

      if (customerError || !customer) {
        console.error(`[USER WALLET TOPUP] Customer not found: ${customerId}`);
        return new Response(JSON.stringify({ error: "Customer not found" }), {
          status: 404,
          headers: corsHeaders
        });
      }

      const currentBalance = Number(customer.wallet_balance) || 0;
      const newBalance = currentBalance + baseAmount;

      console.log(`[USER WALLET TOPUP] Updating wallet: ${currentBalance} → ${newBalance}`);

      const { error: updateError } = await supabaseClient
        .from("customers")
        .update({
          wallet_balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerId);

      if (updateError) {
        console.error(`[USER WALLET TOPUP] Failed to update wallet:`, updateError);
        return new Response(JSON.stringify({ error: "Failed to update wallet" }), {
          status: 500,
          headers: corsHeaders
        });
      }

      console.log(`[USER WALLET TOPUP] ✅ Wallet topped up: GHS ${baseAmount}`);

      return new Response(
        JSON.stringify({
          message: "Wallet topup processed successfully",
          customer_id: customerId,
          email: customer.email,
          amount_credited: baseAmount,
          previous_balance: currentBalance,
          new_balance: newBalance,
          transaction_reference: reference,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
