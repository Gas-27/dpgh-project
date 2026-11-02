import { useEffect, useSyncExternalStore } from "react";

export type GameHubStoreContext = {
  kind: "agent" | "subagent" | "subsubagent";
  // For "agent" this is the agent store, otherwise the subagent store new sign-ups join.
  storeId: string;
  storeName: string;
  primaryColor: string;
  primaryForeground: string;
};

let current: GameHubStoreContext | null = null;
const listeners = new Set<() => void>();

function setContext(next: GameHubStoreContext | null) {
  current = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useGameHubStoreContext(): GameHubStoreContext | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/** Called by storefront pages so Game Hub knows which store the visitor came from. */
export function useProvideGameHubStore(value: GameHubStoreContext | null) {
  const key = value ? `${value.kind}:${value.storeId}:${value.storeName}:${value.primaryColor}:${value.primaryForeground}` : "";
  useEffect(() => {
    setContext(value);
    return () => setContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
