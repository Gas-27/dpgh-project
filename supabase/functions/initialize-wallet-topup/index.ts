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

    // ============================================
    // STEP 1: Parse Request
    // ============================================
    const { api_key, identity_id, email, amount, callback_url, walletType = "api" } = await req.json();

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

    // ============================================
    // STEP 2: Validate User and Get Info
    // ============================================
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    let userEmail = "";
    let userId = "";
    let apiUser = null;

    // ========================================
    // NORMAL WALLET - CUSTOMER (looked up by user_id)
    // ========================================
    if (walletType === "normal" && identity_id) {
      console.log(`[INITIALIZE-WALLET-TOPUP] Processing NORMAL wallet for user_id: ${identity_id}`);

      // customers.user_id is the auth user id; customers.id is the PK
      const { data: customer } = await supabase
        .from("customers")
        .select("id, email")
        .eq("user_id", identity_id)
        .maybeSingle();

  // Prefer the real email passed from the frontend
  const realEmail = email || `user-${identity_id}@dataplug.store`;

  if (customer) {
  userId = customer.id;
  userEmail = realEmail;
  console.log(`[INITIALIZE-WALLET-TOPUP] Found existing customer: ${userId}`);

  // If the stored email is missing or a generated placeholder, fix it with the real email
  const storedEmail = customer.email || "";
  if (email && (storedEmail === "" || storedEmail.startsWith("user-"))) {
  await supabase
  .from("customers")
  .update({ email: realEmail, updated_at: new Date().toISOString() })
  .eq("id", customer.id);
  console.log(`[INITIALIZE-WALLET-TOPUP] Updated customer email to: ${realEmail}`);
  } else {
  userEmail = storedEmail || realEmail;
  }
  } else {
  // Create a customer row linked via user_id, using the real email
  userEmail = realEmail;
  console.log(`[INITIALIZE-WALLET-TOPUP] Creating new customer for user_id: ${identity_id}`);
  
  const { data: newCustomer, error: createError } = await supabase
  .from("customers")
  .insert({
  user_id: identity_id,
  email: userEmail,
  wallet_balance: 0,
  customer_type: "customer",
  status: "active",
  })
  .select("id")
  .maybeSingle();

        if (createError || !newCustomer) {
          console.error(`[INITIALIZE-WALLET-TOPUP] Failed to create customer:`, createError);
          return new Response(
            JSON.stringify({ error: "Could not create customer record" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        userId = newCustomer.id;
        console.log(`[INITIALIZE-WALLET-TOPUP] Customer created: ${userId}`);
      }
    }
    // ========================================
    // API WALLET - AGENT/USER (by api_key)
    // ========================================
    else if (walletType === "api" && api_key) {
      console.log(`[INITIALIZE-WALLET-TOPUP] Processing API wallet with api_key`);

      const { data, error } = await supabase
        .from("api_users")
        .select("id, identity_id, is_user, is_agent, wallet, active")
        .eq("api_key", api_key)
        .eq("active", true)
        .single();

      if (error || !data) {
        console.error(`[INITIALIZE-WALLET-TOPUP] Invalid API key:`, error);
        return new Response(
          JSON.stringify({ error: "Invalid or inactive API key" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      apiUser = data;
      userEmail = `wallet-${apiUser.id}@dataplug.store`;
      userId = apiUser.id;
      console.log(`[INITIALIZE-WALLET-TOPUP] Found user by API key: ${apiUser.id}`);
    }
    // ========================================
    // API WALLET - AGENT/USER (by identity_id)
    // ========================================
    else if (walletType === "api" && identity_id) {
      console.log(`[INITIALIZE-WALLET-TOPUP] Processing API wallet with identity_id`);

      const { data, error } = await supabase
        .from("api_users")
        .select("id, identity_id, is_user, is_agent, wallet, active")
        .eq("identity_id", identity_id)
        .eq("active", true)
        .single();

      if (error || !data) {
        console.error(`[INITIALIZE-WALLET-TOPUP] Identity not found:`, error);
        return new Response(
          JSON.stringify({ error: "User not found or inactive" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      apiUser = data;
      userEmail = `wallet-${apiUser.id}@dataplug.store`;
      userId = apiUser.id;
      console.log(`[INITIALIZE-WALLET-TOPUP] Found user by identity_id: ${apiUser.id}`);
    }

    console.log(`[INITIALIZE-WALLET-TOPUP] Using email: ${userEmail}`);

    // ============================================
    // STEP 3: Initialize Paystack Payment
    // ============================================
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      console.error("[INITIALIZE-WALLET-TOPUP] PAYSTACK_SECRET_KEY not set");
      return new Response(
        JSON.stringify({ error: "Payment service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseAmount = Number(amount);
    const feeAmount = baseAmount * (PAYSTACK_FEE_PERCENT / 100);
    const totalWithFee = Math.round((baseAmount + feeAmount) * 100) / 100;
    const amountInPesewas = Math.round(totalWithFee * 100);

    const reference = `WALLET_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const metadata = walletType === "normal"
      ? {
          type: "user_wallet_topup",
          wallet_type: "normal",
          customer_id: userId,
          base_amount: baseAmount,
          fee_amount: feeAmount,
        }
      : {
          type: "api_wallet_topup",
          wallet_type: "api",
          api_user_id: apiUser.id,
          identity_id: apiUser.identity_id,
          is_user: apiUser.is_user,
          is_agent: apiUser.is_agent,
          base_amount: baseAmount,
          fee_amount: feeAmount,
        };

    console.log(`[INITIALIZE-WALLET-TOPUP] Paystack metadata:`, metadata);

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

    // ============================================
    // STEP 4: Create pending topup record
    // ============================================
    if (walletType === "normal") {
      const { error: topupError } = await supabase
        .from("user_wallet_topups")
        .insert({
          customer_id: userId,
          amount: baseAmount,
          paystack_reference: reference,
          status: "pending",
          created_at: new Date().toISOString(),
        });

      if (topupError) {
        console.error(`[INITIALIZE-WALLET-TOPUP] Failed to create topup record:`, topupError);
      }
    } else {
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
        console.error(`[INITIALIZE-WALLET-TOPUP] Failed to create topup record:`, topupError);
      }
    }

    // ============================================
    // STEP 5: Return Response
    // ============================================
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
        },
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
