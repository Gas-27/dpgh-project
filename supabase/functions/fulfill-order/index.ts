import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NetworkConfig {
  apiUrl: string;
  networkMap: Record<string, string>;
  buildRequest: (phone: string, sizeOrId: any, networkKey: string, network: string, orderId?: string, bundleId?: any) => any;
  apiKeyEnvVar: string;
  authHeader?: "bearer" | "x-api-key" | "both";
}

// ===== MASHUP PACKAGE ID MAPPING (datahubnet) =====
const MASHUP_SIZE_TO_PACKAGE_ID: Record<string, number> = {
  "1.7": 14,
  "5.1": 3,
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
  "1077": 16,
  "1485": 20,
};

function getMashupPackageId(sizeGbText?: string, sizeGb?: number): number | undefined {
  if (sizeGbText) {
    const t = sizeGbText.toLowerCase().trim();
    if (t.includes("1.7"))  return MASHUP_SIZE_TO_PACKAGE_ID["1.7"];
    if (t.includes("5.1"))  return MASHUP_SIZE_TO_PACKAGE_ID["5.1"];
    if (t.includes("2.6"))  return MASHUP_SIZE_TO_PACKAGE_ID["2.6"];
    if (t.includes("8.2"))  return MASHUP_SIZE_TO_PACKAGE_ID["8.2"];
    if (t.includes("11.9")) return MASHUP_SIZE_TO_PACKAGE_ID["11.9"];
    if (t.includes("3.61")) return MASHUP_SIZE_TO_PACKAGE_ID["3.61"];
    if (t.includes("15.3")) return MASHUP_SIZE_TO_PACKAGE_ID["15.3"];
    if (t.includes("1077")) return MASHUP_SIZE_TO_PACKAGE_ID["1077"];
    if (t.includes("1485")) return MASHUP_SIZE_TO_PACKAGE_ID["1485"];
    // Try exact key match
    const exact = MASHUP_SIZE_TO_PACKAGE_ID[sizeGbText.trim()];
    if (exact) return exact;
  }
  if (sizeGb !== undefined) {
    const rounded = sizeGb.toFixed(1);
    return MASHUP_SIZE_TO_PACKAGE_ID[rounded] ?? MASHUP_SIZE_TO_PACKAGE_ID[String(sizeGb)];
  }
  return undefined;
}

// ===== PROVIDER CONFIGS =====
const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
  // Dakazina handles: mtn, telecel, at_ishare, mtn_mashup
  dakazina: {
    apiUrl: "https://reseller.dakazinabusinessconsult.com/api/v1/buy-data-package",
    networkMap: {
      mtn:        "mtn",
      telecel:    "telecel",
      airteltigo: "at_ishare",
      mtn_mashup: "mtn_mashup",
    },
    buildRequest: (phone, sizeOrId, networkKey, network, orderId) => {
      const networkIdMap: Record<string, number> = {
        mtn:        6,
        telecel:    2,
        at_ishare:  1,
        airteltigo: 1,
        mtn_mashup: 7,
      };
      return {
        recipient_msisdn: phone,
        shared_bundle:    sizeOrId,
        network_id:       networkIdMap[networkKey] ?? networkIdMap[network] ?? 6,
        ...(orderId ? { incoming_api_ref: orderId } : {}),
      };
    },
    apiKeyEnvVar: "DAKAZINA_API_KEY",
    authHeader: "bearer",
  },

  // Datahubnet handles: mashup (Special MTN Mashup packages)
  datahubnet: {
    apiUrl: "https://www.datahubnet.online/api/v1/special-offers/",
    networkMap: {
      mashup: "mashup",
    },
    buildRequest: (phone, packageId) => ({
      phone_number: phone,
      package_id:   Number(packageId) || 0,
    }),
    apiKeyEnvVar: "DATAHUBNET_API_KEY",
    authHeader: "bearer",
  },

  // Orisjay handles: telecel, airteltigo, atbigtime (fallback)
  orisjay: {
    apiUrl: "https://orisjay.store/api/process-order.php",
    networkMap: {
      telecel:    "telecel",
      airteltigo: "ishare",
      atbigtime:  "bigtime",
    },
    buildRequest: (phone, sizeGb, networkKey, network, orderId, bundleId) => ({
      phone:      phone,
      bundle_id:  bundleId,
      network:    networkKey,
      ...(orderId ? { external_reference: orderId } : {}),
    }),
    apiKeyEnvVar: "ORISJAY_API_KEY",
    authHeader: "both",
  },

  // GHDataConnect handles: atbigtime
  ghdataconnect: {
    apiUrl: "https://ghdataconnect.com/api/v1/purchaseBundle",
    networkMap: {
      atbigtime: "atbigtime",
    },
    buildRequest: (phone, sizeGb, networkKey, network, orderId) => ({
      msisdn:   phone,
      capacity: Number(sizeGb),
      network:  networkKey,
      ...(orderId ? { reference: orderId } : {}),
    }),
    apiKeyEnvVar: "GHDATACONNECT_API_KEY",
    authHeader: "bearer",
  },
};

