import { supabase } from "@/integrations/supabase/client";

export type KorbaPurchaseRequest = {
  productType: "airtime" | "data" | "ecg" | "startimes";
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

export async function purchaseWithKorba(request: KorbaPurchaseRequest) {
  const { data, error } = await supabase.functions.invoke("korba-gateway", {
    body: {
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
    },
  });
  if (error) throw new Error(error.message || "Korba request failed");
  if (!data?.success && !data?.transaction_id) {
    throw new Error(data?.error || data?.error_message || "Korba request failed");
  }
  return data;
}
