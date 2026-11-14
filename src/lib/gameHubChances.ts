import { supabase } from "@/integrations/supabase/client";
import type { GameHubStoreContext } from "@/lib/gameHubStoreContext";

const db = supabase as any;

export type ChancePackage = { id: string; size_gb: number; price: number };

const PENDING_KEY = "gamehub-pending-chance";

export type PendingChance = {
  chanceOrderId: string;
  gameId: string;
  returnTo: string;
};

export function savePendingChance(pending: PendingChance) {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export function readPendingChance(): PendingChance | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingChance) : null;
  } catch {
    return null;
  }
}

export function clearPendingChance() {
  sessionStorage.removeItem(PENDING_KEY);
}

const positive = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Finds the MTN package for the pack size and prices it at what this store owner charges. */
export async function fetchStoreChancePackage(store: GameHubStoreContext, gb: number): Promise<ChancePackage | null> {
  const { data: pkg } = await db
    .from("data_packages")
    .select("id, size_gb, price")
    .eq("network", "mtn")
    .eq("size_gb", gb)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (!pkg) return null;

  let price: number | null = null;

  if (store.kind === "agent") {
    const { data } = await db.from("agent_package_prices").select("sell_price").eq("agent_store_id", store.storeId).eq("package_id", pkg.id).maybeSingle();
    price = positive(data?.sell_price);
  } else if (store.kind === "subagent") {
    const { data } = await db.from("subagent_package_prices").select("sell_price").eq("subagent_store_id", store.storeId).eq("package_id", pkg.id).maybeSingle();
    price = positive(data?.sell_price);
  } else if (store.ownStoreId) {
    const { data } = await db
      .from("sub_subagent_package_prices")
      .select("customer_sell_price")
      .eq("sub_subagent_store_id", store.ownStoreId)
      .eq("package_id", pkg.id)
      .maybeSingle();
    price = positive(data?.customer_sell_price);
  }

  price = price ?? positive(pkg.price);
  return price === null ? null : { id: pkg.id, size_gb: Number(pkg.size_gb), price };
}
