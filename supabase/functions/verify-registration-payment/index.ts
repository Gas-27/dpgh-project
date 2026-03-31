// supabase/functions/verify-registration-payment/index.ts
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
        const { reference } = await req.json();

        if (!reference) {
            return new Response(JSON.stringify({ error: "Missing reference" }), {
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

        const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
        });

        const verifyData = await verifyRes.json();

        if (!verifyData.status || verifyData.data?.status !== "success") {
            return new Response(JSON.stringify({ error: "Payment not verified", success: false }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const txData = verifyData.data;
        const metadata = txData.metadata || {};

        // Check if payment type is agent registration
        if (metadata.type !== "agent_registration") {
            return new Response(JSON.stringify({ error: "Invalid payment type", success: false }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        return new Response(JSON.stringify({ success: true, data: txData }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err) {
        console.error("Verify error:", err);
        return new Response(JSON.stringify({ error: (err as Error).message, success: false }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});