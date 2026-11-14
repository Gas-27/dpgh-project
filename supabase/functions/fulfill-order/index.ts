import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NetworkConfig {
  apiUrl: string;
  networkMap: Record<string, string>;
  buildRequest: (phone: string, bundle_id: number, sizeGb: number, networkKey: string, sizeGbText: string, network: string, orderId?: string) => any;
  apiKeyEnvVar: string;
}

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

const FASTDEALSGH_PLAN_ID_MAP: Record<string, number> = {
  "mtn:1": 14, "mtn:2": 15, "mtn:3": 16, "mtn:4": 17, "mtn:5": 18,
  "mtn:6": 19, "mtn:8": 20, "mtn:10": 21, "mtn:15": 22, "mtn:20": 23,
  "mtn:25": 24, "mtn:30": 25, "mtn:40": 26, "mtn:50": 27,

  "telecel:10": 28, "telecel:15": 29, "telecel:20": 30, "telecel:25": 31,
  "telecel:30": 32, "telecel:40": 33, "telecel:50": 34,

  "airteltigo:1": 35, "airteltigo:2": 36, "airteltigo:3": 37, "airteltigo:4": 38,
  "airteltigo:5": 39, "airteltigo:6": 40, "airteltigo:7": 41, "airteltigo:8": 42,
  "airteltigo:10": 43,

  "atbigtime:10": 44, "atbigtime:20": 45, "atbigtime:30": 46,
  "atbigtime:40": 47, "atbigtime:50": 48, "atbigtime:100": 49,
};

