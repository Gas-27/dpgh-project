// supabase/functions/verify-wallet-topup/index.ts
// Verifies wallet topup payment and credits the agent's wallet balance

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

        // Verify this is a wallet topup payment
        if (metadata.type !== "wallet_topup") {
            return new Response(JSON.stringify({ 
                error: "Invalid payment type",
                details: "This payment is not for wallet topup"
            }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const agentStoreId = metadata.agent_store_id;
        const amount = txData.amount / 100; // Convert from pesewas to GHS

        if (!agentStoreId) {
            return new Response(JSON.stringify({ 
                error: "Missing agent store ID in payment metadata"
            }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // Check if this topup reference was already processed
        const { data: existingTopup } = await supabase
            .from("wallet_topups")
            .select("id")
            .eq("paystack_reference", reference)
            .maybeSingle();

        if (existingTopup) {
            return new Response(JSON.stringify({
                success: true,
                message: "Topup already processed",
                already_processed: true,
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Get current wallet balance
        const { data: agentStore, error: fetchError } = await supabase
            .from("agent_stores")
            .select("wallet_balance")
            .eq("id", agentStoreId)
            .single();

        if (fetchError || !agentStore) {
            return new Response(JSON.stringify({ 
                error: "Agent store not found",
                details: fetchError?.message
            }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const currentBalance = agentStore.wallet_balance || 0;
        const newBalance = currentBalance + amount;

        // Update wallet balance
        const { error: updateError } = await supabase
            .from("agent_stores")
            .update({ wallet_balance: newBalance })
            .eq("id", agentStoreId);

        if (updateError) {
            return new Response(JSON.stringify({ 
                error: "Failed to update wallet balance",
                details: updateError.message
            }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Record the topup to prevent duplicate processing
        const { error: insertError } = await supabase
            .from("wallet_topups")
            .insert({
                agent_store_id: agentStoreId,
                amount: amount,
                paystack_reference: reference,
                status: "completed",
            });

        if (insertError) {
            console.error("Failed to record topup (wallet already credited):", insertError);
            // Don't fail the request - wallet was already credited
        }

        return new Response(JSON.stringify({
            success: true,
            message: "Wallet topped up successfully",
            amount: amount,
            new_balance: newBalance,
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("Verify wallet topup error:", err);
        return new Response(JSON.stringify({ error: (err as Error).message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
