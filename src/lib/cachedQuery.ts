const DEFAULT_TTL_MS = 5 * 60 * 1000;

type CacheEntry = { value: unknown; expiresAt: number };

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

const clone = <T>(value: T): T => {
  if (value === null || typeof value !== "object") return value;
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
};

/**
 * Runs a Supabase query (or any promise returning `{ data, error }`) through a small
 * in-memory cache. Concurrent callers with the same key share one request, and
 * successful results are reused for `ttlMs` (default 5 minutes). Results with an
 * `error` are never cached. Returned data is cloned so callers can safely mutate it.
 */
export async function cachedQuery<T extends { error?: unknown }>(
  key: string,
  fetcher: () => PromiseLike<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return clone(hit.value as T);

  let pending = inFlight.get(key) as Promise<T> | undefined;
  if (!pending) {
    pending = Promise.resolve(fetcher())
      .then((result) => {
        if (result && !result.error) cache.set(key, { value: result, expiresAt: Date.now() + ttlMs });
        return result;
      })
      .finally(() => {
        inFlight.delete(key);
      });
    inFlight.set(key, pending);
  }
  return clone(await pending);
}

/**
 * Drops every cached entry whose key equals or starts with one of the given prefixes.
 * Call this after an admin saves a change so the next read hits the database.
 */
export function invalidateCache(...prefixes: string[]): void {
  for (const key of Array.from(cache.keys())) {
    if (prefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}:`))) cache.delete(key);
  }
  for (const key of Array.from(inFlight.keys())) {
    if (prefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}:`))) inFlight.delete(key);
  }
}
