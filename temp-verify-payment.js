// supabase/functions/verify-payment/index.ts

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
      console.log("Verify payment: Missing reference");
      return new Response(JSON.stringify({ error: "Missing reference" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Verify payment: Checking status for reference: ${reference}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if order exists (created by webhook) - include subagent_store_id in select
    const { data: existingOrder, error: queryError } = await supabase
      .from("orders")
      .select("id, fulfillment_status, status, agent_store_id, subagent_store_id")
      .eq("paystack_reference", reference)
      .maybeSingle();

    if (queryError) {
      console.error("Verify payment: Database query error:", queryError);
      return new Response(JSON.stringify({ error: "Failed to check order status" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingOrder) {
      // Order exists - return success
      console.log(`Verify payment: Order found - ID: ${existingOrder.id}, Status: ${existingOrder.status}, Fulfillment: ${existingOrder.fulfillment_status}`);
      console.log(`Verify payment: Agent Store ID: ${existingOrder.agent_store_id || "none"}, Subagent Store ID: ${existingOrder.subagent_store_id || "none"}`);
      return new Response(JSON.stringify({
        success: true,
        message: "Payment confirmed! Your data bundle is being processed.",
        order_id: existingOrder.id,
        status: existingOrder.status,
        fulfillment_status: existingOrder.fulfillment_status,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Order not found - webhook hasn't processed yet or payment failed
    console.log(`Verify payment: No order found for reference: ${reference}. Webhook may be delayed or payment not successful.`);

    // Optional: Verify with Paystack to confirm payment status
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (PAYSTACK_SECRET_KEY) {
      try {
        const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
        });
        const verifyData = await verifyRes.json();
        
        if (verifyData.status && verifyData.data?.status === "success") {
          console.log(`Verify payment: Payment is successful at Paystack but order not yet created. Webhook may be delayed. Reference: ${reference}`);
          return new Response(JSON.stringify({
            success: false,
            status: "processing",
            message: "Payment received. Your order is being processed. Please wait a moment.",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else {
          console.log(`Verify payment: Payment not successful at Paystack. Reference: ${reference}, Status: ${verifyData.data?.status}`);
          return new Response(JSON.stringify({
            success: false,
            status: "failed",
            message: "Payment was not successful. Please try again.",
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (paystackErr) {
        console.error(`Verify payment: Error checking Paystack for reference ${reference}:`, paystackErr);
      }
    }

    // Return pending status - frontend should poll again
    return new Response(JSON.stringify({
      success: false,
      status: "pending",
      message: "Waiting for payment confirmation. Please wait...",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Verify payment error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});