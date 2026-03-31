// supabase/functions/initialize-registration-payment/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
        const { email, amount, phone, metadata } = await req.json();

        if (!email || !amount || !phone) {
            return new Response(JSON.stringify({ error: "Missing required fields" }), {
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
                callback_url: `${Deno.env.get("APP_URL")}/agent-registration-callback`,
                metadata: {
                    ...metadata,
                    phone,
                    type: "agent_registration",
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
        return new Response(JSON.stringify({ error: (err as Error).message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});