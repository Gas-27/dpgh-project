import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const payload = await req.json();
        // Webhook payload: { type: "INSERT", table: "withdrawal_requests", record: {...} }
        const withdrawal = payload.record;
        if (!withdrawal) throw new Error("No record in webhook payload");

        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );

        // Fetch agent details
        const { data: agent, error: agentError } = await supabaseAdmin
            .from("agent_stores")
            .select("store_name, momo_name, momo_number, momo_network, wallet_balance, whatsapp_number, support_number")
            .eq("id", withdrawal.agent_store_id)
            .single();

        if (agentError || !agent) {
            console.error("Agent not found:", agentError);
            return new Response(JSON.stringify({ error: "Agent not found" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const currentBalance = Number(agent.wallet_balance);
        const requestedAmount = Number(withdrawal.amount);
        const remainingBalance = currentBalance - requestedAmount;

        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: "DataPlug <onboarding@resend.dev>",   // ⬅️ Resend test sender – works without domain verification
                to: ["georgeagyemangsakyi27@gmail.com"],
                subject: `Withdrawal Request – ${agent.store_name}`,
                html: `
          <h2>New Withdrawal Request</h2>
          <p><strong>Agent:</strong> ${agent.store_name}</p>
          <p><strong>MoMo Name:</strong> ${agent.momo_name || "Not set"}</p>
          <p><strong>MoMo Number:</strong> ${agent.momo_number || "—"}</p>
          <p><strong>Network:</strong> ${agent.momo_network?.toUpperCase() || "—"}</p>
          <hr />
          <p><strong>Requested Amount:</strong> GH₵ ${requestedAmount.toFixed(2)}</p>
          <p><strong>Current Wallet Balance:</strong> GH₵ ${currentBalance.toFixed(2)}</p>
          <p><strong>Balance After Approval:</strong> GH₵ ${remainingBalance.toFixed(2)}</p>
          <hr />
          <p><strong>Contact:</strong> ${agent.whatsapp_number || agent.support_number || "N/A"}</p>
        `,
            }),
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText);
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (err: any) {
        console.error("Email function error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});