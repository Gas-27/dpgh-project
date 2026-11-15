import { useEffect, useRef } from "react";
import { WALLET_CHANGED_EVENT } from "@/lib/wallet";

const POLL_INTERVAL_MS = 4000;

// Keeps a dashboard's wallet balance live. It re-reads the balance whenever a purchase signals a
// change, when the tab becomes visible again, and on a short timer as a safety net for purchases
// whose money is taken on the server (SMS, scheduled sends, social boost, and so on).
export function useWalletSync(refresh: () => void | Promise<void>, enabled: boolean) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;

    let inFlight = false;
    const run = async () => {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        await refreshRef.current();
      } finally {
        inFlight = false;
      }
    };

    const onChanged = () => {
      void run();
      // The server can finish writing the debit a moment after the call returns.
      window.setTimeout(() => void run(), 1500);
    };

    window.addEventListener(WALLET_CHANGED_EVENT, onChanged);
    document.addEventListener("visibilitychange", run);
    window.addEventListener("focus", run);
    const timer = window.setInterval(run, POLL_INTERVAL_MS);

    return () => {
      window.removeEventListener(WALLET_CHANGED_EVENT, onChanged);
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("focus", run);
      window.clearInterval(timer);
    };
  }, [enabled]);
}
