import { supabase } from "@/integrations/supabase/client";

export type KorbaPurchaseRequest = {
  productType: "airtime" | "data" | "ecg" | "startimes" | "gotv" | "dstv";
  amount: number;
  customerNumber: string;
  networkCode: string;
  packageCode?: string;
  meterNumber?: string;
  accountNumber?: string;
  phoneNumber?: string;
  orderId?: string;
  walletOnly?: boolean;
  walletOwnerType?: string;
  walletOwnerId?: string;
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

export async function lookupKorbaUtility(input: {
  productType: "ecg" | "electricity" | "water" | "gotv" | "dstv" | "startimes";
  meterNumber?: string;
  accountNumber?: string;
  decoderNumber?: string;
}) {
  const { data, error } = await supabase.functions.invoke("korba-gateway", {
    body: { operation: "utility_lookup", product_type: input.productType, meter_number: input.meterNumber, account_number: input.accountNumber, decoder_number: input.decoderNumber },
  });
  if (error) throw new Error("Korba utility lookup failed. Please check the number and try again.");
  if (!data?.success) throw new Error(String(data?.error_message || data?.message || "The utility number could not be verified."));
  return data;
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
    account_number: request.accountNumber,
    phone_number: request.phoneNumber,
    order_id: request.orderId,
    wallet_only: request.walletOnly === true,
    wallet_balance_owner_type: request.walletOwnerType,
    wallet_balance_owner_id: request.walletOwnerId,
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
    const details = errorBody?.korba_details as Record<string, unknown> | undefined;
    const provider = details?.parsed_body as Record<string, unknown> | undefined;
    const message =
      String(errorBody?.error || provider?.error_message || provider?.message || provider?.detail || error.message || "The request could not be completed.");
    const requestId = errorBody?.request_id ? ` (Request ${errorBody.request_id})` : "";
    throw new Error(`${message}${requestId}`);
  }
  if (!data?.success && !data?.transaction_id) {
    console.error("[v0] Korba purchase returned an unsuccessful response", data);
    throw new Error(String(data?.error_message || data?.message || "The request could not be completed. Please try again."));
  }
  return data;
}
