import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map your internal network names to Spendless network keys
const NETWORK_MAP: Record<string, string> = {
  mtn: "YELLO",
  telecel: "TELECEL",
  airteltigo: "AT_PREMIUM",       // iShare bundles
  // If you have airteltigo_bigtime, add: "airteltigo_bigtime": "AT_BIGTIME"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const spendlessApiKey = Deno.env.get("SPENDLESS_API_KEY");   // ← NEW env var

    if (!spendlessApiKey) {
      return new Response(JSON.stringify({ error: "Spendless API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { order_id, paystack_reference } = await req.json();

    if (!order_id) {
      return new Response(JSON.stringify({ error: "Missing order_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 🔴 CRITICAL: Check if this order has already been fulfilled
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id, fulfillment_status, status, customer_number, network, size_gb")
      .eq("id", order_id)
      .single();

    if (!existingOrder) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 🔴 CRITICAL: Don't re-fulfill already completed orders
    if (existingOrder.fulfillment_status === "completed") {
      console.log(`Order ${order_id} already fulfilled - skipping`);
      return new Response(JSON.stringify({ success: true, message: "Already fulfilled", skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingOrder.fulfillment_status === "failed") {
      console.log(`Order ${order_id} previously failed - will retry`);
    }

    // 🔴 If paystack_reference is provided, check for duplicate orders
    if (paystack_reference) {
      const { data: duplicateOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("paystack_reference", paystack_reference)
        .neq("id", order_id);

      if (duplicateOrders && duplicateOrders.length > 0) {
        console.log(`Duplicate order detected for reference ${paystack_reference} - marking order ${order_id} as duplicate`);
        await supabase
          .from("orders")
          .update({
            fulfillment_status: "duplicate",
            status: "duplicate",
            api_response: `Duplicate of order ${duplicateOrders[0].id}`
          })
          .eq("id", order_id);
        return new Response(JSON.stringify({ success: false, message: "Duplicate order detected", skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Clean phone number (same logic as before)
    let phone = existingOrder.customer_number.replace(/[^0-9]/g, "");
    if (phone.startsWith("233")) phone = "0" + phone.slice(3);
    if (!phone.startsWith("0")) phone = "0" + phone;
    if (phone.length !== 10) {
      await supabase
        .from("orders")
        .update({ fulfillment_status: "failed", api_response: "Invalid phone number format" })
        .eq("id", order_id);
      return new Response(JSON.stringify({ success: false, error: "Invalid phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map network and capacity
    const networkKey = NETWORK_MAP[existingOrder.network?.toLowerCase()] || "YELLO";
    const capacity = Number(existingOrder.size_gb);
    if (isNaN(capacity) || capacity <= 0) {
      await supabase
        .from("orders")
        .update({ fulfillment_status: "failed", api_response: "Invalid data size" })
        .eq("id", order_id);
      return new Response(JSON.stringify({ success: false, error: "Invalid capacity" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Fulfilling order ${order_id}: recipient=${phone}, capacity=${capacity}GB, networkKey=${networkKey}`);

    // 🔄 NEW: Call Spendless API
    const apiUrl = "https://spendless.top/api/purchase";
    const requestBody = {
      networkKey: networkKey,
      recipient: phone,
      capacity: capacity,
      // Optional: add webhook_url if you haven't set a global one in dashboard
      // webhook_url: "https://yourdomain.com/api/spendless-webhook"
    };

    const apiRes = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": spendlessApiKey,
      },
      body: JSON.stringify(requestBody),
    });

    const rawResponse = await apiRes.text();
    let parsedResponse = null;
    try {
      parsedResponse = JSON.parse(rawResponse);
    } catch {
      // keep null
    }

    console.log(`API response for order ${order_id}: ${apiRes.status} - ${rawResponse.slice(0, 500)}`);

    // ✅ Success condition: HTTP 201 Created + status: "success"
    if (apiRes.status === 201 && parsedResponse?.status === "success") {
      const orderData = parsedResponse.data;
      const providerRef = orderData?.reference || null;

      await supabase
        .from("orders")
        .update({
          fulfillment_status: "completed",
          status: "completed",
          api_response: rawResponse,
          provider_reference: providerRef,   // ← new column (see migration)
        })
        .eq("id", order_id);

      return new Response(JSON.stringify({ success: true, message: "Order fulfilled", reference: providerRef }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // ❌ Failure (including 400, 401, 403, 429, 500, or unexpected JSON)
      const errorMessage = parsedResponse?.message ||
        parsedResponse?.error ||
        `HTTP ${apiRes.status}: ${rawResponse.slice(0, 200)}`;

      await supabase
        .from("orders")
        .update({
          fulfillment_status: "failed",
          api_response: rawResponse,
        })
        .eq("id", order_id);

      return new Response(JSON.stringify({ success: false, message: "Fulfillment failed", api_response: errorMessage }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("Fulfill error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});