const ORISJAY_BUNDLE_ID_MAP: Record<string, number> = {
  "mtn:1": 16, "mtn:2": 17, "mtn:3": 18, "mtn:4": 19, "mtn:5": 20,
  "mtn:6": 21, "mtn:7": 22, "mtn:8": 23, "mtn:10": 24, "mtn:12": 25,
  "mtn:15": 26, "mtn:20": 27, "mtn:25": 28, "mtn:30": 29, "mtn:40": 30,
  "mtn:50": 31,

  "telecel:10": 71, "telecel:15": 72, "telecel:20": 73, "telecel:25": 74,
  "telecel:30": 75, "telecel:40": 76, "telecel:50": 77,
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
    apiKeyEnvVar: "SPENDLESS_API_KEY",
  },

  ghdataconnect: {
    apiUrl: "https://ghdataconnect.com/api/v1/purchaseBundle",
    networkMap: {
      mtn: "mtn",
      mtn_express: "mtn",
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
        'mtn': 3,  //mtn expreee 6 mtn 3 
        'mtn_express': 6,
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
    apiKeyEnvVar: "DAKAZINA_API_KEY"
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
  refer2bundle: {
    apiUrl: "https://www.refer2bundle.com/api/v1/order",
    networkMap: {
      mtn: "MTN",
      telecel: "TELECEL",
      airteltigo: "AT",
    },
    buildRequest: (phone, sizeGb, networkKey, network, orderId) => ({
      "network": networkKey,
      "data_plan": `${sizeGb}GB`,
      "beneficiary": phone,
    }),
    apiKeyEnvVar: "REFER2BUNDLE_API_KEY",
  },

  datamart: {
    apiUrl: "https://api.datamartgh.shop/api/purchase",
    networkMap: {
      mtn: "YELLO",
      telecel: "TELECEL",
      airteltigo: "AT_PREMIUM",
      atbigtime: "atbigtime"
    },
    buildRequest: (phone, sizeGb, networkKey, network, orderId) => ({
      "phoneNumber": phone,
      "capacity": Number(sizeGb),
      "network": networkKey,
      "gateway": "wallet",
      ...(orderId && { "reference": orderId }),
    }),
    apiKeyEnvVar: "DATAMART_API_KEY",
  },

  // ===== NEW: DataMart MTN MashUp =====
  // Provider key is "datamart_mashup" (so it doesn't clash with the regular
  // "datamart" provider above), but the ORDER network stays "mashup".
  // comboCost is read from data_packages.bundle_id (passed in as bundle_id).
  datamart_mashup: {
    apiUrl: "https://api.datamartgh.shop/api/developer/mashup/purchase",
    networkMap: {
      mashup: "MTN_COMBO",
    },
    buildRequest: (phone, sizeGb, networkKey, network, orderId, bundle_id) => {
      const comboCost = Number(bundle_id) || 0;
      if (!comboCost) {
        console.warn(`[DATAMART-MASHUP] No comboCost (bundle_id) for ${network}:${sizeGb} — provider will reject with UNKNOWN_PACKAGE`);
      }
      return {
        "phoneNumber": phone,
        "comboCost": comboCost,
        ...(orderId && { "ref": orderId }),
      };
    },
    apiKeyEnvVar: "DATAMART_API_KEY",
  },
  // ===== END NEW =====

  datahubgh: {
    apiUrl: "https://app.datahubgh.com/api/external/data-purchase",
    networkMap: {
      mtn: "YELLO",
      mtn_xpress: "YELLO",
      telecel: "TELECEL",
      airteltigo: "AT_PREMIUM",
      atbigtime: "AT_BIGTIME",
    },
    buildRequest: (phone, sizeGb, networkKey, network, orderId) => ({
      "networkKey": networkKey,
      "recipient": phone,
      "capacity": String(sizeGb),
    }),
    apiKeyEnvVar: "DATAHUBGH_API_KEY",
  },

  orisjay: {
    apiUrl: "https://orisjay.store/api/process-order.php",
    networkMap: {
      mtn: "mtn",
      mtn_express: "mtn",
      mtn_xpress: "mtn",
      telecel: "telecel",
      airteltigo: "ishare",
      atbigtime: "bigtime",
    },
    buildRequest: (phone, sizeGb, networkKey, network, orderId, bundle_id) => {
      const bundleLookupNetwork = network.startsWith("mtn") ? "mtn" : network;

      const dbBundleId = Number(bundle_id) > 0 ? Number(bundle_id) : null;
      const mappedBundleId =
        ORISJAY_BUNDLE_ID_MAP[`${bundleLookupNetwork}:${Number(sizeGb)}`] ?? dbBundleId;

      if (!mappedBundleId) {
        console.warn(`[ORISJAY] No bundle_id mapping for ${network}:${sizeGb}GB — request will fail`);
      }

      return {
        "phone": phone,
        "bundle_id": mappedBundleId,
        "network": networkKey,
        ...(orderId && { "external_reference": orderId }),
      };
    },
    apiKeyEnvVar: "ORISJAY_API_KEY",
  },
hubnet: {
  apiUrl: "https://console.hubnet.app/live/api/context/business/transaction",
  networkMap: {
    mtn: "mtn",
    telecel: "telecel",
    airteltigo: "at",
    atbigtime: "big-time",
  },
  buildRequest: (phone, sizeGb, networkKey, network, orderId) => ({
    "phone": phone,
    "volume": String(Number(sizeGb) * 1000),
    "reference": orderId ?? `TCX-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
    "referrer": phone,
  }),
  apiKeyEnvVar: "HUBNET_API_KEY",
},
bundlezonegh: {
  apiUrl: "https://bundlezonegh.com/api/v1",
  networkMap: {
    mtn: "mtn",
    mtn_express: "mtn",
    telecel: "telecel",
    airteltigo: "ishare",
  },
  buildRequest: (phone, sizeGb, networkKey, network, orderId, bundle_id) => ({
    "action": "place_order",
    "network": networkKey,
    "recipient": phone,
    "id": bundle_id,
    ...(orderId && { "order_id": orderId }),
  }),
  apiKeyEnvVar: "BUNDLEZONEGH_API",
},

fastdealgh: {
  apiUrl: "https://fastdealsgh.com/api/v1/data/buy",
  networkMap: {
    mtn: "mtn",
    mtn_express: "mtn",
    telecel: "telecel",
    airteltigo: "airteltigo",
    atbigtime: "atbigtime",
  },
  buildRequest: (phone, sizeGb, networkKey, network, orderId) => ({
    "plan_id": FASTDEALSGH_PLAN_ID_MAP[`${networkKey}:${Number(sizeGb)}`],
    "phone": phone,
  }),
  apiKeyEnvVar: "FASTDEALSGH_API",
},
};


const NETWORK_TO_PROVIDER: Record<string, string> = {
  mtn: "dakazina",
  mtn_express:"ghdataconnect",
  telecel: "ghdataconnect",
  airteltigo:"ghdataconnect",
  atbigtime:"ghdataconnect",
  mtn_mashup: "dakazina",
  // CHANGED: "mashup" now goes to DataMart MashUp (was "datahubnet").
  // datahubnet is still fully configured above; you can switch back any time
  // from your admin route table (network_provider_routes) without a redeploy.
  mashup: "datamart_mashup",
};

async function resolveProvider(
  supabase: any,
  networkKey: string,
  fallback: string | undefined,
): Promise<string | undefined> {
  const { data, error } = await supabase
    .from("network_provider_routes")
    .select("provider_key, enabled")
    .eq("network_key", networkKey)
    .eq("flow", "fulfillment")
    .maybeSingle();

  if (error) {
    console.warn(`[FULFILL] Route lookup failed for ${networkKey}, using fallback: ${error.message}`);
    return fallback;
  }
  if (data && data.enabled) {
    console.log(`[FULFILL] Admin route for ${networkKey} → ${data.provider_key}`);
    return data.provider_key;
  }
  return fallback;
}

const PROVIDER_RATE_LIMIT_MS = 90 * 1000; // 90 seconds

async function checkProviderRateLimit(
  supabase: any,
  phone: string,
  network: string,
  sizeGb: number,
  provider: string,
): Promise<{ id: string; last_provider_sent_at: string } | null> {
  const windowStart = new Date(Date.now() - PROVIDER_RATE_LIMIT_MS).toISOString();

  const { data, error } = await supabase
    .from("orders")
    .select("id, last_provider_sent_at")
    .eq("customer_number", phone)
    .eq("network", network)
    .eq("size_gb", sizeGb)
    .eq("fulfillment_provider", provider)
    .gte("last_provider_sent_at", windowStart)
    .order("last_provider_sent_at", { ascending: false })
    .limit(1);

  if (error) {
    console.warn(`[FULFILL] Provider rate-limit check failed (continuing anyway): ${error.message}`);
    return null;
  }

  return data && data.length > 0 ? data[0] : null;
}

/**
 * Called when an incoming order is recognized as a duplicate send of an
 * already-in-flight/completed order (either the 5-minute cross-order
 * duplicate check, or the 90-second same-provider rate-limit check).
 *
 * Instead of marking the duplicate order "failed" (which is misleading —
 * nothing actually went wrong, the bundle was already sent via the
 * original order), this mirrors whatever the original order's status
 * currently is, and tags the duplicate with `duplicate_of` so that if the
 * original is still "processing" at this instant, a later cascade
 * (see cascadeToDuplicates) can catch it up once the original resolves.
 */
async function blockAsDuplicate(
  supabase: any,
  duplicateOrderId: string,
  originalOrderId: string,
  reasonLabel: string,
): Promise<string> {
  const { data: originalOrder, error: fetchErr } = await supabase
    .from("orders")
    .select("fulfillment_status, provider_reference")
    .eq("id", originalOrderId)
    .single();

  if (fetchErr) {
    console.warn(`[FULFILL] Could not fetch original order ${originalOrderId} to mirror (defaulting to processing): ${fetchErr.message}`);
  }

  // If we can't tell what the original order is doing yet, default to
  // "processing" rather than "failed" — a cascade will catch it up once
  // the original order resolves.
  const mirroredStatus = (!fetchErr && originalOrder?.fulfillment_status) ? originalOrder.fulfillment_status : "processing";
  const providerReference = originalOrder?.provider_reference ?? null;

  const { error: updateErr } = await supabase
    .from("orders")
    .update({
      fulfillment_status: mirroredStatus,
      provider_reference: providerReference,
      api_response: `${reasonLabel} — treated as a duplicate of order ${originalOrderId}; mirrored its status ("${mirroredStatus}") instead of failing`,
      duplicate_of: originalOrderId,
    })
    .eq("id", duplicateOrderId);

  if (updateErr) {
    console.error(`[FULFILL] DB update error while marking ${duplicateOrderId} as duplicate: ${updateErr.message}`);
  } else {
    console.log(`[FULFILL] Order ${duplicateOrderId} marked as duplicate of ${originalOrderId}, mirrored status "${mirroredStatus}"`);
  }

  return mirroredStatus;
}

/**
 * Called right after an order's fulfillment_status is finally resolved
 * (completed or failed from an actual provider call). Any other order
 * that was parked as a duplicate of this one (see blockAsDuplicate) and
 * is still sitting at "processing" gets caught up to the real outcome.
 */
async function cascadeToDuplicates(
  supabase: any,
  originalOrderId: string,
  resolvedStatus: string,
  providerReference: string | null | undefined,
  apiResponseNote: string,
): Promise<void> {
  const { data: cascaded, error } = await supabase
    .from("orders")
    .update({
      fulfillment_status: resolvedStatus,
      provider_reference: providerReference ?? null,
      api_response: `Mirrored from original order ${originalOrderId}: ${apiResponseNote}`,
    })
    .eq("duplicate_of", originalOrderId)
    .eq("fulfillment_status", "processing")
    .select("id");

  if (error) {
    console.warn(`[FULFILL] Failed to cascade status to duplicates of ${originalOrderId} (continuing anyway): ${error.message}`);
    return;
  }

  if (cascaded && cascaded.length > 0) {
    console.log(`[FULFILL] Cascaded status "${resolvedStatus}" to ${cascaded.length} duplicate order(s) of ${originalOrderId}: ${cascaded.map((c: any) => c.id).join(", ")}`);
  }
}

// ---------------------------------------------------------------------------
// Payment authorisation: nothing may reach a provider unless it is paid for.
// ---------------------------------------------------------------------------

type Authorization = { ok: true } | { ok: false; status: number; error: string };

const AUTHORISED: Authorization = { ok: true };
// Paystack charges that belong to other products must never be reusable as proof for a data order.
const NON_DATA_PAYMENT_TYPES = new Set(["storefront_korba_purchase", "social_boost"]);
const MIN_PAID_RATIO = 0.95;

async function verifyPaystackPayment(order: any): Promise<Authorization> {
  const reference = order.paystack_reference || order.payment_reference;
  const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!reference || !secret) {
    return { ok: false, status: 402, error: "No payment reference on this order" };
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(String(reference))}`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      const body = await res.json().catch(() => null);

      if (res.ok && body?.data?.status === "success") {
        const paid = Number(body.data.amount) / 100;
        const type = String(body.data.metadata?.type || "").toLowerCase();
        if (NON_DATA_PAYMENT_TYPES.has(type)) {
          return { ok: false, status: 402, error: "This payment belongs to a different purchase" };
        }
        if (!Number.isFinite(paid) || paid < Number(order.amount || 0) * MIN_PAID_RATIO) {
          return { ok: false, status: 402, error: "Amount paid does not cover this order" };
        }
        return AUTHORISED;
      }
      // A definite answer from Paystack that the charge did not succeed.
      if (res.status !== 429 && res.status < 500) {
        return { ok: false, status: 402, error: "Payment has not been confirmed" };
      }
    } catch (err) {
      console.warn(`[FULFILL] Paystack verification attempt ${attempt + 1} failed:`, err);
    }
  }
  return { ok: false, status: 503, error: "Could not confirm payment right now. Please try again shortly." };
}

async function ownsOrder(supabase: any, userId: string, order: any): Promise<boolean> {
  if (order.user_id === userId || order.customer_id === userId) return true;

  const stores: Array<[string, string | null]> = [
    ["agent_stores", order.agent_store_id],
    ["subagent_stores", order.subagent_store_id],
    ["sub_subagent_stores", order.sub_subagent_store_id],
  ];
  for (const [table, storeId] of stores) {
    if (!storeId) continue;
    const { data } = await supabase.from(table).select("id").eq("id", storeId).eq("user_id", userId).maybeSingle();
    if (data) return true;
  }

  if (order.customer_id) {
    const { data } = await supabase.from("customers").select("id").eq("id", order.customer_id).eq("user_id", userId).maybeSingle();
    if (data) return true;
  }
  return false;
}

async function authorizeFulfillment(supabase: any, req: Request, order: any, serviceRoleKey: string): Promise<Authorization> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (token && token === serviceRoleKey) return AUTHORISED;

  let userId: string | null = null;
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    userId = data?.user?.id ?? null;
  }

  if (userId) {
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (isAdmin === true) return AUTHORISED;
  }

  const method = String(order.payment_method || "").toLowerCase();
  if (method === "paystack") return await verifyPaystackPayment(order);
  if (method === "wallet" && userId && await ownsOrder(supabase, userId, order)) return AUTHORISED;

  return { ok: false, status: userId ? 403 : 401, error: "You are not allowed to fulfil this order" };
}

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
    const { order_id } = await req.json();

    console.log(`[FULFILL] Full request metadata:`, JSON.stringify({ order_id }, null, 2));

    if (!order_id) {
      return new Response(JSON.stringify({ error: "Missing order_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[FULFILL] Starting fulfillment for order_id: ${order_id}`);

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

    console.log(`[FULFILL] Order found - Status: ${order.fulfillment_status}, Network: ${order.network}, Size: ${order.size_gb}GB`);

    const authorization = await authorizeFulfillment(supabase, req, order, serviceRoleKey);
    if (!authorization.ok) {
      console.warn(`[FULFILL] BLOCKED order ${order_id} (payment_method=${order.payment_method}): ${authorization.error}`);
      return new Response(JSON.stringify({ success: false, error: authorization.error }), {
        status: authorization.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let bundleId = null;

    if (order.package_id) {
      const { data: packageData, error: packageError } = await supabase
        .from("data_packages")
        .select("bundle_id")
        .eq("id", order.package_id)
        .single();

      if (!packageError && packageData) {
        bundleId = packageData.bundle_id;
        console.log(`[FULFILL] Bundle ID fetched: ${bundleId}`);
      } else {
        console.warn(`[FULFILL] No bundle_id found for package: ${order.package_id}`);
      }
    }

    const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;
    const duplicateWindowStart = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();

    const { data: dupOrders, error: dupErr } = await supabase
      .from("orders")
      .select("id, fulfillment_status, created_at")
      .eq("customer_number", order.customer_number)
      .eq("network", order.network)
      .eq("size_gb", order.size_gb)
      .neq("id", order_id)
      .in("fulfillment_status", ["completed", "processing"])
      .gte("created_at", duplicateWindowStart)
      .limit(1);

    if (dupErr) {
      console.warn(`[FULFILL] Cross-order duplicate check failed (continuing anyway): ${dupErr.message}`);
    } else if (dupOrders && dupOrders.length > 0) {
      const dup = dupOrders[0];
      console.warn(`[FULFILL] Order ${order_id} is a duplicate of order ${dup.id} (status: ${dup.fulfillment_status}, created: ${dup.created_at}) — mirroring instead of failing`);

      const mirroredStatus = await blockAsDuplicate(
        supabase,
        order_id,
        dup.id,
        `Duplicate order detected within ${DUPLICATE_WINDOW_MS / 1000}s window`,
      );

      return new Response(JSON.stringify({
        success: mirroredStatus === "completed",
        message: `Duplicate of order ${dup.id} (${dup.fulfillment_status}) — mirrored its status ("${mirroredStatus}"). No separate bundle was sent.`,
        duplicate_of: dup.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.fulfillment_status === "completed") {
      console.log(`[FULFILL] Order ${order_id} already completed. Skipping.`);
      return new Response(JSON.stringify({
        success: false,
        message: "Order already completed"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[FULFILL] Locking order as processing...`);
    const { data: lockedRows, error: lockErr } = await supabase
      .from("orders")
      .update({ fulfillment_status: "processing" })
      .eq("id", order_id)
      .in("fulfillment_status", ["pending", "failed"])
      .select("id");

    if (lockErr) {
      console.error(`[FULFILL] Failed to lock order: ${lockErr.message}`);
      return new Response(JSON.stringify({ error: "Failed to lock order" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!lockedRows || lockedRows.length === 0) {
      console.warn(`[FULFILL] Order ${order_id} was already locked/processed by another call — skipping duplicate fulfillment`);
      return new Response(JSON.stringify({
        success: false,
        message: "Order already being processed or completed (duplicate fulfillment call blocked)"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[FULFILL] Order locked as processing`);

    let phone = order.customer_number.replace(/[^0-9]/g, "");
    if (phone.startsWith("233")) {
      phone = "0" + phone.slice(3);
    }
    if (!phone.startsWith("0")) {
      phone = "0" + phone;
    }

    console.log(`[FULFILL] Cleaned phone: ${phone}, Size: ${order.size_gb}GB, Network: ${order.network}`);

    const isFreeDataClaim = order.payment_method === "free_data_claim";

    if (isFreeDataClaim) {
      console.log(`[FULFILL] Processing FREE DATA CLAIM order ${order_id}`);

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

      const provider = await resolveProvider(supabase, claimNetwork, NETWORK_TO_PROVIDER[claimNetwork]);
      if (!provider) {
        console.error(`[FULFILL] No provider for network: ${claimNetwork}`);
        const { error: updateErr } = await supabase
          .from("orders")
          .update({
            fulfillment_status: "failed",
            api_response: `No provider for network: ${claimNetwork}`
          })
          .eq("id", order_id);

        if (updateErr) console.error(`[FULFILL] DB update error: ${updateErr.message}`);
        else console.log(`[FULFILL] ❌ FREE DATA CLAIM failed - marked as failed`);

        await cascadeToDuplicates(supabase, order_id, "failed", null, `No provider for network: ${claimNetwork}`);

        return new Response(JSON.stringify({ error: `No provider for network: ${claimNetwork}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const config = NETWORK_CONFIGS[provider];
      const apiKey = apiKeys[provider];

      if (!apiKey) {
        console.error(`[FULFILL] No API key for provider: ${provider}`);
        const { error: updateErr } = await supabase
          .from("orders")
          .update({
            fulfillment_status: "failed",
            api_response: `No API key for provider: ${provider}`
          })
          .eq("id", order_id);

        if (updateErr) console.error(`[FULFILL] DB update error: ${updateErr.message}`);
        else console.log(`[FULFILL] ❌ FREE DATA CLAIM failed - marked as failed`);

        await cascadeToDuplicates(supabase, order_id, "failed", null, `No API key for provider: ${provider}`);

        return new Response(JSON.stringify({ error: `No API key for provider: ${provider}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const claimRateLimitHit = await checkProviderRateLimit(supabase, phone, claimNetwork, order.size_gb, provider);
      if (claimRateLimitHit) {
        console.warn(`[FULFILL] Order ${order_id} is a duplicate send within the provider rate-limit window: ${phone} / ${claimNetwork} ${order.size_gb}GB already sent to ${provider} (order ${claimRateLimitHit.id} at ${claimRateLimitHit.last_provider_sent_at}) — mirroring instead of failing`);

        const mirroredStatus = await blockAsDuplicate(
          supabase,
          order_id,
          claimRateLimitHit.id,
          `Same phone/network/size sent to ${provider} within the last ${PROVIDER_RATE_LIMIT_MS / 1000}s`,
        );

        return new Response(JSON.stringify({
          success: mirroredStatus === "completed",
          message: `Duplicate send of order ${claimRateLimitHit.id} to ${provider} within ${PROVIDER_RATE_LIMIT_MS / 1000}s — mirrored its status ("${mirroredStatus}"). No separate bundle was sent.`,
          duplicate_of: claimRateLimitHit.id,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: providerTagErr } = await supabase
        .from("orders")
        .update({ fulfillment_provider: provider, last_provider_sent_at: new Date().toISOString() })
        .eq("id", order_id);
      if (providerTagErr) {
        console.warn(`[FULFILL] Failed to tag order with fulfillment_provider (continuing): ${providerTagErr.message}`);
      }

      const networkKey = config.networkMap[claimNetwork] || claimNetwork.toUpperCase();
      console.log(`[FULFILL] Sending FREE DATA to ${provider}: phone=${phone}, size=${order.size_gb}GB, network=${networkKey}`);

      const requestBody = config. buildRequest(phone, order.size_gb, networkKey, claimNetwork, order_id);

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
        console.log(`[FULFILL] FREE DATA CLAIM - SUCCESS`);
        const { error: updateErr } = await supabase
          .from("orders")
          .update({
            fulfillment_status: "completed",
            api_response: apiData,
            provider_reference: parsedData?.reference,
            network: claimNetwork,
          })
          .eq("id", order_id);

        if (updateErr) {
          console.error(`[FULFILL] DB update error: ${updateErr.message}`);
          return new Response(JSON.stringify({ error: updateErr.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await cascadeToDuplicates(supabase, order_id, "completed", parsedData?.reference, apiData);

        console.log(`[FULFILL] ✅ FREE DATA CLAIM completed successfully`);
        return new Response(JSON.stringify({
          success: true,
          message: "Free data claim fulfilled successfully"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        const errorMsg = parsedData?.message || apiData;
        console.log(`[FULFILL] FREE DATA CLAIM - FAILED: ${errorMsg}`);

        const { error: updateErr } = await supabase
          .from("orders")
          .update({
            fulfillment_status: "failed",
            api_response: apiData,
          })
          .eq("id", order_id);

        if (updateErr) {
          console.error(`[FULFILL] DB update error: ${updateErr.message}`);
          return new Response(JSON.stringify({ error: updateErr.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await cascadeToDuplicates(supabase, order_id, "failed", null, apiData);

        console.log(`[FULFILL] ❌ FREE DATA CLAIM marked as failed - can retry`);
        return new Response(JSON.stringify({
          success: false,
          message: "Free data claim fulfillment failed",
          api_response: apiData
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log(`[FULFILL] Processing REGULAR PAID order ${order_id}`);

    const normalizedNetwork = order.network.toLowerCase();
    const provider = await resolveProvider(supabase, normalizedNetwork, NETWORK_TO_PROVIDER[normalizedNetwork]);
  if (provider === "fricopay" && order.fulfillment_status === "failed") {
  console.warn(
    `[FULFILL] Fricopay order ${order_id} is failed and must be manually verified before retry`
  );

  return new Response(
    JSON.stringify({
      success: false,
      retryable: false,
      message:
        "Fricopay order requires manual provider verification before retry",
    }),
    {
      status: 409,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}
    if (!provider) {
      console.error(`[FULFILL] No provider for network: ${order.network}`);
      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          fulfillment_status: "failed",
          api_response: `No provider for network: ${order.network}`
        })
        .eq("id", order_id);

      if (updateErr) console.error(`[FULFILL] DB update error: ${updateErr.message}`);
      else console.log(`[FULFILL] ❌ No provider - marked as failed`);

      await cascadeToDuplicates(supabase, order_id, "failed", null, `No provider for network: ${order.network}`);

      return new Response(JSON.stringify({ error: `No provider for network: ${order.network}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = NETWORK_CONFIGS[provider];
    if (!config) {
      console.error(`[FULFILL] Invalid provider config: ${provider}`);
      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          fulfillment_status: "failed",
          api_response: `Invalid provider config: ${provider}`
        })
        .eq("id", order_id);

      if (updateErr) console.error(`[FULFILL] DB update error: ${updateErr.message}`);
      else console.log(`[FULFILL] ❌ Invalid config - marked as failed`);

      await cascadeToDuplicates(supabase, order_id, "failed", null, `Invalid provider config: ${provider}`);

      return new Response(JSON.stringify({ error: `Invalid provider config: ${provider}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = apiKeys[provider];
    if (!apiKey) {
      console.error(`[FULFILL] No API key for provider: ${provider}`);
      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          fulfillment_status: "failed",
          api_response: `No API key for provider: ${provider}`
        })
        .eq("id", order_id);

      if (updateErr) console.error(`[FULFILL] DB update error: ${updateErr.message}`);
      else console.log(`[FULFILL] ❌ No API key - marked as failed`);

      await cascadeToDuplicates(supabase, order_id, "failed", null, `No API key for provider: ${provider}`);

      return new Response(JSON.stringify({ error: `No API key for provider: ${provider}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rateLimitHit = await checkProviderRateLimit(supabase, phone, normalizedNetwork, order.size_gb, provider);
    if (rateLimitHit) {
      console.warn(`[FULFILL] Order ${order_id} is a duplicate send within the provider rate-limit window: ${phone} / ${normalizedNetwork} ${order.size_gb}GB already sent to ${provider} (order ${rateLimitHit.id} at ${rateLimitHit.last_provider_sent_at}) — mirroring instead of failing`);

      const mirroredStatus = await blockAsDuplicate(
        supabase,
        order_id,
        rateLimitHit.id,
        `Same phone/network/size sent to ${provider} within the last ${PROVIDER_RATE_LIMIT_MS / 1000}s`,
      );

      return new Response(JSON.stringify({
        success: mirroredStatus === "completed",
        message: `Duplicate send of order ${rateLimitHit.id} to ${provider} within ${PROVIDER_RATE_LIMIT_MS / 1000}s — mirrored its status ("${mirroredStatus}"). No separate bundle was sent.`,
        duplicate_of: rateLimitHit.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: providerTagErr2 } = await supabase
      .from("orders")
      .update({ fulfillment_provider: provider, last_provider_sent_at: new Date().toISOString() })
      .eq("id", order_id);
    if (providerTagErr2) {
      console.warn(`[FULFILL] Failed to tag order with fulfillment_provider (continuing): ${providerTagErr2.message}`);
    }

    const networkKey = config.networkMap[normalizedNetwork] || normalizedNetwork.toUpperCase();
    console.log(`[FULFILL] Sending to ${provider}: phone=${phone}, size=${order.size_gb}GB, network=${networkKey}`);

    let requestBody;

    if (normalizedNetwork === "mashup" && provider === "datamart_mashup") {
      // ===== NEW: DataMart MashUp =====
      // comboCost = data_packages.bundle_id for this order's package.
      const comboCost = Number(bundleId) || 0;
      console.log(`[FULFILL] MASHUP (DataMart) order - package_id: ${order.package_id}, comboCost (bundle_id): ${comboCost}`);

      if (!comboCost) {
        console.error(`[FULFILL] ERROR: No comboCost (bundle_id) found for mashup package_id: ${order.package_id}`);
        const { error: updateErr } = await supabase
          .from("orders")
          .update({
            fulfillment_status: "failed",
            api_response: `Unable to find comboCost (bundle_id) for mashup package_id="${order.package_id}". Set data_packages.bundle_id to the DataMart comboCost.`
          })
          .eq("id", order_id);

        if (updateErr) console.error(`[FULFILL] DB update error: ${updateErr.message}`);
        else console.log(`[FULFILL] ❌ Mashup comboCost missing - marked as failed`);

        await cascadeToDuplicates(supabase, order_id, "failed", null, `Unable to find comboCost for mashup package`);

        return new Response(JSON.stringify({ error: "Unable to find comboCost for mashup package" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      requestBody = config.buildRequest(phone, order.size_gb, networkKey, normalizedNetwork, order_id, bundleId);
    } else if (normalizedNetwork === "mashup") {
      // Your original mashup logic (datahubnet etc.) — unchanged.
      let dataPackageId = undefined;

      if (order.size_gb_text) {
        dataPackageId = MASHUP_SIZE_TO_PACKAGE_ID[order.size_gb_text];

        if (!dataPackageId) {
          if (order.size_gb_text.includes("2.6")) dataPackageId = 16;
          else if (order.size_gb_text.includes("3.61")) dataPackageId = 20;
          else if (order.size_gb_text.includes("1.7")) dataPackageId = 14;
          else if (order.size_gb_text.includes("5.1")) dataPackageId = 3;
          else if (order.size_gb_text.includes("8.2")) dataPackageId = 17;
          else if (order.size_gb_text.includes("11.9")) dataPackageId = 18;
          else if (order.size_gb_text.includes("15.3")) dataPackageId = 19;
        }
      }

      if (!dataPackageId) {
        const sizeStr = String(order.size_gb);
        dataPackageId = MASHUP_SIZE_TO_PACKAGE_ID[sizeStr];
      }

      console.log(`[FULFILL] MASHUP order - size_gb_text: "${order.size_gb_text}", size_gb: ${order.size_gb}, looked up package_id: ${dataPackageId}`);

      if (!dataPackageId) {
        console.error(`[FULFILL] ERROR: Could not map mashup package - size_gb_text: "${order.size_gb_text}", size_gb: ${order.size_gb}`);
        const { error: updateErr } = await supabase
          .from("orders")
          .update({
            fulfillment_status: "failed",
            api_response: `Unable to map mashup package. size_gb_text="${order.size_gb_text}", size_gb=${order.size_gb}`
          })
          .eq("id", order_id);

        if (updateErr) console.error(`[FULFILL] DB update error: ${updateErr.message}`);
        else console.log(`[FULFILL] ❌ Mashup mapping failed - marked as failed`);

        await cascadeToDuplicates(supabase, order_id, "failed", null, `Unable to map mashup package`);

        return new Response(JSON.stringify({ error: "Unable to map mashup package" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      requestBody = config.buildRequest(phone, dataPackageId, networkKey, normalizedNetwork, order_id);
    } else {
      requestBody = config.buildRequest(phone, order.size_gb, networkKey, normalizedNetwork, order_id, bundleId);
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
    console.log(`[FULFILL] API Response from ${provider}: ${apiRes.status} - ${apiData}`);

    let parsedData;
    try {
      parsedData = JSON.parse(apiData);
    } catch (e) {
      parsedData = null;
    }

    const isSuccess = apiRes.ok && (parsedData?.success !== false);

    if (isSuccess) {
      console.log(`[FULFILL] Order ${order_id} - SUCCESS`);

      const updatePayload: Record<string, any> = {
        fulfillment_status: "completed",
        provider_reference: parsedData?.reference,
        api_response: apiData,
      };
      if (provider === "dakazina" && parsedData?.transaction_code) {
        updatePayload.provider_reference = parsedData.transaction_code;
        console.log(`[FULFILL] Dakazina transaction_code saved: ${parsedData.transaction_code}`);
      }

      // ===== NEW: DataMart MashUp nests the reference under `data` =====
      if (provider === "datamart_mashup") {
        updatePayload.provider_reference =
          parsedData?.data?.reference ?? parsedData?.data?.orderId ?? updatePayload.provider_reference;
        console.log(`[FULFILL] DataMart MashUp reference saved: ${updatePayload.provider_reference}`);
      }

      const { error: updateErr } = await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", order_id);

      if (updateErr) {
        console.error(`[FULFILL] DB update error: ${updateErr.message}`);
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await cascadeToDuplicates(supabase, order_id, "completed", updatePayload.provider_reference, apiData);

      console.log(`[FULFILL] ✅ Order completed successfully`);
      return new Response(JSON.stringify({
        success: true,
        message: "Order fulfilled successfully"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const errorMsg = parsedData?.message || apiData;
      console.log(`[FULFILL] Order ${order_id} - FAILED: ${errorMsg}`);

      const isLowBalance = errorMsg.toLowerCase().includes("low balance") ||
        errorMsg.toLowerCase().includes("insufficient balance") ||
        errorMsg.toLowerCase().includes("insufficient funds");
      const isCapacityIssue = errorMsg.toLowerCase().includes("capacity not available") ||
        errorMsg.toLowerCase().includes("package not available") ||
        errorMsg.toLowerCase().includes("bundle not available");

      if (isLowBalance) {
        console.warn(`[FULFILL] ⚠️ API Provider LOW BALANCE - Will auto-retry when balance restored`);
      } else if (isCapacityIssue) {
        console.warn(`[FULFILL] ⚠️ Bundle/Package not available for this network`);
      }

      const { error: updateErr } = await supabase
        .from("orders")
        .update({
          fulfillment_status: "failed",
          api_response: apiData,
        })
        .eq("id", order_id);

      if (updateErr) {
        console.error(`[FULFILL] DB update error: ${updateErr.message}`);
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await cascadeToDuplicates(supabase, order_id, "failed", null, apiData);

      console.log(`[FULFILL] ❌ Order marked as failed - can retry`);
      return new Response(JSON.stringify({
        success: false,
        message: "Order fulfillment failed",
        api_response: apiData
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (err) {
    console.error(`[FULFILL] Unhandled error:`, err);
    return new Response(JSON.stringify({ error: "Internal server error", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
