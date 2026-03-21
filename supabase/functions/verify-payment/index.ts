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
      return new Response(JSON.stringify({ error: "Payment not verified", details: verifyData.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const txData = verifyData.data;
    const metadata = txData.metadata || {};
    const phone = metadata.phone || "";
    const packageId = metadata.package_id || "";
    const network = metadata.network || "";
    const packageName = metadata.package_name || "";
    const agentStoreId = metadata.agent_store_id || null;

    // Extract size from package name (e.g. "5GB" -> 5)
    const sizeMatch = packageName.match(/(\d+(?:\.\d+)?)/);
    const sizeGb = sizeMatch ? parseFloat(sizeMatch[1]) : 0;
    const amount = txData.amount / 100; // Convert from pesewas

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Check if order already exists for this reference
    const { data: existing } = await supabase
      .from("orders")
      .select("id")
      .eq("paystack_reference", reference)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ success: true, message: "Order already processed", order_id: existing.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create order
    const orderInsert: Record<string, unknown> = {
      customer_number: phone,
      package_id: packageId,
      network,
      size_gb: sizeGb,
      amount,
      status: "paid",
      fulfillment_status: "pending",
      paystack_reference: reference,
    };
    if (agentStoreId) {
      orderInsert.agent_store_id = agentStoreId;
    }

    const { data: order, error: insertErr } = await supabase
      .from("orders")
      .insert(orderInsert)
      .select("id")
      .single();

    if (insertErr) {
      console.error("Order insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to create order", details: insertErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to fulfill the order via the data API
    const fulfillUrl = `${supabaseUrl}/functions/v1/fulfill-order`;
    const fulfillRes = await fetch(fulfillUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify({ order_id: order.id }),
    });

    const fulfillData = await fulfillRes.json();

    return new Response(JSON.stringify({
      success: true,
      message: fulfillData.success
        ? "Payment verified and data is being processed!"
        : "Payment verified! Your data is being processed.",
      order_id: order.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Verify error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
