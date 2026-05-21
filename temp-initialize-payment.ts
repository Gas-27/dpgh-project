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
    const { email, phone, metadata, callback_url, amount: requestedAmount } = await req.json();

    // =====================================
    // SPIN WHEEL PAYMENT HANDLER
    // =====================================
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

    // =====================================
    // WALLET TOP UP PAYMENT HANDLER (Agent)
    // =====================================
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

      const baseAmount = Number(requestedAmount);
      const feeAmount = baseAmount * (PAYSTACK_FEE_PERCENT / 100);
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

    // =====================================
    // SUBAGENT WALLET TOP UP PAYMENT HANDLER
    // =====================================
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

      const baseAmount = Number(requestedAmount);
      const feeAmount = baseAmount * (PAYSTACK_FEE_PERCENT / 100);
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

    // =====================================
    // AGENT REGISTRATION FEE PAYMENT HANDLER
    // =====================================
    if (metadata?.type === "agent_registration") {
      if (!requestedAmount || !email || !metadata?.agent_store_id) {
        return new Response(JSON.stringify({ error: "Missing required fields for agent registration" }), {
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

      const baseAmount = Number(requestedAmount);
      const feeAmount = baseAmount * (PAYSTACK_FEE_PERCENT / 100);
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

    // =====================================
    // DATA PURCHASE HANDLER
    // =====================================
    if (metadata?.type === "data_purchase") {
      if (!requestedAmount || !email || !phone || !metadata?.package_id) {
        return new Response(JSON.stringify({ error: "Missing required fields for data purchase" }), {
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

      const baseAmount = Number(requestedAmount);
      const feeAmount = baseAmount * (PAYSTACK_FEE_PERCENT / 100);
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
        fee_amount: feeAmount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================
    // REGULAR PACKAGE PAYMENT HANDLER (Legacy)
    // =====================================
    if (!email || !phone || !metadata?.package_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: packageData, error: packageError } = await supabaseClient
      .from("data_packages")
      .select("agent_price, price, size_gb, network")
      .eq("id", metadata.package_id)
      .single();

    if (packageError || !packageData) {
      return new Response(JSON.stringify({ error: "Package not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let baseAmount: number;
    let priceType: string;

    if (metadata.subagent_store_id) {
      const { data: subagentPrice } = await supabaseClient
        .from("subagent_package_prices")
        .select("sell_price")
        .eq("subagent_store_id", metadata.subagent_store_id)
        .eq("package_id", metadata.package_id)
        .single();

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
            .select("sell_price")
            .eq("agent_store_id", subagentStore.agent_store_id)
            .eq("package_id", metadata.package_id)
            .single();

          baseAmount = agentPrice?.sell_price != null ? Number(agentPrice.sell_price) : Number(packageData.price);
          priceType = agentPrice?.sell_price != null ? "agent_sell_price_fallback" : "admin_user_price";
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
        .single();

      baseAmount = agentPrice?.sell_price != null ? Number(agentPrice.sell_price) : Number(packageData.price);
      priceType = agentPrice?.sell_price != null ? "agent_sell_price" : "admin_user_price";
    } else {
      baseAmount = Number(packageData.price);
      priceType = "admin_user_price";
    }

    const feeAmount = baseAmount * (PAYSTACK_FEE_PERCENT / 100);
    const totalWithFee = Math.round((baseAmount + feeAmount) * 100) / 100;

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      return new Response(JSON.stringify({ error: "Paystack not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
        metadata: { ...metadata, phone, price_type: priceType, base_amount: baseAmount, fee_amount: feeAmount },
      }),
    });

    const result = await paystackRes.json();

    if (!result.status) {
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