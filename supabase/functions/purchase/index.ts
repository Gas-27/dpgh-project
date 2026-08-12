// supabase/functions/purchase/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ===== NETWORK CONFIGURATIONS =====
interface NetworkConfig {
  apiUrl: string;
  networkMap: Record<string, string>;
  buildRequest: (phone: string, sizeGb: number, networkKey: string, network: string, orderId?: string,bundle_id?: number) => any;
  apiKeyEnvVar: string;
}

// ===== HARDCODED MASHUP PACKAGE ID MAPPING =====
const MASHUP_SIZE_TO_PACKAGE_ID: Record<string, number> = {
  "1.7": 14,
  "5.1": 3,
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
  "1077": 16,
  "1485": 20,
};

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
      atbigtime: "AIRTELTIGO_BIGTIME",
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
    apiKeyEnvVar: ********,
  },

 ghdataconnect: {
    apiUrl: "https://ghdataconnect.com/api/v1/purchaseBundle",
    networkMap: {
      mtn: "mtn",
      mtn_express:"mtn",
      telecel: "telecel",
      airteltigo: "atishare",
      atbigtime: "atbigtime"
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
    buildRequest: (phone, sizeGbText, networkKey, network, orderId) => {
      const networkIdMap = {
        'mtn': 3,
        'telecel': 2,
        'at_ishare': 1,
        'mtn_mashup': 7
      };

      return {
        "recipient_msisdn": phone,
        "shared_bundle": sizeGbText,
        "network_id": networkIdMap[network] || networkIdMap[networkKey] || 3,
        ...(orderId && { "incoming_api_ref": orderId })
      };
    },
    apiKeyEnvVar: ********
  },

  datahubnet: {
    apiUrl: "https://www.datahubnet.online/api/v1/special-offers/",
    networkMap: {
      mashup: "mashup",
    },
    buildRequest: (phone, sizeGb, networkKey, network, orderId) => ({
      "phone_number": phone,
      "package_id": Number(sizeGb) || 0,
    }),
    apiKeyEnvVar: "DATAHUBNET_API_KEY",
  },

  orisjay: {
    apiUrl: "https://orisjay.store/api/process-order.php",
    networkMap: {
      mtn: "mtn",
      telecel: "telecel",
      airteltigo: "ishare",
      atbigtime: "bigtime",
    },
    buildRequest: (phone, sizeGb, networkKey, network, orderId, bundle_id) => ({
      "phone": phone,
      "bundle_id": bundle_id,
      "network": networkKey,
      ...(orderId && { "external_reference": orderId }),
    }),
    apiKeyEnvVar: ********,
  },

};

