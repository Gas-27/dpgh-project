import { supabase } from "@/integrations/supabase/client";

export type HubtelService =
  | "mtn_airtime"
  | "telecel_airtime"
  | "airteltigo_airtime"
  | "mtn_data"
  | "telecel_data"
  | "airteltigo_data"
  | "ecg"
  | "ghana_water"
  | "dstv"
  | "gotv"
  | "startimes"
  | "telecel_broadband"
  | "telecel_postpaid";

export interface HubtelRequest {
  service: HubtelService;
  destination?: string;
  accountNumber?: string;
  amount?: number;
  bundle?: string;
  packageCode?: string;
  clientReference?: string;
  callbackUrl?: string;
}

export interface HubtelResponse<T = unknown> {
  success: boolean;
  operation?: string;
  service?: string;
  clientReference?: string;
  data?: T;
  error?: string;
}

const invokeHubtel = async <T>(body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("hubtel-gateway", { body });
  if (error) throw new Error(error.message || "Hubtel request failed");
  const response = data as HubtelResponse<T>;
  if (!response?.success) throw new Error(response?.error || "Hubtel request failed");
  return response;
};

export const getHubtelDataCatalog = (request: Pick<HubtelRequest, "service" | "destination">) =>
  invokeHubtel({ operation: "data_catalog", ...request });

export const buyHubtelAirtime = (request: HubtelRequest) =>
  invokeHubtel({ operation: "airtime", ...request });

export const buyHubtelData = (request: HubtelRequest) =>
  invokeHubtel({ operation: "data", ...request });

export const payHubtelBill = (request: HubtelRequest) =>
  invokeHubtel({ operation: "bill", ...request });

export const getHubtelTransactionStatus = (clientReference: string) =>
  invokeHubtel({ operation: "transaction_status", clientReference });

export const isHubtelService = (value: string): value is HubtelService =>
  [
    "mtn_airtime",
    "telecel_airtime",
    "airteltigo_airtime",
    "mtn_data",
    "telecel_data",
    "airteltigo_data",
    "ecg",
    "ghana_water",
    "dstv",
    "gotv",
    "startimes",
    "telecel_broadband",
    "telecel_postpaid",
  ].includes(value);

export const toHubtelService = (network: string, type: "airtime" | "data") => {
  const normalized = network.toLowerCase().replace(/[^a-z]/g, "");
  const prefix = normalized.includes("airtel") ? "airteltigo" : normalized.includes("telecel") || normalized.includes("vodafone") ? "telecel" : "mtn";
  return `${prefix}_${type}` as HubtelService;
};

export const hubtelBillServices = ["ecg", "ghana_water", "dstv", "gotv", "startimes", "telecel_broadband", "telecel_postpaid"] as const;
export type HubtelBillService = (typeof hubtelBillServices)[number];

export const toHubtelBillService = (value: string): HubtelBillService | null =>
  hubtelBillServices.includes(value as HubtelBillService) ? (value as HubtelBillService) : null;

export default {
  getHubtelDataCatalog,
  buyHubtelAirtime,
  buyHubtelData,
  payHubtelBill,
  getHubtelTransactionStatus,
};
