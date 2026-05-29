// supabase/functions/initialize-payment/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAYSTACK_FEE_PERCENT = 1.98;

async function initializePayment(req: Request): Promise<Response> {
  console.log("[v0] HANDLER_START");
  
  try {
    // Parse request
    console.log("[v0] PARSING_REQUEST");
    const { email, phone, metadata, callback_url, amount: requestedAmount } = await req.json();
    console.log("[v0] REQUEST_PARSED", { type: metadata?.type });

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      console.error("[v0] PAYSTACK_KEY_MISSING");
      return error_response("Paystack not configured", 500);
    }

    // Route based on payment type
    const paymentType = metadata?.type;
    console.log("[v0] PAYMENT_TYPE", paymentType);

    // AGENT REGISTRATION
    if (paymentType === "agent_registration") {
      console.log("[v0] AGENT_REGISTRATION_START");
      if (!requestedAmount || !email || !metadata?.agent_store_id) {
        return error_response("Missing required fields", 400);
      }
      return await paystack_initialize(PAYSTACK_SECRET_KEY, email, requestedAmount, callback_url, { ...metadata, phone });
    }

    // SPIN WHEEL
    if (paymentType === "spin_wheel") {
      console.log("[v0] SPIN_WHEEL_START");
      if (!requestedAmount || !email || !phone) {
        return error_response("Missing required fields", 400);
      }
      return await paystack_initialize(PAYSTACK_SECRET_KEY, email, requestedAmount, callback_url, { ...metadata, phone });
    }

    // WALLET TOPUP
    if (paymentType === "wallet_topup") {
      console.log("[v0] WALLET_TOPUP_START");
      if (!requestedAmount || !email || !metadata?.agent_store_id) {
        return error_response("Missing required fields", 400);
      }
      const baseAmount = Number(requestedAmount);
      const feeAmount = baseAmount * 0.0198;
      const totalWithFee = Math.round((baseAmount + feeAmount) * 100) / 100;
      return await paystack_initialize(PAYSTACK_SECRET_KEY, email, totalWithFee, callback_url, {
        ...metadata,
        phone,
        base_amount: baseAmount,
        fee_amount: feeAmount,
      });
    }

    // SUBAGENT WALLET TOPUP
    if (paymentType === "subagent_wallet_topup") {
      console.log("[v0] SUBAGENT_WALLET_TOPUP_START");
      if (!requestedAmount || !email || !metadata?.subagent_store_id) {
        return error_response("Missing required fields", 400);
      }
      const baseAmount = Number(requestedAmount);
      const feeAmount = baseAmount * 0.0198;
      const totalWithFee = Math.round((baseAmount + feeAmount) * 100) / 100;
      return await paystack_initialize(PAYSTACK_SECRET_KEY, email, totalWithFee, callback_url, {
        ...metadata,
        phone,
        base_amount: baseAmount,
        fee_amount: feeAmount,
      });
    }

    // BULK ORDER
    if (paymentType === "bulk_order") {
      console.log("[v0] BULK_ORDER_START");
      if (!requestedAmount || !email || !metadata?.recipients || !metadata?.network) {
        return error_response("Missing required fields", 400);
      }
      const amountInPesewas = Math.round(Number(requestedAmount) * 100);
      return await paystack_initialize(PAYSTACK_SECRET_KEY, email, requestedAmount, callback_url, {
        type: "bulk_order",
        network: metadata.network,
        recipients: JSON.stringify(metadata.recipients),
        total_gb: metadata.total_gb,
        recipient_count: metadata.recipient_count,
        phone: phone || metadata.recipients[0]?.phone,
        agent_store_id: metadata.agent_store_id || null,
        subagent_store_id: metadata.subagent_store_id || null,
      });
    }

    // DATA PACKAGE PURCHASE
    console.log("[v0] DATA_PACKAGE_START");
    if (!email || !phone || !metadata?.package_id) {
      console.error("[v0] DATA_PACKAGE_VALIDATION_FAILED");
      return error_response("Missing package_id or phone", 400);
    }

    // Initialize Supabase client
    console.log("[v0] SUPABASE_CLIENT_INIT");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    console.log("[v0] SUPABASE_CLIENT_READY");

    // Get package data
    console.log("[v0] FETCH_PACKAGE", metadata.package_id);
    const packageData = await supabaseClient
      .from("data_packages")
      .select("price, size_gb, network")
      .eq("id", metadata.package_id)
      .maybeSingle();

    if (packageData.error) {
      console.error("[v0] PACKAGE_FETCH_ERROR", packageData.error);
      return error_response(`Package query failed: ${packageData.error.message}`, 400);
    }

    if (!packageData.data) {
      console.error("[v0] PACKAGE_NOT_FOUND", metadata.package_id);
      return error_response("Package not found", 404);
    }

    console.log("[v0] PACKAGE_FOUND", packageData.data.price);

    // Determine price based on store type
    let finalPrice = Number(packageData.data.price);

    if (metadata.subagent_store_id) {
      console.log("[v0] CHECKING_SUBAGENT_PRICE", metadata.subagent_store_id);
      const priceData = await supabaseClient
        .from("subagent_package_prices")
        .select("sell_price")
        .eq("subagent_store_id", metadata.subagent_store_id)
        .eq("package_id", metadata.package_id)
        .maybeSingle();

      if (priceData.error) {
        console.error("[v0] SUBAGENT_PRICE_FETCH_ERROR", priceData.error);
      }

      if (priceData.data?.sell_price) {
        finalPrice = Number(priceData.data.sell_price);
        console.log("[v0] USING_SUBAGENT_PRICE", finalPrice);
      } else {
        // Try agent price
        console.log("[v0] NO_SUBAGENT_PRICE_CHECKING_AGENT", metadata.subagent_store_id);
        const storeData = await supabaseClient
          .from("subagent_stores")
          .select("agent_store_id")
          .eq("id", metadata.subagent_store_id)
          .maybeSingle();

        if (storeData.data?.agent_store_id) {
          console.log("[v0] CHECKING_AGENT_PRICE", storeData.data.agent_store_id);
          const agentPriceData = await supabaseClient
            .from("agent_package_prices")
            .select("sell_price")
            .eq("agent_store_id", storeData.data.agent_store_id)
            .eq("package_id", metadata.package_id)
            .maybeSingle();

          if (agentPriceData.data?.sell_price) {
            finalPrice = Number(agentPriceData.data.sell_price);
            console.log("[v0] USING_AGENT_PRICE_FALLBACK", finalPrice);
          } else {
            console.log("[v0] NO_AGENT_PRICE_USING_BASE", finalPrice);
          }
        } else {
          console.log("[v0] NO_AGENT_STORE_USING_BASE", finalPrice);
        }
      }
    } else if (metadata.agent_store_id) {
      console.log("[v0] CHECKING_AGENT_PRICE", metadata.agent_store_id);
      const priceData = await supabaseClient
        .from("agent_package_prices")
        .select("sell_price")
        .eq("agent_store_id", metadata.agent_store_id)
        .eq("package_id", metadata.package_id)
        .maybeSingle();

      if (priceData.error) {
        console.error("[v0] AGENT_PRICE_FETCH_ERROR", priceData.error);
      }

      if (priceData.data?.sell_price) {
        finalPrice = Number(priceData.data.sell_price);
        console.log("[v0] USING_AGENT_PRICE", finalPrice);
      }
    } else {
      console.log("[v0] DIRECT_PURCHASE_USING_BASE", finalPrice);
    }

    // Add Paystack fee
    const feeAmount = finalPrice * (PAYSTACK_FEE_PERCENT / 100);
    const totalAmount = Math.round((finalPrice + feeAmount) * 100) / 100;
    console.log("[v0] AMOUNT_CALCULATED", { base: finalPrice, fee: feeAmount, total: totalAmount });

    return await paystack_initialize(PAYSTACK_SECRET_KEY, email, totalAmount, callback_url, {
      ...metadata,
      phone,
      base_amount: finalPrice,
      fee_amount: feeAmount,
    });
  } catch (err: any) {
    console.error("[v0] ERROR_CAUGHT", err?.message || err);
    console.error("[v0] ERROR_STACK", err?.stack?.substring(0, 300));
    return error_response(`Error: ${err?.message || "Unknown error"}`, 500);
  }
}

