import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NetworkConfig {
  apiUrl: string;
  networkMap: Record<string, string>;
  buildRequest: (phone: string, sizeGbOrId: any, networkKey: string, network: string, orderId?: string) => any;
  apiKeyEnvVar: string;
}

const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  bossudata: {
    apiUrl: "https://bossudatahub.com/api.php",
    networkMap: {
      mtn: "mtn",
      telecel: "TELECEL",
      airteltigo: "AIRTELTIGO_ISHARE",
    },
    buildRequest: (phone, sizeGb, networkKey, network, orderId) => ({
      "action": "create_order",
      "network": networkKey,
      "package_key": `${sizeGb}gb`,
      "recipient_phone": phone,
      ...(orderId && { "order_reference": orderId }),
    }),
    apiKeyEnvVar: "BOSSUDATA_API_KEY",
  },
  
  cledanet: {
    apiUrl: "https://backend.mycledanet.com/api/order",
    networkMap: {
      mtn: "MTN",
      telecel: "TELECEL",
      airteltigo: "AIRTELTIGO_ISHARE",
    },
    buildRequest: (phone, sizeGb, networkKey, network, orderId) => ({
      phone: phone,
      size: Number(sizeGb),
      network: networkKey,
      ...(orderId && { "order_reference": orderId }),
    }),
    apiKeyEnvVar: "CLEDANET_API_KEY",
  },
  
  spendless: {
    apiUrl: "https://spendless.top/api/purchase",
    networkMap: {
      mtn: "YELLO",
      telecel: "TELECEL",
      airteltigo: "AT_PREMIUM",
    },
    buildRequest: (phone, sizeGb, networkKey, network, orderId) => ({
      recipient: phone,
      capacity: Number(sizeGb),
      networkKey: networkKey,
      ...(orderId && { "order_reference": orderId }),
    }),
    apiKeyEnvVar: "********",
  },
  
  ghdataconnect: {
    apiUrl: "https://ghdataconnect.com/api/v1/purchaseBundle",
    networkMap: {
      mtn: "mtn",
      telecel: "telecel",
      airteltigo: "atishare",
    },
    buildRequest: (phone, sizeGb, networkKey, network, orderId) => ({
      "msisdn": phone,
      "capacity": Number(sizeGb),
      "network": networkKey,
      ...(orderId && { "reference": orderId }),
    }),
    apiKeyEnvVar: "GHDATACONNECT_API_KEY",
  },
  
  dakazina: {
    apiUrl: "https://reseller.dakazinabusinessconsult.com/api/v1/buy-data-package?",
    networkMap: {
      mtn_mashup: "mtn_mashup",
    },
    buildRequest: (phone, sizeGbText, networkKey, network, orderId) => ({
      "recipient_msisdn": phone,
      "shared_bundle": sizeGbText,
      "network_id": 7,
      ...(orderId && { "incoming_api_ref": orderId }),
    }),
    apiKeyEnvVar: "DAKAZINA_API_KEY",
  },

  datahubnet: {
    apiUrl: "https://www.datahubnet.online/api/v1/special-offers/",
    networkMap: {
      mashup: "mashup",
    },
    buildRequest: (phone, data_package_id, networkKey, network, orderId) => ({
      "phone_number": phone,
      "package_id": Number(data_package_id) || 0,
    }),
    apiKeyEnvVar: "DATAHUBNET_API_KEY",
  },
};

