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
    // SUBAGENT REGISTRATION PAYMENT HANDLER
    // =====================================
    // =====================================
    // SUBAGENT REGISTRATION FEE PAYMENT
    // =====================================
    if (paymentType === "subagent_registration_fee") {
      const registrationId = metadata.subagent_registration_id;
      const agentStoreId = metadata.agent_store_id;

      if (!registrationId || !agentStoreId) {
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
        return new Response(JSON.stringify({ error: "Registration record not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if already processed
      if (registration.payment_status === "paid" || registration.status === "approved") {
        return new Response(JSON.stringify({
          success: true,
          message: "Registration payment already verified",
          already_processed: true,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create the subagent store NOW with approved: true
      const storeData = registration.registration_data || {};
      
      const { data: newStore, error: storeError } = await supabase
        .from("subagent_stores")
        .insert({
          user_id: registration.user_id,
          agent_store_id: registration.agent_store_id,
          store_name: storeData.store_name || registration.business_name,
          whatsapp_number: storeData.whatsapp_number || "",
          support_number: storeData.support_number || registration.phone_number,
          momo_name: storeData.momo_name || "",
          momo_number: storeData.momo_number || "",
          momo_network: storeData.momo_network || "mtn",
          wallet_balance: 0,
          approved: true
        })
        .select("id")
        .single();

      if (storeError) {
        console.error("Failed to create subagent store:", storeError);
        return new Response(JSON.stringify({ error: "Failed to create subagent store", details: storeError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[VERIFY] Subagent store created: ${newStore.id}`);

      // Mark registration as paid and approved
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
        console.error("Failed to update registration:", updateError);
        return new Response(JSON.stringify({ error: "Failed to verify registration" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[VERIFY] Subagent registration ${registrationId} payment verified and store created`);

      return new Response(JSON.stringify({
        success: true,
        message: "Registration payment verified successfully",
        type: "subagent_registration_fee",
        registration_id: registrationId,
        subagent_store_id: newStore.id,
        verified: true,
      }), {
        status: 200,
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
    const sizeGbText = metadata.size_gb_text || "";
    const agentStoreId = metadata.agent_store_id || null;
    const subagentStoreId = metadata.subagent_store_id || null;

    const sizeMatch = packageName.match(/(\d+(?:\.\d+)?)/);
    let sizeGb = sizeMatch ? parseFloat(sizeMatch[1]) : 0;
    
    // For mashup packages, extract the correct GB value from sizeGbText (not packageName which may have minutes)
    if ((network === "mashup" || network === "mtn_mashup") && sizeGbText) {
      // Extract GB value from formats like "2.6 GB + 1,077 mins" or "1077mins + 2.6GB"
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
      return new Response(JSON.stringify({
        success: true,
        message: "Payment already processed – your data is on the way!",
        order_id: existing.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================================
    // CALCULATE PRICES
    // =====================================================
    let sellingPrice = amount;
    let basePriceForOrder = 0;
    let profitForOrder = 0;

    const { data: pkgData } = await supabase
      .from("data_packages")
      .select("agent_price")
      .eq("id", packageId)
      .single();

    const adminBasePrice = pkgData?.agent_price ? Number(pkgData.agent_price) : 0;

    if (subagentStoreId) {
      // SUBAGENT ORDER
      const { data: subagentStore } = await supabase
        .from("subagent_stores")
        .select("agent_store_id, wallet_balance")
        .eq("id", subagentStoreId)
        .single();

      const { data: packagePrice } = await supabase
        .from("subagent_package_prices")
        .select("base_price")
        .eq("subagent_store_id", subagentStoreId)
        .eq("package_id", packageId)
        .maybeSingle();

      const agentPriceToSubagent = packagePrice?.base_price != null 
        ? Number(packagePrice.base_price) 
        : adminBasePrice;
      
      sellingPrice = amount;
      basePriceForOrder = agentPriceToSubagent;
      profitForOrder = sellingPrice - basePriceForOrder;

      // NOTE: Wallet credits are handled by Paystack webhook ONLY
      // Do NOT credit wallet here - webhook handles all wallet updates to avoid double-crediting
      console.log(`[v0] Subagent order - wallet credit delegated to webhook. Profit: ${profitForOrder}`);

    } else if (agentStoreId) {
      // AGENT ORDER (direct sale) - ONLY if explicitly set
      // Do NOT auto-assign agentStoreId from metadata to prevent accidentally crediting agents for main site orders
      sellingPrice = amount;
      basePriceForOrder = adminBasePrice;
      profitForOrder = sellingPrice - basePriceForOrder;
      
      console.log(`[v0] Agent order: agentStoreId=${agentStoreId}, profit=${profitForOrder}`);
    } else {
      // DIRECT/ADMIN ORDER (no agent, no subagent) - main site orders
      sellingPrice = amount;
      basePriceForOrder = adminBasePrice;
      profitForOrder = 0;
      
      // Force clear agent_store_id to prevent accidental crediting
      agentStoreId = null;
      
      console.log(`[v0] Main site order: no agent, profit=0`);
    }

    // Build the new order
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
    };
    
    // ONLY assign agent/subagent if they are explicitly provided AND valid
    if (subagentStoreId) {
      // Subagent order - credit subagent wallet
      orderInsert.subagent_store_id = subagentStoreId;
      
      const { data: subagentStore } = await supabase
        .from("subagent_stores")
        .select("agent_store_id")
        .eq("id", subagentStoreId)
        .maybeSingle();
      
      if (subagentStore?.agent_store_id) {
        orderInsert.agent_store_id = subagentStore.agent_store_id;
      }
    } else if (agentStoreId) {
      // Direct agent order - assign only if this is explicitly a direct agent sale
      orderInsert.agent_store_id = agentStoreId;
    }
    // else: main site order, leave both as null

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
      console.error("Fulfillment attempt error:", fulfillErr);
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
