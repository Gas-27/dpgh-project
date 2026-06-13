import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map your internal network names to GHDATE CONNECT network keys
const NETWORK_MAP: Record<string, string> = {
  mtn: "mtn",
  telecel: "telecel",
  airteltigo: "airteltigo",
  mtn_mashup: "mtn", // Special MTN Mashup uses MTN network
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ghdateApiKey = Deno.env.get("GHDATE_API_KEY");
    const ghdateApiUrl = Deno.env.get("GHDATE_API_URL") || "https://api.ghdate.com";

    if (!ghdateApiKey) {
      return new Response(JSON.stringify({ error: "GHDATE API key not configured" }), {
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
    
    // For mtn_mashup, fetch the package to get size_gb_text
    let sizeGbText = null;
    if (existingOrder.network === "mtn_mashup" && existingOrder.package_id) {
      const { data: pkg } = await supabase
        .from("packages")
        .select("size_gb_text")
        .eq("id", existingOrder.package_id)
        .single();
      sizeGbText = pkg?.size_gb_text || null;
    }
    
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

    console.log(`Fulfilling order ${order_id}: recipient=${phone}, capacity=${capacity}GB, network=${existingOrder.network}`);

    // Call API based on network type
    let apiUrl: string;
    let requestBody: Record<string, any>;
    let apiRes: Response;
    
    if (existingOrder.network === "mtn_mashup") {
      // Use Dakazina API for mtn_mashup
      apiUrl = "https://reseller.dakazinabusinessconsult.com/api/v1/buy-data-package";
      requestBody = {
        "recipient_msisdn": phone,
        "shared_bundle": sizeGbText,
        "network_id": 7,
        "package_id": existingOrder.package_id,
        ...(order_id && { "incoming_api_ref": order_id }),
      };
      const dakazinApiKey = Deno.env.get("DAKAZINA_API_KEY");
      if (!dakazinApiKey) {
        throw new Error("DAKAZINA_API_KEY not configured");
      }
      apiRes = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${dakazinApiKey}`,
        },
        body: JSON.stringify(requestBody),
      });
    } else {
      // Use GHDATE API for other networks
      apiUrl = `${ghdateApiUrl}/api/purchase`;
      requestBody = {
        network: networkKey,
        phone: phone,
        amount: capacity,
      };
      apiRes = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ghdateApiKey}`,
        },
        body: JSON.stringify(requestBody),
      });
    }

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

      // Get the full order details to calculate profit
      const { data: fullOrder } = await supabase
        .from("orders")
        .select("*, package_id, agent_store_id, subagent_store_id, selling_price, base_price, profit, amount")
        .eq("id", order_id)
        .single();

      // No profit crediting here - all profit crediting done in verify-payment
      // fulfill-order only handles order fulfillment via API

      await supabase
        .from("orders")
        .update({
          fulfillment_status: "completed",
          status: "completed",
          api_response: rawResponse,
          provider_reference: providerRef,
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

      // Log API error for admin debugging
      console.log(`[v0] Logging data order API error for order ${order_id}`);
      try {
        await supabase.from("api_error_logs").insert({
          order_id: order_id,
          customer_number: existingOrder.customer_number,
          network: existingOrder.network,
          size_gb: existingOrder.size_gb,
          amount: existingOrder.amount,
          error_type: "DATA_ORDER_FULFILLMENT_FAILED",
          error_message: errorMessage,
          api_endpoint: apiUrl,
          http_status_code: apiRes.status,
          request_payload: requestBody,
          response_payload: parsedResponse || { raw: rawResponse.slice(0, 500) },
        });
      } catch (logErr) {
        console.error(`[v0] Failed to log error: ${logErr}`);
      }

      return new Response(JSON.stringify({ success: false, message: "Fulfillment failed", api_response: errorMessage }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("Fulfill error:", err);
    
    // Try to log the error if we have order_id
    try {
      const body = await req.clone().json().catch(() => ({}));
      const orderId = body.order_id;
      if (orderId) {
        // Get order details
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        
        const { data: order } = await supabase
          .from("orders")
          .select("customer_number, network, size_gb, amount")
          .eq("id", orderId)
          .single()
          .catch(() => ({ data: null }));

        // Log the exception error
        if (order) {
          await supabase.from("api_error_logs").insert({
            order_id: orderId,
            customer_number: order.customer_number,
            network: order.network,
            size_gb: order.size_gb,
            amount: order.amount,
            error_type: "DATA_ORDER_EXCEPTION_ERROR",
            error_message: (err as Error).message || "Unknown error in fulfillment",
            api_endpoint: `${ghdateApiUrl}/api/purchase`,
          }).catch(() => null);
        }
      }
    } catch (logErr) {
      console.error(`[v0] Failed to log exception: ${logErr}`);
    }
    
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
