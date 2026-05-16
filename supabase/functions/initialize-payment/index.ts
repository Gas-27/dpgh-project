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
    const { email, amount, phone, metadata, callback_url } = await req.json();

    if (!email || !amount || !phone) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      console.error("[Payment] PAYSTACK_SECRET_KEY is not set in Edge Function environment");
      return new Response(JSON.stringify({ error: "Paystack API key not configured. Please set PAYSTACK_SECRET_KEY in Supabase Settings > Edge Functions > Secrets." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log("[Payment] Processing payment for", phone, "amount", amount);

    // Amount in pesewas (kobo equivalent for GHS)
    const amountInPesewas = Math.round(amount * 100);

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
    
    console.log("[Payment] Paystack response:", result);

    if (!result.status) {
      console.error("[Payment] Paystack error:", result.message);
      return new Response(JSON.stringify({ error: result.message || "Payment initialization failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log("[Payment] Success, authorization_url:", result.data.authorization_url);

    return new Response(JSON.stringify({ authorization_url: result.data.authorization_url, reference: result.data.reference }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
