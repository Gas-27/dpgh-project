import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Price1GB {
  network: string;
  price: number;
}

export interface SubscriptionItem {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
  price: number;
  isFree: boolean;
}

const NETWORK_LABELS: Record<string, string> = {
  mtn: "MTN",
  mtn_express: "MTN Express",
  telecel: "Telecel",
  airteltigo: "AirtelTigo",
};

export const networkLabel = (network: string) => NETWORK_LABELS[network] ?? network;

/** Public, read-only: the 1GB price per network straight from data_packages. */
export function usePrices1GB() {
  return useQuery({
    queryKey: ["seo", "prices-1gb"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Price1GB[]> => {
      const { data, error } = await supabase
        .from("data_packages")
        .select("network, price")
        .eq("size_gb", 1)
        .eq("active", true);
      if (error) throw error;
      const lowestByNetwork = new Map<string, number>();
      (data ?? []).forEach((row: { network: string; price: number | string }) => {
        const price = Number(row.price);
        if (!Number.isFinite(price) || price <= 0) return;
        const current = lowestByNetwork.get(row.network);
        if (current === undefined || price < current) lowestByNetwork.set(row.network, price);
      });
      const order = Object.keys(NETWORK_LABELS);
      return [...lowestByNetwork.entries()]
        .map(([network, price]) => ({ network, price }))
        .sort((a, b) => order.indexOf(a.network) - order.indexOf(b.network));
    },
  });
}

/** Public, read-only: active subscription services from digital_services. */
export function useSubscriptionServices() {
  return useQuery({
    queryKey: ["seo", "subscription-services"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<SubscriptionItem[]> => {
      const { data, error } = await supabase
        .from("digital_services")
        .select("id, name, slug, category, description, price, is_free")
        .eq("active", true)
        .eq("archived", false)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        category: row.category ?? null,
        description: row.description ?? null,
        price: Number(row.price) || 0,
        isFree: !!row.is_free,
      }));
    },
  });
}
