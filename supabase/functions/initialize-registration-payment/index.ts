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
            return new Response(JSON.stringify({ error: "Missing required fields: email, amount, phone" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
        const APP_URL = Deno.env.get("APP_URL");

        if (!PAYSTACK_SECRET_KEY) {
            console.error("[PAYMENT] PAYSTACK_SECRET_KEY not configured");
            return new Response(JSON.stringify({ error: "Paystack not configured" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        if (!APP_URL) {
            console.error("[PAYMENT] APP_URL not configured");
            return new Response(JSON.stringify({ error: "APP_URL not configured" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const amountInPesewas = Math.round(amount * 100);

        console.log("[PAYMENT] Initializing payment:", {
            email,
            amount,
            phone,
            amountInPesewas,
            callback_url: `${APP_URL}/agent-registration-callback`,
        });

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
                callback_url: `${APP_URL}/agent-registration-callback`,
                metadata: {
                    ...metadata,
                    phone,
                    type: "agent_registration",
                },
            }),
        });

        const result = await paystackRes.json();

        console.log("[PAYMENT] Paystack response:", result);

        if (!result.status) {
            console.error("[PAYMENT] Paystack error:", result.message);
            return new Response(JSON.stringify({ error: result.message || "Payment initialization failed" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify({
            authorization_url: result.data.authorization_url,
            reference: result.data.reference
        }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err) {
        const errorMessage = (err as Error).message;
        console.error("[PAYMENT] Error:", errorMessage, err);
        return new Response(JSON.stringify({ error: errorMessage || "Internal server error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
