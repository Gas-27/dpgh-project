import { DOMAINS } from "@/config/domains";

type HubHistoryState = Record<string, unknown> & { __ghDepth?: number; __ghLanding?: boolean };

const GAMEHUB_PATH = /^(.*?)\/gamehub(?:\/([^/]+))?\/?$/;
const CUSTOM_STORE_PREFIX = /^\/__custom\/(?:agent|subagent)\/[^/]+|^\/__custom\/subsubagent\/[^/]+\/[^/]+/;
const SUBSUBAGENT_STORE_PREFIX = /^\/[^/]+\/store\/[^/]+/;

// First path segments on the subagent domain that are app pages, not storefront names.
const NON_STORE_SEGMENTS = new Set([
  "login",
  "sub-subagent-login",
  "reset-password",
  "auth",
  "dashboard",
  "sub-subagent-dashboard",
  "agent",
  "marketplace",
  "private-subscription",
  "service-access",
  "gamehub",
]);

export function parseGameHubPath(pathname: string): { base: string; gameId: string | null } | null {
  const match = pathname.match(GAMEHUB_PATH);
  if (!match) return null;
  let gameId: string | null = null;
  if (match[2]) {
    try {
      gameId = decodeURIComponent(match[2]);
    } catch {
      gameId = match[2];
    }
  }
  return { base: match[1], gameId };
}

/** The storefront prefix Game Hub should hang off, so the link stays on whatever site the player is on. */
export function getGameHubBase(pathname = window.location.pathname, hostname = window.location.hostname.toLowerCase()): string {
  const parsed = parseGameHubPath(pathname);
  if (parsed) return parsed.base;

  const custom = pathname.match(CUSTOM_STORE_PREFIX);
  if (custom) return custom[0];

  const onSubagentDomain = hostname === DOMAINS.SUBAGENT_STORE || hostname.endsWith(`.${DOMAINS.SUBAGENT_STORE}`);
  if (onSubagentDomain) {
    const nested = pathname.match(SUBSUBAGENT_STORE_PREFIX);
    if (nested) return nested[0];
    const first = pathname.split("/")[1];
    if (first && !NON_STORE_SEGMENTS.has(first)) return `/${first}`;
  }
  return "";
}

export function buildGameHubPath(gameId?: string | null): string {
  const base = getGameHubBase();
  return `${base}/gamehub${gameId ? `/${encodeURIComponent(gameId)}` : ""}`;
}

export function buildGameHubShareUrl(gameId?: string | null): string {
  return `${window.location.origin}${buildGameHubPath(gameId)}`;
}

const readState = (): HubHistoryState => (window.history.state ?? {}) as HubHistoryState;

/** Marks a direct visit to a Game Hub URL so closing the popup does not navigate out of the site. */
export function markGameHubLanding() {
  window.history.replaceState({ ...readState(), __ghLanding: true }, "", window.location.href);
}

/** Reflects the open popup (and the selected game) in the address bar. */
export function syncGameHubUrl(gameId: string | null) {
  const target = buildGameHubPath(gameId);
  if (window.location.pathname === target) return;
  const state = readState();
  const onHubPath = parseGameHubPath(window.location.pathname) !== null;
  if (onHubPath && gameId === null) {
    window.history.replaceState(state, "", target);
    return;
  }
  const depth = onHubPath ? (state.__ghDepth ?? 0) + 1 : 1;
  window.history.pushState({ ...state, __ghDepth: depth }, "", target);
}

/** Puts the address bar back where the player was when the popup closes. */
export function leaveGameHubUrl() {
  const parsed = parseGameHubPath(window.location.pathname);
  if (!parsed) return;
  const state = readState();
  const depth = state.__ghDepth ?? 0;
  if (!state.__ghLanding && depth > 0) {
    window.history.go(-depth);
    return;
  }
  const { __ghDepth: _depth, ...rest } = state;
  window.history.replaceState(rest, "", parsed.base || "/");
}
