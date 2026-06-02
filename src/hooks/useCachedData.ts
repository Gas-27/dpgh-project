import { useState, useEffect, useRef } from 'react';

interface CacheEntry<T> {
  data: T | null;
  timestamp: number;
  error: Error | null;
}

const cache = new Map<string, CacheEntry<any>>();

/**
 * Simple SWR-style caching hook without external dependencies
 * Caches data and revalidates in the background
 * 
 * @param key - Cache key (must be unique)
 * @param fetcher - Async function that fetches data
 * @param options - Configuration
 * @returns { data, error, isLoading, mutate }
 */
export function useCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    revalidateInterval?: number; // Ms between revalidations (default: 30000)
    dedupingInterval?: number;   // Ms to dedupe requests (default: 2000)
    fallbackData?: T;            // Initial data
  } = {}
) {
  const { revalidateInterval = 30000, dedupingInterval = 2000, fallbackData } = options;
  
  const [data, setData] = useState<T | null>(fallbackData ?? null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isFetchingRef = useRef(false);
  const revalidateTimeoutRef = useRef<NodeJS.Timeout>();
  const fetchTimeRef = useRef<number>(0);

  const fetchData = async () => {
    // Prevent duplicate requests within deduping interval
    const now = Date.now();
    if (isFetchingRef.current || (now - fetchTimeRef.current < dedupingInterval)) {
      return;
    }

    // Check cache first
    if (cache.has(key)) {
      const cached = cache.get(key)!;
      const age = Date.now() - cached.timestamp;
      
      // Return cached data if fresh (less than 30 seconds old)
      if (age < revalidateInterval) {
        setData(cached.data);
        setError(cached.error);
        console.log(`[v0] Using cached data for ${key} (age: ${Math.round(age / 1000)}s)`);
        return;
      }
    }

    // Fetch new data
    isFetchingRef.current = true;
    setIsLoading(true);
    fetchTimeRef.current = Date.now();

    try {
      console.log(`[v0] Fetching data for ${key}...`);
      const result = await fetcher();
      
      setData(result);
      setError(null);
      
      // Cache the result
      cache.set(key, {
        data: result,
        timestamp: Date.now(),
        error: null,
      });
      
      console.log(`[v0] Successfully fetched and cached ${key}`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      
      // Cache the error too
      cache.set(key, {
        data: null,
        timestamp: Date.now(),
        error,
      });
      
      console.error(`[v0] Failed to fetch ${key}:`, error.message);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }

    // Schedule next revalidation
    if (revalidateTimeoutRef.current) clearTimeout(revalidateTimeoutRef.current);
    revalidateTimeoutRef.current = setTimeout(() => fetchData(), revalidateInterval);
  };

  // Mutate function to update cache manually
  const mutate = (newData: T | null) => {
    setData(newData);
    if (newData !== null) {
      cache.set(key, {
        data: newData,
        timestamp: Date.now(),
        error: null,
      });
    }
    console.log(`[v0] Manually updated cache for ${key}`);
  };

  useEffect(() => {
    fetchData();
    return () => {
      if (revalidateTimeoutRef.current) clearTimeout(revalidateTimeoutRef.current);
    };
  }, [key, fetcher]);

  return { data, error, isLoading, mutate };
}

/**
 * Clear specific cache entry or all cache
 */
export function clearCache(key?: string) {
  if (key) {
    cache.delete(key);
    console.log(`[v0] Cleared cache for ${key}`);
  } else {
    cache.clear();
    console.log('[v0] Cleared all cache');
  }
}

/**
 * Get cache stats for debugging
 */
export function getCacheStats() {
  const stats = {
    entries: cache.size,
    keys: Array.from(cache.keys()),
  };
  return stats;
}
