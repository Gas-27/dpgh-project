import { supabase } from "@/integrations/supabase/client";

export type KorbaPurchaseRequest = {
  productType: "airtime" | "data" | "ecg" | "water" | "startimes" | "gotv" | "dstv";
  amount: number;
  customerNumber: string;
  networkCode: string;
  packageCode?: string;
  meterNumber?: string;
  meterId?: string;
  meterCategory?: "PREPAID" | "POSTPAID";
  accountNumber?: string;
  phoneNumber?: string;
  orderId?: string;
  walletOnly?: boolean;
  walletOwnerType?: string;
  walletOwnerId?: string;
  purchaseSource?: "dashboard" | "storefront";
};

export async function getKorbaDataBundles(networkCode: string) {
  const { data, error } = await supabase.functions.invoke("korba-gateway", {
    body: { operation: "lookup", network_code: networkCode },
  });
  console.log("[v0] Korba bundle response", {
    data,
    error: error ? { message: error.message, status: error.context?.status } : null,
  });
  if (error) {
    const errorBody = error.context instanceof Response ? await error.context.clone().json().catch(() => null) : null;
    throw new Error(String(errorBody?.error || "Could not load available bundles. Please try again."));
  }
  if (!data?.success) throw new Error(String(data?.error_message || "Could not load available bundles. Please try again."));
  return data;
}

export async function registerKorbaMeter(input: { alias: string; meterNumber: string; phoneNumber: string; meterCategory: "PREPAID" | "POSTPAID"; accountNumber?: string }) {
  const { data, error } = await supabase.functions.invoke("korba-gateway", { body: { operation: "add_meter", alias: input.alias, meter_number: input.meterNumber, phone_number: input.phoneNumber, meter_category: input.meterCategory, account_number: input.accountNumber } });
  if (error) throw new Error("Korba meter registration failed. Please check the meter details and try again.");
  if (!data?.success) throw new Error(String(data?.error_message || data?.message || "The ECG meter could not be registered."));
  return data;
}

export async function lookupKorbaUtility(input: {
  productType: "ecg" | "electricity" | "water" | "ghana_water" | "gotv" | "dstv" | "startimes";
  meterNumber?: string;
  phoneNumber?: string;
  accountNumber?: string;
  decoderNumber?: string;
}) {
  const { data, error } = await supabase.functions.invoke("korba-gateway", {
    body: { operation: "utility_lookup", product_type: input.productType, meter_number: input.meterNumber, phone_number: input.phoneNumber, account_number: input.accountNumber, decoder_number: input.decoderNumber },
  });
  console.log("[v0] Korba utility lookup response", { data, error: error ? { message: error.message, status: error.context?.status } : null });
  if (error) {
    const errorBody = error.context instanceof Response ? await error.context.clone().json().catch(() => null) : null;
    throw new Error(String(errorBody?.error || errorBody?.error_message || "Korba utility lookup failed. Please check the number and try again."));
  }
  if (!data?.success) throw new Error(String(data?.error_message || data?.message || "The utility number could not be verified."));
  return data;
}

async function saveKorbaHistory(request: KorbaPurchaseRequest, result: Record<string, unknown>, status: string) {
  if (!request.walletOnly || !request.walletOwnerId || !request.walletOwnerType) return;
  const { error } = await supabase.rpc("record_korba_history", {
    p_owner_type: request.walletOwnerType,
    p_owner_id: request.walletOwnerId,
    p_product_type: request.productType,
    p_network_code: request.networkCode || null,
    p_package_code: request.packageCode || null,
    p_customer_number: request.customerNumber,
    p_amount: request.amount,
    p_transaction_id: String(result.transaction_id || request.orderId || "") || null,
    p_provider_reference: String(result.reference || result.provider_reference || result.transaction_id || "") || null,
    p_status: status,
    p_source: request.purchaseSource || "dashboard",
  });
  if (error) console.error("[v0] Failed to save Korba purchase history", error);
}

export async function purchaseWithKorba(request: KorbaPurchaseRequest) {
  const requestBody = {
    operation: request.productType === "data" ? "data" : "collect",
    product_type: request.productType,
    amount: request.amount,
    customer_number: request.customerNumber,
    network_code: request.networkCode,
    package_code: request.packageCode,
    meter_number: request.meterNumber,
    meter_id: request.meterId,
    meter_category: request.meterCategory,
    account_number: request.accountNumber,
    phone_number: request.phoneNumber,
    order_id: request.orderId,
    wallet_only: request.walletOnly === true,
    wallet_balance_owner_type: request.walletOwnerType,
    wallet_balance_owner_id: request.walletOwnerId,
    purchase_source: request.purchaseSource || "dashboard",
  };
  console.log("[v0] Korba purchase request", requestBody);
  const { data, error } = await supabase.functions.invoke("korba-gateway", {
    body: requestBody,
  });

  let errorBody: Record<string, unknown> | null = null;
  if (error?.context instanceof Response) {
    errorBody = await error.context.clone().json().catch(() => null);
  }
  console.log("[v0] Korba purchase response", {
    data,
    error: error ? { message: error.message, name: error.name, contextStatus: error.context?.status } : null,
    errorBody,
  });

  if (error) {
    await saveKorbaHistory(request, { transaction_id: request.orderId, error: error.message }, "failed");
    const details = errorBody?.korba_details as Record<string, unknown> | undefined;
    const provider = details?.parsed_body as Record<string, unknown> | undefined;
    const message =
      String(errorBody?.error || provider?.error_message || provider?.message || provider?.detail || error.message || "The request could not be completed.");
    const requestId = errorBody?.request_id ? ` (Request ${errorBody.request_id})` : "";
    throw new Error(`${message}${requestId}`);
  }
  if (!data?.success && !data?.transaction_id) {
    await saveKorbaHistory(request, (data || {}) as Record<string, unknown>, "failed");
    console.error("[v0] Korba purchase returned an unsuccessful response", data);
    throw new Error(String(data?.error_message || data?.message || "The request could not be completed. Please try again."));
  }
  await saveKorbaHistory(request, (data || {}) as Record<string, unknown>, String(data?.status || "completed"));
  return data;
}
