// supabase/functions/initialize-wallet-topup/index.ts
// Initializes a Paystack payment for wallet topup

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
        const { email, amount, agent_store_id, callback_url } = await req.json();

        if (!email || !amount || !agent_store_id) {
            return new Response(JSON.stringify({ error: "Missing required fields: email, amount, agent_store_id" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (amount < 1) {
            return new Response(JSON.stringify({ error: "Minimum topup amount is GHS 1" }), {
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

        // Amount in pesewas (GHS cents)
        const amountInPesewas = Math.round(amount * 100);

        // Default callback URL if not provided
        const finalCallbackUrl = callback_url || `${Deno.env.get("APP_URL")}/agent-topup-callback`;

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
                callback_url: finalCallbackUrl,
                metadata: {
                    type: "wallet_topup",
                    agent_store_id,
                    amount: amount,
                },
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
            reference: result.data.reference
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("Initialize wallet topup error:", err);
        return new Response(JSON.stringify({ error: (err as Error).message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