async function paystack_initialize(
  secretKey: string,
  email: string,
  amount: number,
  callback_url: string,
  metadata: Record<string, any>
): Promise<Response> {
  console.log("[v0] PAYSTACK_INIT", { email, amount });
  
  const amountInPesewas = Math.round(amount * 100);

  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: amountInPesewas,
      currency: "GHS",
      callback_url,
      metadata,
    }),
  });

  console.log("[v0] PAYSTACK_RESPONSE_STATUS", response.status);
  const result = await response.json();
  console.log("[v0] PAYSTACK_RESPONSE_BODY", { status: result.status, has_url: !!result.data?.authorization_url });

  if (!result.status) {
    console.error("[v0] PAYSTACK_ERROR", result.message);
    return error_response(result.message || "Paystack error", 400);
  }

  if (!result.data?.authorization_url) {
    console.error("[v0] PAYSTACK_NO_URL");
    return error_response("No authorization URL from Paystack", 500);
  }

  console.log("[v0] PAYSTACK_SUCCESS");
  return success_response({
    authorization_url: result.data.authorization_url,
    reference: result.data.reference,
    amount,
  });
}

function success_response(data: any): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function error_response(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Main handler
Deno.serve(async (req) => {
  console.log("[v0] REQUEST_RECEIVED", req.method);
  
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Add timeout wrapper
  const timeoutPromise = new Promise<Response>((resolve) => {
    setTimeout(() => {
      console.error("[v0] TIMEOUT_25_SECONDS");
      resolve(error_response("Request timeout", 500));
    }, 25000);
  });

  try {
    return await Promise.race([initializePayment(req), timeoutPromise]);
  } catch (err: any) {
    console.error("[v0] DENO_SERVE_ERROR", err?.message);
    return error_response("Server error", 500);
  }
});
