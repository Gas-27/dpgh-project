import { isSupplierTrackedNetwork } from "@/utils/orderStatus";

export const FINAL_ORDER_STATUSES = new Set([
  "delivered",
  "completed",
  "success",
  "successful",
  "failed",
  "failure",
  "refunded",
  "cancelled",
  "canceled",
]);

export const ORDER_POLL_MAX_DURATION_MS = 30 * 60 * 1000;

export function isFinalOrderStatus(...statuses: Array<string | null | undefined>): boolean {
  return statuses.some((status) => FINAL_ORDER_STATUSES.has(String(status ?? "").trim().toLowerCase()));
}

type PollableOrder = {
  network?: string | null;
  order_status?: string | null;
  status?: string | null;
  fulfillment_status?: string | null;
};

/**
 * MTN Special / Telecel Special: fulfillment_status "completed" and status "paid" only
 * mean the order was handed to the supplier, so only order_status can end polling.
 */
export function isFinalOrder(order: PollableOrder): boolean {
  if (isSupplierTrackedNetwork(order.network)) {
    return isFinalOrderStatus(order.order_status) || isFinalOrderStatus(order.status === "refunded" || order.status === "failed" ? order.status : null);
  }
  return isFinalOrderStatus(order.order_status, order.status, order.fulfillment_status);
}

export function hasUsableReference(reference: string | null | undefined): reference is string {
  return typeof reference === "string" && reference.trim().length > 0 && reference.trim() !== "undefined" && reference.trim() !== "null";
}

/** 10s for the first 2 minutes, 30s until 10 minutes, then 60s until the 30 minute cap. */
export function orderPollDelay(elapsedMs: number): number {
  if (elapsedMs < 2 * 60 * 1000) return 10_000;
  if (elapsedMs < 10 * 60 * 1000) return 30_000;
  return 60_000;
}

type OrderPollingOptions = {
  /** Returns true when polling should continue; return false once every order is final. */
  task: () => Promise<boolean | void> | boolean | void;
  /** Called once when polling stops because the 30 minute cap was reached. */
  onExhausted?: () => void;
};

/**
 * Self-scheduling poll with backoff. Pauses while the tab is hidden, resumes on
 * visibilitychange, stops for good when `task` returns false or the 30 minute
 * cap is hit. Returns a cleanup function that clears every timer and listener.
 */
export function startOrderPolling({ task, onExhausted }: OrderPollingOptions): () => void {
  const startedAt = Date.now();
  let timer: number | undefined;
  let stopped = false;
  let running = false;

  const clearTimer = () => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
  };

  const stop = () => {
    stopped = true;
    clearTimer();
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };

  const schedule = () => {
    clearTimer();
    if (stopped || document.visibilityState !== "visible") return;
    const elapsed = Date.now() - startedAt;
    if (elapsed >= ORDER_POLL_MAX_DURATION_MS) {
      stop();
      onExhausted?.();
      return;
    }
    timer = window.setTimeout(run, orderPollDelay(elapsed));
  };

  const run = async () => {
    timer = undefined;
    if (stopped || running || document.visibilityState !== "visible") return;
    running = true;
    let keepGoing: boolean | void = true;
    try {
      keepGoing = await task();
    } catch {
      keepGoing = true;
    } finally {
      running = false;
    }
    if (stopped) return;
    if (keepGoing === false) {
      stop();
      return;
    }
    schedule();
  };

  function onVisibilityChange() {
    if (stopped) return;
    if (document.visibilityState === "visible") schedule();
    else clearTimer();
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  schedule();

  return stop;
}
