import { useEffect, useSyncExternalStore } from "react";
import { DOMAINS } from "@/config/domains";

export type GameHubStoreContext = {
  kind: "agent" | "subagent" | "subsubagent";
  // For "agent" this is the agent store, otherwise the subagent store new sign-ups join.
  storeId: string;
  // The sub-subagent's own store id, set only when kind is "subsubagent".
  ownStoreId?: string;
  storeName: string;
  // The subagent store a sub-subagent store belongs to, set only when kind is "subsubagent".
  parentStoreName?: string;
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
  const key = value ? `${value.kind}:${value.storeId}:${value.ownStoreId ?? ""}:${value.storeName}:${value.parentStoreName ?? ""}:${value.primaryColor}:${value.primaryForeground}` : "";
  useEffect(() => {
    setContext(value);
    return () => setContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Where a visitor goes to sign up as an agent of the store they are playing from. */
export function getBecomeAgentUrl(ctx: GameHubStoreContext | null): string {
  if (!ctx) return "/signup";
  if (ctx.kind === "agent") return `${DOMAINS.getAgentStoreUrl(ctx.storeName)}/become-agent`;
  if (ctx.kind === "subagent") return `${DOMAINS.getSubagentStoreUrl(ctx.storeName)}/become-agent`;
  return ctx.parentStoreName ? `${DOMAINS.getSubagentStoreUrl(ctx.parentStoreName)}/become-agent` : "/signup";
}
