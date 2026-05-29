// supabase/functions/initialize-payment/index.ts

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

  console.log("[v0] ===== initialize-payment function START =====");

  try {
    const body = await req.json();
    const { email, phone, metadata, callback_url, amount: requestedAmount } = body;
    
    console.log("[v0] Request received with metadata type:", metadata?.type);

    // Handle agent_registration payments
    if (metadata?.type === "agent_registration") {
      if (!requestedAmount || !email || !metadata?.agent_store_id) {
        console.error("[v0] VALIDATION FAILED: Missing required fields for agent registration");
        return new Response(JSON.stringify({ error: "Missing required fields for agent registration" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
      if (!PAYSTACK_SECRET_KEY) {
        console.error("[v0] CRITICAL: Paystack secret key not configured");
        return new Response(JSON.stringify({ error: "Paystack not configured" }), {
          status: 500,
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
        console.error("Paystack error:", result);
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

    // Handle spin_wheel payments differently - they send amount directly
    if (metadata?.type === "spin_wheel") {
      if (!requestedAmount || !email || !phone) {
        return new Response(JSON.stringify({ error: "Missing required fields for spin wheel payment" }), {
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
        console.error("Paystack error:", result);
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

    // Handle wallet_topup payments - they send amount directly
    if (metadata?.type === "wallet_topup") {
      if (!requestedAmount || !email || !metadata?.agent_store_id) {
        return new Response(JSON.stringify({ error: "Missing required fields for wallet topup" }), {
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

      // Add 1.98% Paystack fee
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
        console.error("Paystack error:", result);
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

    // Handle subagent_wallet_topup payments
    if (metadata?.type === "subagent_wallet_topup") {
      if (!requestedAmount || !email || !metadata?.subagent_store_id) {
        return new Response(JSON.stringify({ error: "Missing required fields for subagent wallet topup" }), {
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

      // Add 1.98% Paystack fee
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
        console.error("Paystack error:", result);
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

    // Handle bulk_order payments
    if (metadata?.type === "bulk_order") {
      if (!requestedAmount || !email || !metadata?.recipients || !metadata?.network) {
        return new Response(JSON.stringify({ error: "Missing required fields for bulk order" }), {
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

      // Amount already includes Paystack fee from frontend
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
            type: "bulk_order",
            network: metadata.network,
            recipients: JSON.stringify(metadata.recipients),
            total_gb: metadata.total_gb,
            recipient_count: metadata.recipient_count,
            phone: phone || metadata.recipients[0]?.phone,
            agent_store_id: metadata.agent_store_id || null,
            subagent_store_id: metadata.subagent_store_id || null,
          },
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

    // Regular package payment - require package_id
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

    // Fetch package base data
    console.log("[v0] STEP 1: Fetching package data for ID:", metadata.package_id);
    const { data: packageData, error: packageError } = await supabaseClient
      .from("data_packages")
      .select("agent_price, price, size_gb, network")
      .eq("id", metadata.package_id)
      .single();

    console.log("[v0] STEP 1 COMPLETE: Package query result - error:", packageError, "data:", !!packageData);

    if (packageError || !packageData) {
      console.error("[v0] STEP 1 FAILED: Package not found - error:", packageError);
      return new Response(JSON.stringify({ error: "Package not found: " + (packageError?.message || metadata.package_id) }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let baseAmount: number;
    let priceType: string;

    console.log("[v0] Determining price with metadata:", { 
      subagent_store_id: metadata.subagent_store_id,
      agent_store_id: metadata.agent_store_id,
      package_id: metadata.package_id,
      base_package_price: packageData.price
    });

    // Priority: 1. Subagent's sell_price, 2. Agent's sell_price, 3. Admin's base price
    if (metadata.subagent_store_id) {
      console.log("[v0] Fetching subagent prices for store:", metadata.subagent_store_id);
      
      // Fetch subagent's custom price
      const { data: subagentPrices, error: subagentPriceError } = await supabaseClient
        .from("subagent_package_prices")
        .select("sell_price")
        .eq("subagent_store_id", metadata.subagent_store_id)
        .eq("package_id", metadata.package_id);

      if (subagentPriceError) {
        console.error("[v0] Error fetching subagent prices:", subagentPriceError);
      }

      const subagentPrice = subagentPrices && subagentPrices.length > 0 ? subagentPrices[0] : null;
      console.log("[v0] Subagent price query result:", { subagentPrice, count: subagentPrices?.length });

      if (subagentPrice?.sell_price != null) {
        baseAmount = Number(subagentPrice.sell_price);
        priceType = "subagent_sell_price";
        console.log(`[v0] Using subagent's sell_price: ${baseAmount}`);
      } else {
        // No custom subagent price - fall back to agent price or admin price
        console.log("[v0] STEP 2B: No subagent price found, fetching subagent store info for:", metadata.subagent_store_id);
        
        const { data: subagentStoreData, error: subagentStoreError } = await supabaseClient
          .from("subagent_stores")
          .select("agent_store_id")
          .eq("id", metadata.subagent_store_id);

        console.log("[v0] STEP 2B COMPLETE: Subagent store query - error:", subagentStoreError, "count:", subagentStoreData?.length);

        if (subagentStoreError) {
          console.error("[v0] Error fetching subagent store:", subagentStoreError);
        }

        const storeRecord = subagentStoreData && subagentStoreData.length > 0 ? subagentStoreData[0] : null;
        console.log("[v0] Store record found:", !!storeRecord, "agent_store_id:", storeRecord?.agent_store_id);

        if (storeRecord?.agent_store_id) {
          // Try to get agent's sell_price
          const { data: agentPrices, error: agentPriceError } = await supabaseClient
            .from("agent_package_prices")
            .select("sell_price")
            .eq("agent_store_id", storeRecord.agent_store_id)
            .eq("package_id", metadata.package_id);

          if (agentPriceError) {
            console.error("[v0] Error fetching agent prices:", agentPriceError);
          }

          const agentPrice = agentPrices && agentPrices.length > 0 ? agentPrices[0] : null;
          console.log("[v0] Agent price query result:", { agentPrice, count: agentPrices?.length });

          if (agentPrice?.sell_price != null) {
            baseAmount = Number(agentPrice.sell_price);
            priceType = "agent_sell_price_fallback";
            console.log(`[v0] Using agent's sell_price as fallback: ${baseAmount}`);
          } else {
            baseAmount = Number(packageData.price);
            priceType = "admin_user_price";
            console.log(`[v0] Using admin base price (no agent price): ${baseAmount}`);
          }
        } else {
          baseAmount = Number(packageData.price);
          priceType = "admin_user_price";
          console.log(`[v0] Using admin base price (no agent store found): ${baseAmount}`);
        }
      }
    } else if (metadata.agent_store_id) {
      // Agent store purchase - use agent's sell_price
      console.log("[v0] Fetching agent prices for store:", metadata.agent_store_id);
      const { data: agentPrices, error: agentPriceError } = await supabaseClient
        .from("agent_package_prices")
        .select("sell_price")
        .eq("agent_store_id", metadata.agent_store_id)
        .eq("package_id", metadata.package_id);

      if (agentPriceError) {
        console.error("[v0] Error fetching agent prices:", agentPriceError);
      }

      const agentPrice = agentPrices && agentPrices.length > 0 ? agentPrices[0] : null;
      console.log("[v0] Agent price query result:", { agentPrice, count: agentPrices?.length });

      if (agentPrice?.sell_price != null) {
        baseAmount = Number(agentPrice.sell_price);
        priceType = "agent_sell_price";
        console.log(`[v0] Using agent's sell_price: ${baseAmount}`);
      } else {
        baseAmount = Number(packageData.price);
        priceType = "admin_user_price";
        console.log(`[v0] Using admin base price (no agent price): ${baseAmount}`);
      }
    } else {
      // Direct purchase from main site - use admin's base price
      baseAmount = Number(packageData.price);
      priceType = "admin_user_price";
      console.log(`[v0] Using admin base price (direct purchase): ${baseAmount}`);
    }

    // Safety check - baseAmount must be set and valid
    if (!baseAmount || isNaN(baseAmount) || baseAmount <= 0) {
      console.error("[v0] ERROR: Invalid baseAmount after price calculation:", {
        baseAmount,
        isNaN: isNaN(baseAmount),
        packagePrice: packageData.price,
        priceType
      });
      return new Response(JSON.stringify({ 
        error: `Invalid price calculated: ${baseAmount}. Please refresh and try again.` 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate total with Paystack fee (1.98%)
    const feeAmount = baseAmount * (PAYSTACK_FEE_PERCENT / 100);
    const totalWithFee = baseAmount + feeAmount;
    // Round to 2 decimal places using proper rounding
    const amountToCharge = Math.round(totalWithFee * 100) / 100;

    console.log(`[v0] Calculated amount - Base: ${baseAmount}, Fee: ${feeAmount.toFixed(2)}, Total: ${amountToCharge}, Type: ${priceType}`);

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      console.error("[v0] CRITICAL: Paystack secret key not configured");
      return new Response(JSON.stringify({ error: "Paystack not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amountInPesewas = Math.round(amountToCharge * 100);
    
    console.log(`[v0] Sending to Paystack - Amount in Pesewas: ${amountInPesewas}, Email: ${email}, Phone: ${phone}`);

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

    console.log("[v0] Paystack response status:", paystackRes.status, "Body:", result);

    if (!result.status) {
      console.error("[v0] Paystack returned error:", { 
        paystack_status: result.status, 
        paystack_message: result.message,
        paystack_response: result 
      });
      return new Response(JSON.stringify({ 
        error: result.message || "Payment initialization failed" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Final validation - make sure authorization_url exists
    if (!result.data?.authorization_url) {
      console.error("[v0] CRITICAL: No authorization_url in Paystack response:", result.data);
      return new Response(JSON.stringify({ 
        error: "Paystack did not provide authorization URL" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[v0] Payment initialization successful, returning authorization URL");

    return new Response(JSON.stringify({
      authorization_url: result.data.authorization_url,
      reference: result.data.reference,
      // Return the calculated amount so frontend can display it
      amount: amountToCharge,
      base_amount: baseAmount,
      fee_amount: feeAmount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[v0] ===== EDGE FUNCTION ERROR =====");
    console.error("[v0] Error type:", err?.constructor?.name);
    console.error("[v0] Error message:", err?.message);
    console.error("[v0] Error details:", err);
    console.error("[v0] Error stack:", err?.stack?.substring(0, 500));
    console.error("[v0] ===== END ERROR =====");
    
    const errorMessage = err?.message || "Unknown error in payment initialization";
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      error_type: err?.constructor?.name,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    console.log("[v0] ===== initialize-payment function END =====");
  }
});
