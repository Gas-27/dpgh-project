import { supabase } from "@/integrations/supabase/client";

export type StorePrivateKind = "subagent" | "sub_subagent";

export interface StorePrivateDetails {
  id: string;
  momo_number: string | null;
  momo_name: string | null;
  momo_network: string | null;
  wallet_balance: number | null;
  email: string | null;
  total_revenue: number | null;
}

const MAX_IDS_PER_CALL = 500;

/**
 * Columns of subagent_stores / sub_subagent_stores that the browser can no
 * longer read directly: momo_number, momo_name, momo_network, wallet_balance,
 * email, total_revenue. They are only available through the
 * `store_private_details` RPC (store owner, parent agent/subagent, or admin).
 */
export const PRIVATE_STORE_FIELDS = [
  "momo_number",
  "momo_name",
  "momo_network",
  "wallet_balance",
  "email",
  "total_revenue",
] as const;

/** Explicit readable columns of subagent_stores (never use "*" on this table). */
export const SUBAGENT_PUBLIC_COLUMNS =
  "id, user_id, agent_store_id, store_name, store_name_slug, whatsapp_number, support_number, whatsapp_group, approved, allow_registration, suspended, topup_reference, created_at";

/** Public storefront columns of subagent_stores (no MoMo, wallet, email or revenue). */
export const SUBAGENT_STOREFRONT_COLUMNS =
  "id, user_id, agent_store_id, store_name, store_name_slug, url_slug, whatsapp_number, support_number, whatsapp_group, store_headline, theme_config, approved, allow_registration, allow_sub_subagent_registration, suspended, topup_reference, custom_domain, custom_domain_status, show_whatsapp_group_icon, show_ussd_on_storefront, created_at";

/** Explicit readable columns of sub_subagent_stores (never use "*" on this table). */
export const SUB_SUBAGENT_PUBLIC_COLUMNS =
  "id, user_id, subagent_store_id, agent_store_id, store_name, whatsapp_number, support_number, whatsapp_group, approved, topup_reference, custom_domain, custom_domain_status, created_at, updated_at";

export async function fetchStorePrivateDetails(
  kind: StorePrivateKind,
  ids: Array<string | null | undefined>,
): Promise<Map<string, StorePrivateDetails>> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => !!id)));
  const result = new Map<string, StorePrivateDetails>();
  if (uniqueIds.length === 0) return result;

  for (let i = 0; i < uniqueIds.length; i += MAX_IDS_PER_CALL) {
    const chunk = uniqueIds.slice(i, i + MAX_IDS_PER_CALL);
    const { data, error } = await (supabase as any).rpc("store_private_details", {
      p_kind: kind,
      p_ids: chunk,
    });
    if (error) {
      console.error(`[store_private_details] ${kind} error:`, error);
      continue;
    }
    for (const row of (data ?? []) as StorePrivateDetails[]) {
      result.set(row.id, row);
    }
  }
  return result;
}

/** Merge private details into store rows by id. Rows without details are returned unchanged. */
export async function withStorePrivateDetails<T extends { id: string }>(
  kind: StorePrivateKind,
  rows: T[] | null | undefined,
): Promise<Array<T & Partial<StorePrivateDetails>>> {
  const list = rows ?? [];
  if (list.length === 0) return [];
  const details = await fetchStorePrivateDetails(kind, list.map((r) => r.id));
  return list.map((row) => {
    const d = details.get(row.id);
    return d ? { ...row, ...d } : row;
  });
}

/** Single-store convenience wrapper. */
export async function withStorePrivateDetail<T extends { id: string }>(
  kind: StorePrivateKind,
  row: T | null | undefined,
): Promise<(T & Partial<StorePrivateDetails>) | null> {
  if (!row) return null;
  const [merged] = await withStorePrivateDetails(kind, [row]);
  return merged ?? row;
}

export async function fetchWalletBalance(kind: StorePrivateKind, id: string): Promise<number | null> {
  const details = await fetchStorePrivateDetails(kind, [id]);
  const balance = details.get(id)?.wallet_balance;
  return balance === null || balance === undefined ? null : Number(balance);
}