// ===== NETWORK → PROVIDER ROUTING =====
// Order matters: more specific entries first
const NETWORK_TO_PROVIDER: Record<string, string> = {
  mtn:        "dakazina",
  telecel:    "dakazina",
  airteltigo: "dakazina",
  mtn_mashup: "dakazina",
  mashup:     "datahubnet",
  atbigtime:  "ghdataconnect",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase       = createClient(supabaseUrl, serviceRoleKey);

    const { order_id, paystack_reference } = await req.json();

    if (!order_id) {
      return new Response(JSON.stringify({ error: "Missing order_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[FULFILL] Starting fulfillment for order_id: ${order_id}`);

    // ─── Fetch order ────────────────────────────────────────────────────────
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

    console.log(`[FULFILL] Order found - fulfillment_status=${order.fulfillment_status}, network=${order.network}, size_gb=${order.size_gb}`);

    // ─── Prevent double-fulfillment ─────────────────────────────────────────
    if (order.fulfillment_status === "completed") {
      console.log(`[FULFILL] Order ${order_id} already completed. Skipping.`);
      return new Response(JSON.stringify({ success: true, message: "Already fulfilled", skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Duplicate paystack_reference check ─────────────────────────────────
    if (paystack_reference) {
      const { data: dupes } = await supabase
        .from("orders")
        .select("id")
        .eq("paystack_reference", paystack_reference)
        .eq("fulfillment_status", "completed")
        .neq("id", order_id);

      if (dupes && dupes.length > 0) {
        console.log(`[FULFILL] Duplicate detected for ${paystack_reference} - marking as duplicate`);
        await supabase
          .from("orders")
          .update({ fulfillment_status: "duplicate", status: "duplicate", api_response: `Duplicate of order ${dupes[0].id}` })
          .eq("id", order_id);
        return new Response(JSON.stringify({ success: false, message: "Duplicate order", skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ─── Lock order as processing ────────────────────────────────────────────
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

    // ─── Clean phone number ─────��────────────────────────────────────────────
    let phone = order.customer_number.replace(/[^0-9]/g, "");
    if (phone.startsWith("233")) phone = "0" + phone.slice(3);
    if (!phone.startsWith("0"))  phone = "0" + phone;

    if (phone.length !== 10) {
      await supabase.from("orders").update({ fulfillment_status: "failed", api_response: "Invalid phone number format" }).eq("id", order_id);
      return new Response(JSON.stringify({ success: false, error: "Invalid phone number" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[FULFILL] phone=${phone}, network=${order.network}, size_gb=${order.size_gb}`);

    // ─── Fetch bundle_id from data_packages (used by orisjay) ───────────────
    let bundleId: any = null;
    if (order.package_id) {
      const { data: pkg } = await supabase
        .from("data_packages")
        .select("bundle_id, data_package_id, size_gb_text")
        .eq("id", order.package_id)
        .single();
      if (pkg) {
        bundleId = pkg.bundle_id;
        if (!order.size_gb_text && pkg.size_gb_text) order.size_gb_text = pkg.size_gb_text;
        if (!order.data_package_id && pkg.data_package_id) order.data_package_id = pkg.data_package_id;
        console.log(`[FULFILL] Package data: bundle_id=${bundleId}, data_package_id=${pkg.data_package_id}`);
      }
    }

    // ─── Determine provider ──────────────────────────────────────────────────
    const normalizedNetwork = (order.network ?? "").toLowerCase().trim();
    const fallbackProvider = NETWORK_TO_PROVIDER[normalizedNetwork];
    const { data: mappedProvider, error: routeError } = await supabase.rpc("get_network_provider_route", { p_network_key: normalizedNetwork, p_flow: "fulfillment" });
    if (routeError) console.warn(`[FULFILL] Route lookup failed, using fallback: ${routeError.message}`);
    const provider = mappedProvider || fallbackProvider;

    if (!provider) {
      console.error(`[FULFILL] No provider for network: ${order.network}`);
      await supabase.from("orders").update({ fulfillment_status: "failed", api_response: `No provider for network: ${order.network}` }).eq("id", order_id);
      return new Response(JSON.stringify({ error: `No provider for network: ${order.network}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = NETWORK_CONFIGS[provider];
    const apiKey = Deno.env.get(config.apiKeyEnvVar);

    if (!apiKey) {
      console.error(`[FULFILL] API key missing for ${provider} (${config.apiKeyEnvVar})`);
      await supabase.from("orders").update({ fulfillment_status: "failed", api_response: `No API key for provider: ${provider}` }).eq("id", order_id);
      return new Response(JSON.stringify({ error: `No API key for provider: ${provider}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const networkKey = config.networkMap[normalizedNetwork] ?? normalizedNetwork;

    // ─── Build request body ──────────────────────────────────────────────────
    let requestBody: Record<string, any>;

    if (provider === "datahubnet" || normalizedNetwork === "mashup") {
      // Datahubnet needs a numeric package_id
      let packageId = order.data_package_id ?? getMashupPackageId(order.size_gb_text, Number(order.size_gb));
      console.log(`[FULFILL] Mashup → datahubnet package_id=${packageId} (size_gb_text="${order.size_gb_text}", size_gb=${order.size_gb})`);
      if (!packageId) {
        await supabase.from("orders").update({ fulfillment_status: "failed", api_response: `Cannot map mashup package: size_gb_text="${order.size_gb_text}", size_gb=${order.size_gb}` }).eq("id", order_id);
        return new Response(JSON.stringify({ error: "Unable to map mashup package" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      requestBody = config.buildRequest(phone, packageId, networkKey, normalizedNetwork, order_id, bundleId);

    } else if (provider === "dakazina") {
      // Dakazina needs: recipient_msisdn, shared_bundle (size as string), network_id, incoming_api_ref (our order UUID)
      // For mtn_mashup the shared_bundle is the size_gb_text (e.g. "2.6 GB + 1,077 mins")
      // For regular networks it is the numeric GB value as a string
      const sharedBundle = (normalizedNetwork === "mtn_mashup" && order.size_gb_text)
        ? order.size_gb_text
        : String(order.size_gb);
      console.log(`[FULFILL] Dakazina → network=${networkKey}, shared_bundle="${sharedBundle}", incoming_api_ref=${order_id}`);
      requestBody = config.buildRequest(phone, sharedBundle, networkKey, normalizedNetwork, order_id, bundleId);

    } else {
      requestBody = config.buildRequest(phone, order.size_gb, networkKey, normalizedNetwork, order_id, bundleId);
    }

    console.log(`[FULFILL] Sending to ${provider} (${config.apiUrl}):`, JSON.stringify(requestBody));

    // ─── Build headers ───────────────────────────────────────────────────────
    const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (config.authHeader === "bearer" || config.authHeader === "both") {
      reqHeaders["Authorization"] = `Bearer ${apiKey}`;
    }
    if (config.authHeader === "x-api-key" || config.authHeader === "both") {
      reqHeaders["X-API-Key"] = apiKey;
    }
    // Default: send both for maximum compatibility
    if (!config.authHeader) {
      reqHeaders["Authorization"] = `Bearer ${apiKey}`;
      reqHeaders["X-API-Key"]     = apiKey;
    }

    // ─── Call provider API ───────────────────────────────────────────────────
    const apiRes  = await fetch(config.apiUrl, { method: "POST", headers: reqHeaders, body: JSON.stringify(requestBody) });
    const rawText = await apiRes.text();

    let parsed: any = null;
    try { parsed = JSON.parse(rawText); } catch { /* keep null */ }

    console.log(`[FULFILL] ${provider} response: HTTP ${apiRes.status} - ${rawText.slice(0, 400)}`);

    // ─── Determine success ───────────────────────────────────────────────────
    // Dakazina returns: { "status": "success", "data": { ... } }  OR  { "success": true, ... }
    const isSuccess =
      apiRes.status >= 200 &&
      apiRes.status < 300 &&
      (
        parsed?.status  === "success"  ||
        parsed?.success === true       ||
        // Dakazina sometimes returns { "message": "Package purchased successfully." }
        (typeof parsed?.message === "string" && parsed.message.toLowerCase().includes("purchased successfully"))
      );

    if (isSuccess) {
      console.log(`[FULFILL] SUCCESS for order ${order_id}`);

      // Extract any reference Dakazina returns
      const dakazinaOrderCode =
        parsed?.data?.order_code     ??
        parsed?.data?.code           ??
        parsed?.data?.reference      ??
        parsed?.order_code           ??
        parsed?.reference            ??
        parsed?.transaction_code     ??
        parsed?.data?.transaction_code ??
        null;

      console.log(`[FULFILL] Dakazina order_code from response: ${dakazinaOrderCode}`);

      // Build update — provider_reference = dakazina order code (if any)
      // provider_order_id = also store order code for webhook matching
      // order_status stays "processing" — Dakazina webhook will update to "delivered"
      const updatePayload: Record<string, any> = {
        // Provider acceptance is not delivery. Keep the order active until
        // the provider webhook/status sync confirms delivery.
        fulfillment_status: "processing",
        api_response:       rawText,
        order_status:       "processing",
      };

      if (dakazinaOrderCode) {
        updatePayload.provider_reference = dakazinaOrderCode;
        updatePayload.provider_order_id  = dakazinaOrderCode;
      }

      const { error: updateErr } = await supabase.from("orders").update(updatePayload).eq("id", order_id);

      if (updateErr) {
        console.error(`[FULFILL] DB update error: ${updateErr.message}`);
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[FULFILL] Order ${order_id} marked as fulfilled. dakazina_code=${dakazinaOrderCode}`);
      return new Response(JSON.stringify({
        success: true,
        message: "Order fulfilled successfully",
        dakazina_order_code: dakazinaOrderCode,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else {
      // ─── Failure ───────────────────────────────────────────────────────────
      const errorMsg = parsed?.message ?? parsed?.error ?? `HTTP ${apiRes.status}: ${rawText.slice(0, 200)}`;
      console.log(`[FULFILL] FAILED order ${order_id}: ${errorMsg}`);

      const isLowBalance   = errorMsg.toLowerCase().includes("low balance") || errorMsg.toLowerCase().includes("insufficient");
      const isCapacityIssue = errorMsg.toLowerCase().includes("capacity not available") || errorMsg.toLowerCase().includes("bundle not available");

      if (isLowBalance)    console.warn(`[FULFILL] LOW BALANCE on ${provider}`);
      if (isCapacityIssue) console.warn(`[FULFILL] CAPACITY ISSUE on ${provider}`);

      const isMtnRoute = ["mtn", "mtn_express"].includes(normalizedNetwork);
      const beneficiaryFailure = isMtnRoute && /beneficiar|whitelist|portal list|not.*list|not.*added/i.test(String(errorMsg));
      const failureUpdate: Record<string, unknown> = {
        fulfillment_status: beneficiaryFailure ? "refunded" : "failed",
        order_status: beneficiaryFailure ? "refunded" : "failed",
        api_response: rawText,
      };
      if (beneficiaryFailure) {
        failureUpdate.mtn_beneficiary_status = "pending";
        failureUpdate.mtn_failure_reason = "MTN requires the number to be approved on our beneficiary list before delivery.";
        failureUpdate.mtn_beneficiary_submitted_at = new Date().toISOString();
        failureUpdate.mtn_retry_eligible_at = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString();
      }
      await supabase.from("orders").update(failureUpdate).eq("id", order_id);

      // Log to api_error_logs for admin visibility
      try {
        await supabase.from("api_error_logs").insert({
          order_id:         order_id,
          customer_number:  order.customer_number,
          network:          order.network,
          size_gb:          order.size_gb,
          amount:           order.amount,
          error_type:       "DATA_ORDER_FULFILLMENT_FAILED",
          error_message:    errorMsg,
          api_endpoint:     config.apiUrl,
          http_status_code: apiRes.status,
          request_payload:  requestBody,
          response_payload: parsed ?? { raw: rawText.slice(0, 500) },
        });
      } catch (logErr) {
        console.error(`[FULFILL] Failed to write api_error_logs: ${logErr}`);
      }

      return new Response(JSON.stringify({ success: false, message: "Fulfillment failed", api_response: errorMsg }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (err) {
    console.error("[FULFILL] Unhandled exception:", err);
    return new Response(JSON.stringify({ error: "Internal server error", details: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