const NETWORK_TO_PROVIDER: Record<string, string> = {
  mtn: "dakazina",
  mtn_express:"ghdataconnect",
  telecel: "ghdataconnect",
  airteltigo:"ghdataconnect",
  atbigtime:" ghdataconnect",
  mtn_mashup: "dakazina",
  mashup: "datahubnet",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log(`[PURCHASE] ========== NEW REQUEST ==========`);

    // ============================================
    // STEP 1: Validate API Key
    // ============================================
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header. Use: Bearer YOUR_API_KEY" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = authHeader.replace("Bearer ", "").trim();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Get API user
    const { data: apiUser, error: userError } = await supabase
      .from("api_users")
      .select("id, wallet, custom_price, active")
      .eq("api_key", apiKey)
      .single();

    if (userError || !apiUser) {
      console.error("[PURCHASE] Invalid API key:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!apiUser.active) {
      return new Response(
        JSON.stringify({ error: "API key is inactive" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[PURCHASE] API User: ${apiUser.id}, Wallet: ${apiUser.wallet}`);

    // ============================================
    // STEP 2: Parse Request Body
    // ============================================
    const body = await req.json();
    console.log(`[PURCHASE] Request body:`, JSON.stringify(body));

    const { network, size_gb, size_gb_text, phone } = body;

    // Validate required fields
    if (!network) {
      return new Response(
        JSON.stringify({ error: "Missing network" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!size_gb) {
      return new Response(
        JSON.stringify({ error: "Missing size_gb" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!phone) {
      return new Response(
        JSON.stringify({ error: "Missing phone" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate network
    const validNetworks = ["mtn", "telecel", "airteltigo", "mtn_mashup", "mashup"];
    if (!validNetworks.includes(network)) {
      return new Response(
        JSON.stringify({ error: "Invalid network. Must be: mtn, telecel, airteltigo, mtn_mashup, mashup" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate phone number
    let cleanedPhone = phone.replace(/[^0-9]/g, "");
    if (cleanedPhone.startsWith("233")) {
      cleanedPhone = "0" + cleanedPhone.slice(3);
    }
    if (!cleanedPhone.startsWith("0")) {
      cleanedPhone = "0" + cleanedPhone;
    }
    if (!cleanedPhone.match(/^0[2-9]\d{8}$/)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number format. Expected: 024XXXXXXX" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For mashup packages, validate size_gb_text
    if ((network === "mashup" || network === "mtn_mashup") && !size_gb_text) {
      return new Response(
        JSON.stringify({ error: "size_gb_text is required for mashup and mtn_mashup networks" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[PURCHASE] Validated: network=${network}, size_gb=${size_gb}, phone=${cleanedPhone}`);

    // ============================================
    // STEP 3: Fetch Package from Database
    // ============================================
    let packageQuery = supabase
      .from("data_packages")
      .select("id, network, size_gb, size_gb_text, api_price")
      .eq("network", network)
      .eq("size_gb", size_gb)
      .eq("active", true);

    // For mashup networks, also match size_gb_text
    if (network === "mashup" || network === "mtn_mashup") {
      packageQuery = packageQuery.eq("size_gb_text", size_gb_text);
    }

    const { data: packageData, error: packageError } = await packageQuery.single();

    if (packageError || !packageData) {
      console.error("[PURCHASE] Package not found:", packageError);
      return new Response(
        JSON.stringify({ error: "Package not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[PURCHASE] Package found: ${packageData.id}, api_price: ${packageData.api_price}`);


    // ============================================
    // STEP 3.5: FETCH BUNDLE_ID FROM PACKAGE
    // ============================================
    let bundleId = null;

    if (packageData.id) {
      const { data: packageBundle, error: bundleError } = await supabase
        .from("data_packages")
        .select("bundle_id")
        .eq("id", packageData.id)
        .single();

      if (!bundleError && packageBundle) {
        bundleId = packageBundle.bundle_id;
        console.log(`[PURCHASE] Bundle ID fetched: ${bundleId}`);
      } else {
        console.warn(`[PURCHASE] No bundle_id found for package: ${packageData.id}`);
      }
    }


    // ============================================
    // STEP 4: Determine Final Price
    // ============================================
    let finalPrice = Number(packageData.api_price);

    // Check if user has custom prices enabled
    if (apiUser.custom_price) {
      const { data: customPrice, error: customError } = await supabase
        .from("api_user_package_prices")
        .select("custom_price")
        .eq("api_user_id", apiUser.id)
        .eq("package_id", packageData.id)
        .maybeSingle();

      if (customError) {
        console.error("[PURCHASE] Custom price fetch error:", customError);
      } else if (customPrice) {
        finalPrice = Number(customPrice.custom_price);
        console.log(`[PURCHASE] Using custom price: ${finalPrice}`);
      } else {
        console.log(`[PURCHASE] No custom price found, using api_price: ${finalPrice}`);
      }
    } else {
      console.log(`[PURCHASE] User has no custom prices, using api_price: ${finalPrice}`);
    }

    // ============================================
    // STEP 5: Check Wallet Balance
    // ============================================
    const walletBalance = Number(apiUser.wallet) || 0;

    if (walletBalance < finalPrice) {
      return new Response(
        JSON.stringify({
          error: "Insufficient wallet balance",
          wallet_balance: walletBalance,
          required: finalPrice,
          deficit: (finalPrice - walletBalance).toFixed(2)
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[PURCHASE] Wallet balance: ${walletBalance}, Final price: ${finalPrice}`);

    // ============================================
    // STEP 6: Determine Provider
    // ============================================
    const normalizedNetwork = network.toLowerCase();
    const provider = NETWORK_TO_PROVIDER[normalizedNetwork];

    if (!provider) {
      return new Response(
        JSON.stringify({ error: `No provider configured for network: ${network}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = NETWORK_CONFIGS[provider];
    if (!config) {
      return new Response(
        JSON.stringify({ error: `Provider configuration not found: ${provider}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKeyForProvider = Deno.env.get(config.apiKeyEnvVar);
    if (!apiKeyForProvider) {
      console.error(`[PURCHASE] API key for ${provider} (${config.apiKeyEnvVar}) not configured`);
      return new Response(
        JSON.stringify({ error: `Provider API key not configured` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const networkKey = config.networkMap[normalizedNetwork] || normalizedNetwork.toUpperCase();
    console.log(`[PURCHASE] Provider: ${provider}, Network Key: ${networkKey}`);

    // ============================================
    // STEP 7: Prepare Order Reference
    // ============================================
    const orderReference = `API_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // ============================================
    // STEP 8: Build API Request
    // ============================================
    let requestBody;
    let dataPackageId = null;

    // Handle mashup packages
    if (normalizedNetwork === "mashup") {
      if (size_gb_text) {
        dataPackageId = MASHUP_SIZE_TO_PACKAGE_ID[size_gb_text];

        if (!dataPackageId) {
          if (size_gb_text.includes("2.6")) dataPackageId = 16;
          else if (size_gb_text.includes("3.61")) dataPackageId = 20;
          else if (size_gb_text.includes("1.7")) dataPackageId = 14;
          else if (size_gb_text.includes("5.1")) dataPackageId = 3;
          else if (size_gb_text.includes("8.2")) dataPackageId = 17;
          else if (size_gb_text.includes("11.9")) dataPackageId = 18;
          else if (size_gb_text.includes("15.3")) dataPackageId = 19;
        }
      }

      if (!dataPackageId) {
        const sizeStr = String(size_gb);
        dataPackageId = MASHUP_SIZE_TO_PACKAGE_ID[sizeStr];
      }

      if (!dataPackageId) {
        return new Response(
          JSON.stringify({ error: `Unable to map mashup package: size_gb_text="${size_gb_text}", size_gb=${size_gb}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      requestBody = config.buildRequest(cleanedPhone, size_gb, networkKey, normalizedNetwork, orderReference, bundleId);
      console.log(`[PURCHASE] MASHUP mapped to package_id: ${dataPackageId}`);
    } else if (normalizedNetwork === "mtn_mashup") {
      requestBody = config.buildRequest(cleanedPhone, size_gb_text || size_gb, networkKey, normalizedNetwork, orderReference);
    } else {
      requestBody = config.buildRequest(cleanedPhone, size_gb, networkKey, normalizedNetwork, orderReference, bundleId);
    }

    console.log(`[PURCHASE] Sending to ${provider}:`, JSON.stringify(requestBody));

    // ============================================
    // STEP 9: Call Provider API
    // ============================================
    let apiRes;
    let apiData;
    let parsedData;

    try {
      apiRes = await fetch(config.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKeyForProvider,
          "AUTHORIZATION": `Bearer ${apiKeyForProvider}`,
        },
        body: JSON.stringify(requestBody),
      });

      apiData = await apiRes.text();
      console.log(`[PURCHASE] API Response from ${provider}: ${apiRes.status} - ${apiData}`);

      try {
        parsedData = JSON.parse(apiData);
      } catch (e) {
        parsedData = null;
      }
    } catch (err) {
      console.error(`[PURCHASE] API call failed:`, err);
      return new Response(
        JSON.stringify({ error: "Provider API request failed", details: (err as Error).message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================
    // STEP 10: Determine Success
    // ============================================
    const isSuccess = apiRes.ok && (parsedData?.success !== false);
    const providerReference = parsedData?.reference || parsedData?.data?.reference || null;

    // ============================================
    // STEP 11: Atomic Transaction - Create Order & Deduct Wallet
    // ============================================
    // A successful provider API response means the order was accepted,
    // not that the bundle has reached the customer. The provider webhook or
    // status-sync worker must be the only code that changes this to delivered.
    const orderStatus = isSuccess ? "processing" : "failed";
    const fulfillmentStatus = isSuccess ? "processing" : "failed";

    // Start a transaction
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_number: cleanedPhone,
        network: normalizedNetwork,
        size_gb: size_gb,
        size_gb_text: size_gb_text || null,
        package_id: packageData.id,
        amount: finalPrice,
        order_status: orderStatus,
        fulfillment_status: fulfillmentStatus,
        payment_method: "api_wallet",
        paystack_reference: null,
        provider_reference: providerReference,
        api_response: apiData,
        api_user: apiUser.id,  // <-- ADDED: Link order to API user
        agent_store_id: null,
        subagent_store_id: null,
        selling_price: finalPrice,
        base_price: finalPrice,
        profit: 0,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (orderError) {
      console.error(`[PURCHASE] Failed to create order:`, orderError);
      return new Response(
        JSON.stringify({ error: "Failed to create order record" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const orderId = order.id;
    console.log(`[PURCHASE] Order created: ${orderId}, Status: ${orderStatus}, API User: ${apiUser.id}`);

    // ============================================
    // STEP 12: Deduct from Wallet (only if successful)
    // ============================================
    if (isSuccess) {
      const newBalance = walletBalance - finalPrice;

      const { error: walletError } = await supabase
        .from("api_users")
        .update({ wallet: newBalance })
        .eq("id", apiUser.id);

      if (walletError) {
        console.error(`[PURCHASE] Failed to update wallet:`, walletError);
        // CRITICAL: Order succeeded but wallet update failed
        // Mark order as failed and flag for admin review
        await supabase
          .from("orders")
          .update({
            order_status: "failed",
            fulfillment_status: "failed",
            admin_notes: "Wallet deduction failed after successful provider order. Needs manual review."
          })
          .eq("id", orderId);

        return new Response(
          JSON.stringify({
            error: "Payment succeeded but wallet update failed. Please contact support.",
            order_id: orderId,
            provider_reference: providerReference
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[PURCHASE] Wallet deducted: ${finalPrice}, New balance: ${newBalance}`);
    }

    // ============================================
    // STEP 13: Return Response
    // ============================================
    if (isSuccess) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Purchase successful",
          data: {
            order_id: orderId,
            provider_reference: providerReference,
            network: normalizedNetwork,
            size_gb: size_gb,
            size_gb_text: size_gb_text || null,
            phone: cleanedPhone,
            amount: finalPrice,
            wallet_balance: walletBalance - finalPrice,
            status: "completed",
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const errorMsg = parsedData?.message || parsedData?.error || apiData || "Provider API failed";

      return new Response(
        JSON.stringify({
          success: false,
          error: "Purchase failed",
          message: errorMsg,
          data: {
            order_id: orderId,
            network: normalizedNetwork,
            size_gb: size_gb,
            size_gb_text: size_gb_text || null,
            phone: cleanedPhone,
            amount: finalPrice,
            wallet_balance: walletBalance, // Not deducted
            status: "failed",
            api_response: apiData,
          }
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (err) {
    console.error("[PURCHASE] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
