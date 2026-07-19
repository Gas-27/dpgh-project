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

// Datahubnet Mashup Package ID Mappings - embedded directly for Deno compatibility
const DATAHUBNET_MASHUP_IDS: Record<string, number> = {
  "1.7": 14,
  "3": 3,
  "2.6": 16,
  "8.2": 17,
  "11.9": 18,
  "3.61": 20,
  "15.3": 19,
  "2.6 GB + 1,077 mins": 16,
  "1077mins + 2.6GB": 16,
  "1077 mins + 2.6GB": 16,
  "1077mins+2.6GB": 16,
  "3.61GB + 1485Mins": 20,
  "1485mins + 3.61GB": 20,
  "1485 mins + 3.61GB": 20,
  "1485mins+3.61GB": 20,
};
  "1485mins + 3.61GB": 20,
  "1485 mins + 3.61GB": 20,
};

// Get the datahubnet package ID for a mashup package
function getDatahubnetPackageId(sizeGbText?: string, sizeGb?: number): number | undefined {
  if (sizeGbText) {
    const normalized = sizeGbText.toLowerCase().trim();
    
    if (normalized.includes("1.7")) return DATAHUBNET_MASHUP_IDS["1.7"];
    if (normalized.includes("5.1")) return DATAHUBNET_MASHUP_IDS["3"];
    if (normalized.includes("2.6")) return DATAHUBNET_MASHUP_IDS["2.6"];
    if (normalized.includes("8.2")) return DATAHUBNET_MASHUP_IDS["8.2"];
    if (normalized.includes("11.9")) return DATAHUBNET_MASHUP_IDS["11.9"];
    if (normalized.includes("3.61")) return DATAHUBNET_MASHUP_IDS["3.61"];
    if (normalized.includes("15.3")) return DATAHUBNET_MASHUP_IDS["15.3"];
  }

  if (sizeGb !== undefined) {
    const rounded = sizeGb.toFixed(1);
    return DATAHUBNET_MASHUP_IDS[rounded];
  }

  return undefined;
}

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
      .select("id, fulfillment_status, status, customer_number, network, size_gb, package_id, data_package_id")
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
    
    // For mtn_mashup and mashup, use datahubnet package ID from size_gb_text
    let dataPackageId = existingOrder.data_package_id;
    let sizeGbText = null;
    
    if (!dataPackageId && (existingOrder.network === "mtn_mashup" || existingOrder.network === "mashup")) {
      sizeGbText = existingOrder.size_gb_text;
      console.log(`[v0] Looking up datahubnet ID for mashup: sizeGbText="${sizeGbText}", sizeGb=${existingOrder.size_gb}`);
      
      // Use the embedded function to get the datahubnet ID
      dataPackageId = getDatahubnetPackageId(sizeGbText, Number(existingOrder.size_gb));
      
      if (dataPackageId) {
        console.log(`[v0] Found datahubnet ID: ${dataPackageId} for mashup package`);
      } else {
        console.error(`[v0] Could not find datahubnet ID for mashup package: "${sizeGbText}" (size_gb: ${existingOrder.size_gb})`);
      }
      
      // If still not found, try fetching from data_packages table as last resort
      if (!dataPackageId && existingOrder.package_id) {
        console.log(`[v0] Trying to fetch from data_packages table for package_id: ${existingOrder.package_id}`);
        const { data: pkg } = await supabase
          .from("data_packages")
          .select("data_package_id, size_gb_text")
          .eq("id", existingOrder.package_id)
          .single();
        dataPackageId = pkg?.data_package_id || null;
        sizeGbText = pkg?.size_gb_text || null;
        if (dataPackageId) {
          console.log(`[v0] Found from data_packages: data_package_id=${dataPackageId}`);
        }
      }
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
    
    if (existingOrder.network === "mtn_mashup" || existingOrder.network === "mashup") {
      // Use Datahubnet API for mtn_mashup and mashup
      if (!dataPackageId) {
        console.error(`[v0] ERROR: No datahubnet package ID found for mashup order. sizeGbText="${sizeGbText}", sizeGb=${capacity}`);
        await supabase
          .from("orders")
          .update({ 
            fulfillment_status: "failed", 
            api_response: "Package configuration missing. Please contact support." 
          })
          .eq("id", order_id);
        return new Response(JSON.stringify({ success: false, error: "Unable to process mashup package. Package configuration missing. Please contact support." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      apiUrl = "https://www.datahubnet.online/api/v1/special-offers/";
      requestBody = {
        "phone_number": phone,
        "package_id": Number(dataPackageId),
      };
      const datahubnetApiKey = Deno.env.get("DATAHUBNET_API_KEY");
      if (!datahubnetApiKey) {
        throw new Error("DATAHUBNET_API_KEY not configured");
      }
      apiRes = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${datahubnetApiKey}`,
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

    // ✅ Success condition: HTTP 2xx AND (status === "success" OR success === true)
    const isSuccess =
      apiRes.status >= 200 &&
      apiRes.status < 300 &&
      (parsedResponse?.status === "success" || parsedResponse?.success === true);

    if (isSuccess) {
      const orderData = parsedResponse?.data || parsedResponse;
      // Extract reference from multiple possible locations
      const providerRef =
        orderData?.reference ||
        orderData?.order_reference ||
        parsedResponse?.reference ||
        parsedResponse?.order_reference ||
        null;

      console.log(`[fulfill] Success for order ${order_id}. provider_reference=${providerRef}`);

      // No profit crediting here - all profit crediting done in verify-payment
      // fulfill-order only handles order fulfillment via API

      await supabase
        .from("orders")
        .update({
          fulfillment_status: "completed",
          status: "completed",
          order_status: "processing",
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
