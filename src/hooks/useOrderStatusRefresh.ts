import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { supabase } from "@/integrations/supabase/client";

type TrackableOrder = {
  id: string;
  provider_reference?: string | null;
  order_status?: string | null;
  status?: string | null;
  fulfillment_status?: string | null;
};

const CHECKABLE_STATUSES = new Set(["processing", "pending", "waiting"]);
export function useOrderStatusRefresh<T extends TrackableOrder>(
  orders: T[],
  setOrders: Dispatch<SetStateAction<T[]>>,
) {
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const checkedReferences = useRef(new Set<string>());

  useEffect(() => {
    const candidates = orders.filter((order) => {
      const reference = order.provider_reference?.trim();
      const status = String(order.order_status ?? order.status ?? order.fulfillment_status ?? "").toLowerCase();
      return Boolean(reference) && CHECKABLE_STATUSES.has(status) && !checkedReferences.current.has(reference);
    });

    if (candidates.length === 0) return;
    const references = candidates.map((order) => order.provider_reference!.trim());
    references.forEach((reference) => checkedReferences.current.add(reference));
    setCheckingIds((current) => new Set([...current, ...candidates.map((order) => order.id)]));

    void Promise.all(candidates.map(async (order) => {
      const reference = order.provider_reference!.trim();
      try {
        const request = supabase.functions.invoke("check-order", {
          body: { reference },
        });
        const { data: result, error } = await Promise.race([
          request,
          new Promise<{ data: null; error: Error }>((_, reject) => window.setTimeout(() => reject(new Error("status check timeout")), 8000)),
        ]);
        if (error) return;
        if (result?.success === true && result?.checked === true && result.order_status) {
          const nextStatus = String(result.order_status).toLowerCase();
          setOrders((current) => current.map((item) => item.id === order.id
            ? { ...item, status: nextStatus, order_status: nextStatus, fulfillment_status: nextStatus }
            : item));
        }
      } catch {
        // Keep the existing status silently on timeout or request failure.
      } finally {
        setCheckingIds((current) => {
          const next = new Set(current);
          next.delete(order.id);
          return next;
        });
      }
    }));

    return undefined;
  }, [orders, setOrders]);

  return checkingIds;
}
