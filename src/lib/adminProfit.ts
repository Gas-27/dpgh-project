import { supabase } from "@/integrations/supabase/client";

export type ProfitPeriod =
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "this_month"
  | "last_month"
  | "custom";

export const PROFIT_PERIODS: { value: ProfitPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Custom" },
];

export interface ProfitUtilityType {
  type: string;
  transactions: number;
  sales: number;
  commission_percent: number;
  profit: number;
}

export interface ProfitReport {
  period: string;
  from: string;
  to: string;
  total_profit: number;
  data: {
    orders: number;
    gb: number;
    sales: number;
    revenue: number;
    reseller_commission: number;
    paystack_fees: number;
    cost: number;
    profit: number;
    missing_cost: number;
  };
  free_data: {
    orders: number;
    gb: number;
    cost: number;
    profit: number;
    missing_cost: number;
  };
  utilities: {
    transactions: number;
    sales: number;
    revenue: number;
    cost: number;
    profit: number;
    by_type: ProfitUtilityType[];
  };
  sms: {
    campaigns: number;
    messages_sent: number;
    pages_sent: number;
    revenue: number;
    cost: number;
    profit: number;
    cost_per_page_set: boolean;
  };
  social_boost: {
    orders: number;
    sales: number;
    revenue: number;
    cost: number;
    profit: number;
    missing_cost: number;
  };
  data_daily: { day: string; orders: number; revenue: number; cost: number }[];
  data_packages_missing_cost: {
    network: string;
    size_gb: number;
    package_id: string;
    provider: string | null;
    orders: number;
  }[];
}

export interface ProfitSetting {
  key: string;
  value: number | null;
  label: string;
}

export interface ProfitDataPackage {
  package_id: string;
  network: string;
  size_gb: number;
  size_gb_text: string | null;
  active: boolean;
  price: number | null;
  agent_price: number | null;
  api_price: number | null;
  costs: Record<string, number | null> | null;
  providers_used: string[] | null;
}

export interface ProfitBoostService {
  service_id: string | number;
  name: string;
  provider: string | null;
  provider_rate: number | null;
  price_per_1000: number | null;
  cost_override: number | null;
}

export interface ProfitCosts {
  settings: ProfitSetting[];
  data_packages: ProfitDataPackage[];
  boost_services: ProfitBoostService[];
}

type RpcResult = { data: unknown; error: { message: string } | null };

export function profitRpc(fn: string, args?: Record<string, unknown>): Promise<RpcResult> {
  const call = supabase.rpc as unknown as (name: string, params?: Record<string, unknown>) => Promise<RpcResult>;
  return call.call(supabase, fn, args);
}

export async function profitRpcOrThrow<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await profitRpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMoney(value: unknown): string {
  const amount = num(value);
  const sign = amount < 0 ? "-" : "";
  return `${sign}GH₵ ${Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCount(value: unknown): string {
  return num(value).toLocaleString("en-US");
}

export function formatGb(value: unknown): string {
  return `${num(value).toLocaleString("en-US", { maximumFractionDigits: 2 })} GB`;
}

export function profitTone(value: unknown): string {
  return num(value) >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive";
}