const NETWORK_TO_PROVIDER: Record<string, string> = {
  mtn: "ghdataconnect",
  telecel: "ghdataconnect",
  airteltigo: "ghdataconnect",
  mtn_mashup: "dakazina",
  mashup: "datahubnet",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const apiKeys: Record<string, string> = {};
    for (const [provider, config] of Object.entries(NETWORK_CONFIGS)) {
      const apiKey = Deno.env.get(config.apiKeyEnvVar);
      if (apiKey) {
        apiKeys[provider] = apiKey;
      } else {
        console.warn(`API key for ${provider} (${config.apiKeyEnvVar}) not configured`);
      }
    }

    if (Object.keys(apiKeys).length === 0) {
      return new Response(JSON.stringify({ error: "No API keys configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();
    const { order_id, data_package_id: requestDataPackageId } = body;

    console.log(`[FULFILL] ===== REQUEST RECEIVED =====`);
    console.log(`[FULFILL] order_id: ${order_id}`);
    console.log(`[FULFILL] data_package_id from request: ${requestDataPackageId}`);
    console.log(`[FULFILL] Full request body:`, JSON.stringify(body));

    if (!order_id) {
      return new Response(JSON.stringify({ error: "Missing order_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[FULFILL] Fetching order: ${order_id}`);

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      console.error(`[FULFILL] Order not found: ${order_id}`);
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[FULFILL] Order found:`, {
      status: order.fulfillment_status,
      network: order.network,
      size_gb: order.size_gb,
      metadata: order.metadata,
    });

    if (order.fulfillment_status === "completed") {
      console.log(`[FULFILL] Order already completed. Skipping.`);
      return new Response(JSON.stringify({ 
        success: false,
        message: "Order already completed"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[FULFILL] Locking order as processing...`);
    const { error: lockErr } = await supabase
      .from("orders")
      .update({ fulfillment_status: "processing" })
      .eq("id", order_id)
      .in("fulfillment_status", ["pending", "failed"]);

    if (lockErr) {
      console.error(`[FULFILL] Failed to lock order: ${lockErr.message}`);
      return new Response(JSON.stringify({ error: "Failed to lock order" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let phone = order.customer_number.replace(/[^0-9]/g, "");
    if (phone.startsWith("233")) {
      phone = "0" + phone.slice(3);
    }
    if (!phone.startsWith("0")) {
      phone = "0" + phone;
    }

    console.log(`[FULFILL] Cleaned phone: ${phone}`);

    const isFreeDataClaim = order.payment_method === "free_data_claim";
    
    if (isFreeDataClaim) {
      console.log(`[FULFILL] Processing FREE DATA CLAIM order`);
      
      let claimNetwork = order.network?.toLowerCase() || "mtn";
      
      if (!order.network || order.network === "") {
        if (phone.startsWith("024") || phone.startsWith("054") || phone.startsWith("025") || phone.startsWith("053") || phone.startsWith("055") || phone.startsWith("059")) {
          claimNetwork = "mtn";
        } else if (phone.startsWith("020") || phone.startsWith("050")) {
          claimNetwork = "telecel";
        } else if (phone.startsWith("026") || phone.startsWith("056") || phone.startsWith("057") || phone.startsWith("027")) {
          claimNetwork = "airteltigo";
        } else {
          claimNetwork = "mtn";
        }
        console.log(`[FULFILL] Network auto-detected: ${claimNetwork}`);
      }
      
      const provider = NETWORK_TO_PROVIDER[claimNetwork];
      if (!provider) {
        console.error(`[FULFILL] No provider for network: ${claimNetwork}`);
        await supabase
          .from("orders")
          .update({ 
            fulfillment_status: "failed", 
            api_response: `No provider for network: ${claimNetwork}`
          })
          .eq("id", order_id);
        
        return new Response(JSON.stringify({ error: `No provider for network: ${claimNetwork}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const config = NETWORK_CONFIGS[provider];
      const apiKey = apiKeys[provider];
      
      if (!apiKey) {
        console.error(`[FULFILL] No API key for provider: ${provider}`);
        await supabase
          .from("orders")
          .update({ 
            fulfillment_status: "failed", 
            api_response: `No API key for provider: ${provider}`
          })
          .eq("id", order_id);
        
        return new Response(JSON.stringify({ error: `No API key for provider: ${provider}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const networkKey = config.networkMap[claimNetwork] || claimNetwork.toUpperCase();
      console.log(`[FULFILL] Sending FREE DATA to ${provider}: phone=${phone}, size=${order.size_gb}GB, network=${networkKey}`);

      const requestBody = config.buildRequest(phone, order.size_gb, networkKey, claimNetwork, order_id);
      console.log(`[FULFILL] Request body:`, JSON.stringify(requestBody));
      
      const apiRes = await fetch(config.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "AUTHORIZATION": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      const apiData = await apiRes.text();
      console.log(`[FULFILL] API Response from ${provider}: ${apiRes.status} - ${apiData}`);

      let parsedData;
      try {
        parsedData = JSON.parse(apiData);
      } catch (e) {
        parsedData = null;
      }

      const isSuccess = apiRes.ok && (parsedData?.success !== false);

      if (isSuccess) {
        console.log(`[FULFILL] FREE DATA SUCCESS`);
        await supabase
          .from("orders")
          .update({ 
            fulfillment_status: "completed", 
            api_response: apiData, 
            network: claimNetwork,
          })
          .eq("id", order_id);

        return new Response(JSON.stringify({ 
          success: true, 
          message: "Free data claim fulfilled"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        const errorMsg = parsedData?.message || apiData;
        console.log(`[FULFILL] FREE DATA FAILED: ${errorMsg}`);
        
        await supabase
          .from("orders")
          .update({ 
            fulfillment_status: "failed", 
            api_response: apiData,
          })
          .eq("id", order_id);

        return new Response(JSON.stringify({ 
          success: false, 
          message: "Free data failed", 
          api_response: apiData
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log(`[FULFILL] Processing REGULAR PAID order`);
    
    const normalizedNetwork = order.network.toLowerCase();
    const provider = NETWORK_TO_PROVIDER[normalizedNetwork];
    
    if (!provider) {
      console.error(`[FULFILL] No provider for network: ${order.network}`);
      await supabase
        .from("orders")
        .update({ 
          fulfillment_status: "failed", 
          api_response: `No provider for network: ${order.network}`
        })
        .eq("id", order_id);
      
      return new Response(JSON.stringify({ error: `No provider for network: ${order.network}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = NETWORK_CONFIGS[provider];
    if (!config) {
      console.error(`[FULFILL] Invalid provider config: ${provider}`);
      await supabase
        .from("orders")
        .update({ 
          fulfillment_status: "failed", 
          api_response: `Invalid provider config: ${provider}`
        })
        .eq("id", order_id);
      
      return new Response(JSON.stringify({ error: `Invalid provider config: ${provider}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = apiKeys[provider];
    if (!apiKey) {
      console.error(`[FULFILL] No API key for provider: ${provider}`);
      await supabase
        .from("orders")
        .update({ 
          fulfillment_status: "failed", 
          api_response: `No API key for provider: ${provider}`
        })
        .eq("id", order_id);
      
      return new Response(JSON.stringify({ error: `No API key for provider: ${provider}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const networkKey = config.networkMap[normalizedNetwork] || normalizedNetwork.toUpperCase();
    
    // ===== CRITICAL: MASHUP HANDLING =====
    let requestBody;
    
    console.log(`[FULFILL] ===== MASHUP CHECK =====`);
    console.log(`[FULFILL] normalizedNetwork: ${normalizedNetwork}`);
    console.log(`[FULFILL] requestDataPackageId: ${requestDataPackageId}`);
    console.log(`[FULFILL] order.metadata: ${JSON.stringify(order.metadata)}`);
    
    if (normalizedNetwork === "mashup") {
      // Get data_package_id from request body OR from metadata
      let dataPackageId = requestDataPackageId;
      
      if (!dataPackageId && order.metadata?.data_package_id) {
        dataPackageId = order.metadata.data_package_id;
        console.log(`[FULFILL] Using data_package_id from metadata: ${dataPackageId}`);
      }
      
      console.log(`[FULFILL] ===== MASHUP API CALL =====`);
      console.log(`[FULFILL] phone: ${phone}`);
      console.log(`[FULFILL] data_package_id: ${dataPackageId}`);
      console.log(`[FULFILL] networkKey: ${networkKey}`);
      console.log(`[FULFILL] provider: ${provider}`);
      
      requestBody = config.buildRequest(phone, dataPackageId, networkKey, normalizedNetwork, order_id);
      
      console.log(`[FULFILL] ===== REQUEST BODY FOR DATAHUBNET =====`);
      console.log(`[FULFILL]`, JSON.stringify(requestBody, null, 2));
    } else {
      console.log(`[FULFILL] Non-mashup order: phone=${phone}, size=${order.size_gb}GB, network=${networkKey}`);
      requestBody = config.buildRequest(phone, order.size_gb, networkKey, normalizedNetwork, order_id);
      console.log(`[FULFILL] Request body:`, JSON.stringify(requestBody));
    }

    const apiRes = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "AUTHORIZATION": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const apiData = await apiRes.text();
    console.log(`[FULFILL] API Response from ${provider}: ${apiRes.status}`);
    console.log(`[FULFILL] Response body: ${apiData}`);

    let parsedData;
    try {
      parsedData = JSON.parse(apiData);
    } catch (e) {
      parsedData = null;
    }

    const isSuccess = apiRes.ok && (parsedData?.success !== false);

    if (isSuccess) {
      console.log(`[FULFILL] SUCCESS - Order completed`);

      const updatePayload: Record<string, any> = {
        fulfillment_status: "completed",
        api_response: apiData,
      };

      await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", order_id);

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Order fulfilled successfully"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const errorMsg = parsedData?.message || apiData;
      console.log(`[FULFILL] FAILED: ${errorMsg}`);
      
      await supabase
        .from("orders")
        .update({ 
          fulfillment_status: "failed", 
          api_response: apiData,
        })
        .eq("id", order_id);

      return new Response(JSON.stringify({ 
        success: false, 
        message: "Order fulfillment failed", 
        api_response: apiData
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (err) {
    console.error("[FULFILL] Fatal error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
