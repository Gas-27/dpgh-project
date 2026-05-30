// supabase/functions/verify-payment/index.ts

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

    // ==========================
    // SPIN WHEEL PAYMENT HANDLER
    // ==========================
    if (paymentType === "spin_wheel") {
      const { data: existing } = await supabase
        .from("spin_wheel_payments")
        .select("id")
        .eq("reference", reference)
        .maybeSingle();

      if (existing) {
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
        console.error("Failed to record spin payment:", insertErr);
        return new Response(JSON.stringify({ error: "Internal error recording payment" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        grant_spins: true,
        spins: 2,
        message: "Payment confirmed! You have 2 spins now.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================
    // AGENT REGISTRATION PAYMENT HANDLER
    // =====================================
    if (paymentType === "agent_registration") {
      const agentStoreId = metadata.agent_store_id;
      
      if (!agentStoreId) {
        return new Response(JSON.stringify({ error: "Missing agent store ID" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already approved
      const { data: storeData } = await supabase
        .from("agent_stores")
        .select("approved")
        .eq("id", agentStoreId)
        .single();

      if (storeData?.approved) {
        return new Response(JSON.stringify({
          success: true,
          approved: true,
          message: "Store already approved",
          already_processed: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Approve the agent store
      const { error: approveError } = await supabase
        .from("agent_stores")
        .update({ approved: true })
        .eq("id", agentStoreId);

      if (approveError) {
        console.error("Failed to approve store:", approveError);
        return new Response(JSON.stringify({ error: "Failed to approve store" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        approved: true,
        message: "Payment confirmed! Your store has been approved.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================
    // WALLET TOP UP PAYMENT HANDLER (Agent)
    // =====================================
    if (paymentType === "wallet_topup") {
      const agentStoreId = metadata.agent_store_id;
      const baseAmount = Number(metadata.base_amount) || (txData.amount / 100);
      
      if (!agentStoreId) {
        return new Response(JSON.stringify({ error: "Missing agent store ID" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Check if this reference was already used
      const { data: existingTopup } = await supabase
        .from("wallet_topups")
        .select("id")
        .eq("paystack_reference", reference)
        .maybeSingle();
      
      if (existingTopup) {
        return new Response(JSON.stringify({
          success: true,
          message: "Topup already processed",
          already_processed: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Get current wallet balance
      const { data: store, error: storeError } = await supabase
        .from("agent_stores")
        .select("wallet_balance")
        .eq("id", agentStoreId)
        .single();
      
      if (storeError || !store) {
        return new Response(JSON.stringify({ error: "Agent store not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const newBalance = (Number(store.wallet_balance) || 0) + baseAmount;
      
      // Update wallet balance
      const { error: updateError } = await supabase
        .from("agent_stores")
        .update({ wallet_balance: newBalance })
        .eq("id", agentStoreId);
      
      if (updateError) {
        console.error("Failed to update wallet:", updateError);
        return new Response(JSON.stringify({ error: "Failed to update wallet" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Record the topup
      await supabase.from("wallet_topups").insert({
        agent_store_id: agentStoreId,
        amount: baseAmount,
        paystack_reference: reference,
      });
      
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
      const subagentStoreId = metadata.subagent_store_id;
      const baseAmount = Number(metadata.base_amount) || (txData.amount / 100);
      
      if (!subagentStoreId) {
        return new Response(JSON.stringify({ error: "Missing subagent store ID" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Check if this reference was already used
      const { data: existingTopup } = await supabase
        .from("subagent_wallet_topups")
        .select("id")
        .eq("paystack_reference", reference)
        .maybeSingle();
      
      if (existingTopup) {
        return new Response(JSON.stringify({
          success: true,
          message: "Topup already processed",
          already_processed: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Get current wallet balance
      const { data: store, error: storeError } = await supabase
        .from("subagent_stores")
        .select("wallet_balance")
        .eq("id", subagentStoreId)
        .single();
      
      if (storeError || !store) {
        return new Response(JSON.stringify({ error: "Subagent store not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const newBalance = (Number(store.wallet_balance) || 0) + baseAmount;
      
      // Update wallet balance
      const { error: updateError } = await supabase
        .from("subagent_stores")
        .update({ wallet_balance: newBalance })
        .eq("id", subagentStoreId);
      
      if (updateError) {
        console.error("Failed to update subagent wallet:", updateError);
        return new Response(JSON.stringify({ error: "Failed to update wallet" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Record the topup
      await supabase.from("subagent_wallet_topups").insert({
        subagent_store_id: subagentStoreId,
        amount: baseAmount,
        paystack_reference: reference,
      });
      
      return new Response(JSON.stringify({
        success: true,
        message: `Wallet topped up with GH₵${baseAmount.toFixed(2)}`,
        new_balance: newBalance,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================
    // REGULAR DATA PACKAGE PURCHASE HANDLER
    // =====================================
    const phone = metadata.phone || "";
    const packageId = metadata.package_id || "";
    const network = metadata.network || "";
    const packageName = metadata.package_name || "";
    const agentStoreId = metadata.agent_store_id || null;
    const subagentStoreId = metadata.subagent_store_id || null;

    const sizeMatch = packageName.match(/(\d+(?:\.\d+)?)/);
    const sizeGb = sizeMatch ? parseFloat(sizeMatch[1]) : 0;
    const amount = txData.amount / 100; // Customer's selling price

    // Fast check – does order already exist?
    const { data: existing } = await supabase
      .from("orders")
      .select("id")
      .eq("paystack_reference", reference)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({
        success: true,
        message: "Payment already processed – your data is on the way!",
        order_id: existing.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================================
    // FETCH PRICES TO STORE PERMANENTLY WITH THE ORDER
    // =====================================================
    let sellingPrice = amount;
    let basePriceForOrder = 0;
    let profitForOrder = 0;

    // Get package base price (agent_price from data_packages - what admin charges agents)
    const { data: pkgData } = await supabase
      .from("data_packages")
      .select("agent_price")
      .eq("id", packageId)
      .single();

    const adminBasePrice = pkgData?.agent_price ? Number(pkgData.agent_price) : 0;

    if (subagentStoreId) {
      // =====================================================
      // SUBAGENT ORDER - CRITICAL PRICING LOGIC
      // =====================================================
      // Price chain: Admin -> Agent -> Subagent -> Customer
      // - adminBasePrice = data_packages.agent_price (what admin charges agent)
      // - agentPriceToSubagent = subagent_package_prices.base_price (what agent charges subagent for THIS package)
      // - sellingPrice = amount (what customer paid)
      //
      // Profits (stored in order):
      // - base_price = what agent charges subagent (subagent's cost)
      // - selling_price = what customer paid
      // - profit = selling_price - base_price (subagent's profit)
      //
      // Agent commission (calculated in fulfill-order, NOT here):
      // - agentCommission = base_price - adminBasePrice
      
      // Get subagent store info (for parent agent_store_id)
      const { data: subagentStore } = await supabase
        .from("subagent_stores")
        .select("agent_store_id")
        .eq("id", subagentStoreId)
        .single();

      // Get the SPECIFIC price agent set for this subagent for THIS package
      const { data: subagentPackagePrice } = await supabase
        .from("subagent_package_prices")
        .select("base_price")
        .eq("subagent_store_id", subagentStoreId)
        .eq("package_id", packageId)
        .maybeSingle();

      // Price agent charges subagent for this specific package
      // If no custom price set, fallback to admin's base price (agent makes no commission)
      const agentPriceToSubagent = subagentPackagePrice?.base_price 
        ? Number(subagentPackagePrice.base_price) 
        : adminBasePrice;
      
      // Store in order:
      sellingPrice = amount;
      basePriceForOrder = agentPriceToSubagent; // Subagent's cost
      profitForOrder = sellingPrice - basePriceForOrder; // Subagent's profit

      console.log(`Subagent order: adminBasePrice=${adminBasePrice}, agentPriceToSubagent=${agentPriceToSubagent}, sellingPrice=${sellingPrice}, subagentProfit=${profitForOrder}`);

      // DO NOT credit agent commission here!
      // Agent commission will be credited in fulfill-order ONLY after successful fulfillment.
      // This prevents double crediting and ensures commission is only given for completed orders.

    } else if (agentStoreId) {
      // =====================================================
      // AGENT ORDER (direct sale, no subagent)
      // =====================================================
      sellingPrice = amount;
      basePriceForOrder = adminBasePrice;
      profitForOrder = sellingPrice - basePriceForOrder; // Agent's profit

    } else {
      // =====================================================
      // DIRECT/ADMIN ORDER (no agent, no subagent)
      // =====================================================
      sellingPrice = amount;
      basePriceForOrder = adminBasePrice;
      profitForOrder = 0;
    }

    // Build the new order with STORED PRICES
    const orderInsert: Record<string, unknown> = {
      customer_number: phone,
      package_id: packageId,
      network,
      size_gb: sizeGb,
      amount,
      status: "paid",
      fulfillment_status: "pending",
      paystack_reference: reference,
      // STORE PRICES PERMANENTLY - these won't change even if prices are updated later
      selling_price: sellingPrice,
      base_price: basePriceForOrder,
      profit: profitForOrder,
      // Mark profit as NOT YET credited - fulfill-order will credit it
      profit_credited: false,
    };
    
    if (agentStoreId) {
      orderInsert.agent_store_id = agentStoreId;
    }
    if (subagentStoreId) {
      orderInsert.subagent_store_id = subagentStoreId;
      
      // Also get and store parent agent_store_id for tracking
      const { data: subagentStore } = await supabase
        .from("subagent_stores")
        .select("agent_store_id")
        .eq("id", subagentStoreId)
        .maybeSingle();
      
      if (subagentStore?.agent_store_id) {
        orderInsert.agent_store_id = subagentStore.agent_store_id;
      }
    }

    let orderId = "";

    // Insert with race-condition protection
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
          return new Response(JSON.stringify({
            success: true,
            message: "Payment already processed – your data is on the way!",
            order_id: actualOrder.id,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      console.error("Order insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to create order", details: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      console.error("Fulfillment attempt error (admin will retry):", fulfillErr);
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Payment confirmed! Your data bundle is being processed.",
      order_id: orderId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Verify error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
