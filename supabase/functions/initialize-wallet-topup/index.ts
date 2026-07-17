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
      const { data: customer, error } = await supabase
        .from("customers")
        .select("id, email")
        .eq("id", identity_id)
        .single();

      if (error || !customer) {
        return new Response(
          JSON.stringify({ error: "Customer not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userEmail = customer.email;
      userId = customer.id;
    } 
    // For API wallet - get api user
    else if (walletType === "api" && api_key) {
      const { data: apiUser, error } = await supabase
        .from("api_users")
        .select("id, identity_id")
        .eq("api_key", api_key)
        .eq("active", true)
        .single();

      if (error || !apiUser) {
        return new Response(
          JSON.stringify({ error: "API key invalid" }),
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
