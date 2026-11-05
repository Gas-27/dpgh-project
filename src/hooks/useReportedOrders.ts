import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const ORDER_REPORTED_EVENT = "order-reported";

const CHUNK_SIZE = 200;

async function fetchReportedOrderIds(orderIds: string[]): Promise<string[]> {
  const reported: string[] = [];
  for (let i = 0; i < orderIds.length; i += CHUNK_SIZE) {
    const chunk = orderIds.slice(i, i + CHUNK_SIZE);
    const { data, error } = await (supabase as any).rpc("get_reported_order_ids", { p_order_ids: chunk });
    if (error) throw error;
    for (const row of (data ?? []) as Array<{ order_id: string }>) reported.push(String(row.order_id));
  }
  return reported;
}

export function announceOrderReported(orderId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ORDER_REPORTED_EVENT, { detail: { orderId } }));
}

/**
 * Tells which of the given orders already have a report, so every "Report" button across the
 * site can show "Already reported" instead of letting the same order be reported twice.
 */
export function useReportedOrders(orders: Array<{ id?: string | number | null }> | undefined | null) {
  const queryClient = useQueryClient();
  const [localReported, setLocalReported] = useState<Set<string>>(() => new Set());

  const orderIds = useMemo(() => {
    const ids = new Set<string>();
    for (const order of orders ?? []) if (order?.id) ids.add(String(order.id));
    return Array.from(ids).sort();
  }, [orders]);

  const idsKey = orderIds.join(",");

  const { data: serverReported } = useQuery({
    queryKey: ["reported-order-ids", idsKey],
    queryFn: () => fetchReportedOrderIds(orderIds),
    enabled: orderIds.length > 0,
    staleTime: 30_000,
  });

  useEffect(() => {
    const onReported = (event: Event) => {
      const orderId = (event as CustomEvent<{ orderId?: string }>).detail?.orderId;
      if (!orderId) return;
      setLocalReported((prev) => new Set(prev).add(String(orderId)));
      void queryClient.invalidateQueries({ queryKey: ["reported-order-ids"] });
    };
    window.addEventListener(ORDER_REPORTED_EVENT, onReported);
    return () => window.removeEventListener(ORDER_REPORTED_EVENT, onReported);
  }, [queryClient]);

  const reportedIds = useMemo(() => {
    const merged = new Set<string>(serverReported ?? []);
    localReported.forEach((id) => merged.add(id));
    return merged;
  }, [serverReported, localReported]);

  return {
    reportedIds,
    isReported: (orderId: string | number | null | undefined) => (orderId ? reportedIds.has(String(orderId)) : false),
  };
}
