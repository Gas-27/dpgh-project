import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { api_key, identity_id, amount, callback_url, walletType = "api" } = await req.json();

    // Validate inputs
    if (!identity_id && !api_key) {
      return new Response(
        JSON.stringify({ error: "Missing identity_id or api_key" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!callback_url) {
      return new Response(
        JSON.stringify({ error: "Missing callback_url" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    let userEmail = "";
    let userId = "";

    // For normal wallet - get customer
    if (walletType === "normal" && identity_id) {
      // Look up customer by user_id (the auth user id), NOT by id (the customer PK)
      const { data: customer } = await supabase
        .from("customers")
        .select("id, email")
        .eq("user_id", identity_id)
        .maybeSingle();

      if (customer) {
        userEmail = customer.email || `user-${identity_id}@dataplug.store`;
        userId = customer.id;
        console.log("[INITIALIZE-WALLET-TOPUP] Found existing customer:", customer.id);
      } else {
        // No customer row for this auth user yet - create one linked via user_id
        userEmail = `user-${identity_id}@dataplug.store`;

        console.log("[INITIALIZE-WALLET-TOPUP] Creating new customer for user_id:", identity_id);

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
          console.error("[INITIALIZE-WALLET-TOPUP] Failed to create customer:", createError);
          return new Response(
            JSON.stringify({ error: "Could not create customer record" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        userId = newCustomer.id;
      }
    } 
    // For API wallet - get api user
    else if (walletType === "api" && api_key) {
      const { data: apiUser, error: apiError } = await supabase
        .from("api_users")
        .select("id, identity_id, wallet")
        .eq("api_key", api_key)
        .eq("active", true)
        .maybeSingle();

      if (apiError || !apiUser) {
        return new Response(
          JSON.stringify({ error: "API key invalid or inactive" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userEmail = `api-user-${apiUser.identity_id}@dataplug.store`;
      userId = apiUser.id;
    }

    const baseAmount = Number(amount);
    const feePercent = 1.98;
    const feeAmount = baseAmount * (feePercent / 100);
    const totalAmount = baseAmount + feeAmount;
    const amountInPesewas = Math.round(totalAmount * 100);

    const reference = `WALLET_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      return new Response(
        JSON.stringify({ error: "Payment service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Paystack payment
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: userEmail,
        amount: amountInPesewas,
        currency: "GHS",
        callback_url: callback_url,
        metadata: {
          type: walletType === "normal" ? "user_wallet_topup" : "api_wallet_topup",
          wallet_type: walletType,
          customer_id: walletType === "normal" ? userId : undefined,
          api_user_id: walletType === "api" ? userId : undefined,
          base_amount: baseAmount,
          fee_amount: feeAmount,
        },
        reference: reference,
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      return new Response(
        JSON.stringify({ error: paystackData.message || "Payment initialization failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        authorization_url: paystackData.data.authorization_url,
        reference: reference,
        amount: totalAmount,
        base_amount: baseAmount,
        fee_amount: feeAmount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[INITIALIZE-WALLET-TOPUP] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
