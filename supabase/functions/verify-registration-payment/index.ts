// supabase/functions/verify-registration-payment/index.ts
// This function verifies agent registration payments and returns metadata for store creation

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

        // Verify payment with Paystack
        const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
        });

        const verifyData = await verifyRes.json();

        if (!verifyData.status || verifyData.data?.status !== "success") {
            return new Response(JSON.stringify({ 
                error: "Payment not verified", 
                details: verifyData.message 
            }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const txData = verifyData.data;
        const metadata = txData.metadata || {};

        // Verify this is an agent registration payment
        if (metadata.type !== "agent_registration") {
            return new Response(JSON.stringify({ 
                error: "Invalid payment type",
                details: "This payment is not for agent registration"
            }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Return success with metadata for store creation
        // The callback page will use this data to create the agent store
        return new Response(JSON.stringify({
            success: true,
            message: "Registration payment verified successfully",
            amount: txData.amount / 100,
            reference: reference,
            user_id: metadata.user_id || null,
            store_data: metadata.store_data || null,
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("Verify registration payment error:", err);
        return new Response(JSON.stringify({ error: (err as Error).message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
