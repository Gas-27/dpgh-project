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

  try {
    const { email, phone, metadata, callback_url } = await req.json();

    // Don't require amount from frontend - we calculate it server-side for security
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

    // Priority: 1. Subagent's sell_price, 2. Agent's sell_price, 3. Admin's base price
    if (metadata.subagent_store_id) {
      // Check for subagent's custom price first
      const { data: subagentPrice } = await supabaseClient
        .from("subagent_package_prices")
        .select("sell_price")
        .eq("subagent_store_id", metadata.subagent_store_id)
        .eq("package_id", metadata.package_id)
        .single();

      if (subagentPrice?.sell_price != null) {
        baseAmount = Number(subagentPrice.sell_price);
        priceType = "subagent_sell_price";
        console.log(`Using subagent's sell_price: ${baseAmount}`);
      } else {
        // Fall back to agent's sell_price if subagent hasn't set their own
        // First get the agent_store_id from the subagent store
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
            .single();

          if (agentPrice?.sell_price != null) {
            baseAmount = Number(agentPrice.sell_price);
            priceType = "agent_sell_price_fallback";
            console.log(`Using agent's sell_price as fallback: ${baseAmount}`);
          } else {
            baseAmount = Number(packageData.price);
            priceType = "admin_user_price";
            console.log(`Using admin base price: ${baseAmount}`);
          }
        } else {
          baseAmount = Number(packageData.price);
          priceType = "admin_user_price";
          console.log(`Using admin base price: ${baseAmount}`);
        }
      }
    } else if (metadata.agent_store_id) {
      // Agent store purchase - use agent's sell_price
      const { data: agentPrice } = await supabaseClient
        .from("agent_package_prices")
        .select("sell_price")
        .eq("agent_store_id", metadata.agent_store_id)
        .eq("package_id", metadata.package_id)
        .single();

      if (agentPrice?.sell_price != null) {
        baseAmount = Number(agentPrice.sell_price);
        priceType = "agent_sell_price";
        console.log(`Using agent's sell_price: ${baseAmount}`);
      } else {
        baseAmount = Number(packageData.price);
        priceType = "admin_user_price";
        console.log(`Using admin base price: ${baseAmount}`);
      }
    } else {
      // Direct purchase from main site - use admin's base price
      baseAmount = Number(packageData.price);
      priceType = "admin_user_price";
      console.log(`Using admin base price: ${baseAmount}`);
    }

    // Calculate total with Paystack fee (1.98%)
    const feeAmount = baseAmount * (PAYSTACK_FEE_PERCENT / 100);
    const totalWithFee = baseAmount + feeAmount;
    // Round to 2 decimal places using proper rounding
    const amountToCharge = Math.round(totalWithFee * 100) / 100;

    console.log(`Calculated amount - Base: ${baseAmount}, Fee: ${feeAmount.toFixed(2)}, Total: ${amountToCharge}, Type: ${priceType}`);

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "Paystack not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      // Return the calculated amount so frontend can display it
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
