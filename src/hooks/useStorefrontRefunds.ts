import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface StorefrontRefundRecord {
  id: string;
  order_id: string;
  status: string;
  amount: number;
  paystack_reference: string;
  reason: string | null;
  created_at: string;
  processed_at: string | null;
  updated_at: string;
}

/**
 * Tracks the Paystack refund record for every order belonging to a given storefront,
 * keyed by order_id. Backed directly by the `paystack_refunds` table so refund state
 * survives page reloads and updates live as Paystack's webhook moves a refund from
 * pending -> processing -> processed/failed.
 */
export function useStorefrontRefunds(storefrontId: string | undefined, orderIds: string[] = []) {
  const [refundsByOrderId, setRefundsByOrderId] = useState<Record<string, StorefrontRefundRecord>>({});

  const fetchRefunds = useCallback(async () => {
    if (!storefrontId && orderIds.length === 0) return;
    let query = supabase
      .from("paystack_refunds")
      .select("id, order_id, status, amount, paystack_reference, reason, created_at, processed_at, updated_at");
    const { data, error } = storefrontId
      ? await query.eq("storefront_id", storefrontId)
      : await query.in("order_id", orderIds);
    if (error) {
      console.log("[v0] Failed to load storefront refunds:", error.message);
      return;
    }
    const map: Record<string, StorefrontRefundRecord> = {};
    for (const row of data || []) map[row.order_id] = row as StorefrontRefundRecord;
    setRefundsByOrderId(map);
  }, [storefrontId, orderIds.join(",")]);

  useEffect(() => {
    fetchRefunds();
    if (!storefrontId && orderIds.length === 0) return;
    const channel = supabase
      .channel(`paystack-refunds-${storefrontId || "customer"}`)
      .on(
        "postgres_changes",
        storefrontId
          ? { event: "*", schema: "public", table: "paystack_refunds", filter: `storefront_id=eq.${storefrontId}` }
          : { event: "*", schema: "public", table: "paystack_refunds" },
        () => fetchRefunds()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [storefrontId, orderIds.join(","), fetchRefunds]);

  // Optimistically record a refund the instant it is submitted so the button flips to a
  // status badge immediately, even before the DB round-trip / realtime event lands.
  const setOptimisticRefund = useCallback((orderId: string, refund: Partial<StorefrontRefundRecord>) => {
    setRefundsByOrderId((current) => ({
      ...current,
      [orderId]: {
        id: refund.id || current[orderId]?.id || orderId,
        order_id: orderId,
        status: refund.status || "pending",
        amount: refund.amount ?? current[orderId]?.amount ?? 0,
        paystack_reference: refund.paystack_reference ?? current[orderId]?.paystack_reference ?? "",
        reason: refund.reason ?? current[orderId]?.reason ?? null,
        created_at: refund.created_at || current[orderId]?.created_at || new Date().toISOString(),
        processed_at: refund.processed_at ?? current[orderId]?.processed_at ?? null,
        updated_at: new Date().toISOString(),
      },
    }));
  }, []);

  // Roll back the optimistic entry if the refund request actually failed.
  const clearRefund = useCallback((orderId: string) => {
    setRefundsByOrderId((current) => {
      const next = { ...current };
      delete next[orderId];
      return next;
    });
  }, []);

  return { refundsByOrderId, refetchRefunds: fetchRefunds, setOptimisticRefund, clearRefund };
}
