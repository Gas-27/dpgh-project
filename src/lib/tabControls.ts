import { supabase } from "@/integrations/supabase/client";

export type TabControl = {
  enabled: boolean;
  message: string;
  availableFrom?: string;
  availableUntil?: string;
};

export type TabControls = Record<string, TabControl>;

export const defaultTabControls: TabControls = {};

export function isTabUnavailable(control?: TabControl, now = new Date()) {
  if (!control) return false;
  if (control.availableFrom && now < new Date(control.availableFrom)) return true;
  if (control.availableUntil && now >= new Date(control.availableUntil)) return true;
  return control.enabled === false;
}

export async function fetchTabControls() {
  const { data } = await supabase.from("app_settings").select("tab_controls").eq("id", 1).maybeSingle();
  return (data?.tab_controls as TabControls | null) ?? defaultTabControls;
}

export async function saveTabControls(tab_controls: TabControls) {
  return supabase.from("app_settings").upsert({ id: 1, tab_controls, updated_at: new Date().toISOString() });
}

export const tabControlOptions = [
  { id: "data", label: "Cheap Data" },
  { id: "packages", label: "Packages" },
  { id: "gamehub", label: "GameHub" },
  { id: "subscription", label: "Subscription" },
  { id: "instant", label: "Data and Airtime" },
  { id: "bulk", label: "Bulk Orders" },
  { id: "services", label: "Services" },
  { id: "products", label: "Products" },
  { id: "global-products", label: "Global Products" },
  { id: "afa", label: "AFA Registration" },
  { id: "sms", label: "Bulk SMS" },
  { id: "social-boost", label: "Social Boost" },
];
