const RELOAD_KEY = "chunk_reload_at";
const RELOAD_WINDOW_MS = 15000;

const CHUNK_ERROR_PATTERN =
  /importing a module script failed|failed to fetch dynamically imported module|error loading dynamically imported module|loading chunk [\w-]+ failed|loading css chunk|unable to preload css|dynamically imported module/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message = typeof error === "string" ? error : (error as { message?: string }).message ?? "";
  const name = typeof error === "object" ? (error as { name?: string }).name ?? "" : "";
  return name === "ChunkLoadError" || CHUNK_ERROR_PATTERN.test(message);
}

/** True when a recovery reload is allowed right now (at most once per window to avoid reload loops). */
export function canAutoRecover(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    return Date.now() - last > RELOAD_WINDOW_MS;
  } catch {
    return true;
  }
}

/**
 * A stale deploy leaves the browser (or the service worker cache) pointing at chunk files that no
 * longer exist. Drop the service worker and its caches, then reload so the fresh bundle is fetched.
 */
export async function recoverFromStaleBundle(options: { force?: boolean } = {}): Promise<boolean> {
  if (!options.force && !canAutoRecover()) return false;
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage can be blocked (private mode); reload anyway
  }
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // best effort only
  }
  window.location.reload();
  return true;
}
