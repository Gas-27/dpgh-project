import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYSTACK_FEE_PERCENT = 1.98;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log(`[INITIALIZE-WALLET-TOPUP] ========== NEW REQUEST ==========`);

    const { api_key, identity_id, amount, callback_url, walletType = "api" } = await req.json();

    console.log(`[INITIALIZE-WALLET-TOPUP] Request:`, { 
      api_key: api_key ? "present" : "missing", 
      identity_id: identity_id ? "present" : "missing",
      amount,
      walletType,
      callback_url: callback_url ? "present" : "missing"
    });

    if (!api_key && !identity_id) {
      return new Response(
        JSON.stringify({ error: "Missing api_key or identity_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid amount. Must be greater than 0" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!callback_url) {
      return new Response(
        JSON.stringify({ error: "Missing callback_url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["normal", "api"].includes(walletType)) {
      return new Response(
        JSON.stringify({ error: "Invalid wallet_type. Must be 'normal' or 'api'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    let apiUser = null;
    let customerId = null;
    let userEmail = null;

    if (walletType === "normal" && identity_id) {
      // Get customer by ID
      const { data, error } = await supabase
        .from("customers")
        .select("id, email")
        .eq("id", identity_id)
        .single();

      if (error || !data) {
        console.error(`[INITIALIZE-WALLET-TOPUP] Customer not found:`, error);
        return new Response(
          JSON.stringify({ error: "Customer not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      customerId = data.id;
      userEmail = data.email;
      console.log(`[INITIALIZE-WALLET-TOPUP] Found customer for normal wallet: ${customerId}`);
    } else if (api_key || (walletType === "api" && identity_id)) {
      // Find API user by API key or identity_id
      let query = supabase
        .from("api_users")
        .select("id, identity_id, wallet, active")
        .eq("active", true);

      let data, error;

      if (api_key) {
        const result = await query.eq("api_key", api_key).single();
        data = result.data;
        error = result.error;
      } else {
        const result = await query.eq("identity_id", identity_id).single();
        data = result.data;
        error = result.error;
      }

      if (error || !data) {
        console.error(`[INITIALIZE-WALLET-TOPUP] API user not found:`, error);
        return new Response(
          JSON.stringify({ error: "User not found or inactive" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      apiUser = data;
      userEmail = `wallet-${apiUser.id}@dataplug.store`;
      console.log(`[INITIALIZE-WALLET-TOPUP] Found API user: ${apiUser.id}`);
    }

    const baseAmount = Number(amount);
    const feeAmount = baseAmount * (PAYSTACK_FEE_PERCENT / 100);
    const totalWithFee = Math.round((baseAmount + feeAmount) * 100) / 100;
    const amountInPesewas = Math.round(totalWithFee * 100);

    const reference = `WALLET_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const metadata = {
      type: walletType === "normal" ? "user_wallet_topup" : "api_wallet_topup",
      wallet_type: walletType,
      api_user_id: apiUser?.id,
      customer_id: customerId,
      identity_id: apiUser?.identity_id,
      base_amount: baseAmount,
      fee_amount: feeAmount,
    };

    console.log(`[INITIALIZE-WALLET-TOPUP] Paystack metadata:`, metadata);

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      console.error("[INITIALIZE-WALLET-TOPUP] PAYSTACK_SECRET_KEY not set");
      return new Response(
        JSON.stringify({ error: "Payment service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const paystackPayload = {
      email: userEmail,
      amount: amountInPesewas,
      currency: "GHS",
      callback_url: callback_url,
      metadata: metadata,
      reference: reference,
    };

    console.log(`[INITIALIZE-WALLET-TOPUP] Initiating Paystack payment...`);

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackPayload),
    });

    const result = await paystackRes.json();

    if (!result.status) {
      console.error(`[INITIALIZE-WALLET-TOPUP] Paystack error:`, result);
      return new Response(
        JSON.stringify({ error: result.message || "Payment initialization failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[INITIALIZE-WALLET-TOPUP] Payment initialized successfully: ${reference}`);

    // Create pending topup record
    if (walletType === "normal" && customerId) {
      const { error: topupError } = await supabase
        .from("user_wallet_topups")
        .insert({
          customer_id: customerId,
          amount: baseAmount,
          paystack_reference: reference,
          status: "pending",
          created_at: new Date().toISOString(),
        });

      if (topupError) {
        console.error(`[INITIALIZE-WALLET-TOPUP] Failed to create user topup record:`, topupError);
      }
    } else if (apiUser) {
      const { error: topupError } = await supabase
        .from("api_wallet_topups")
        .insert({
          api_user_id: apiUser.id,
          amount: baseAmount,
          fee_amount: feeAmount,
          total_amount: totalWithFee,
          paystack_reference: reference,
          status: "pending",
          created_at: new Date().toISOString(),
        });

      if (topupError) {
        console.error(`[INITIALIZE-WALLET-TOPUP] Failed to create api topup record:`, topupError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment initialized successfully",
        data: {
          authorization_url: result.data.authorization_url,
          reference: reference,
          amount: totalWithFee,
          base_amount: baseAmount,
          fee_amount: feeAmount,
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[INITIALIZE-WALLET-TOPUP] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
