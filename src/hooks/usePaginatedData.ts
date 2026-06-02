'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook for pagination with infinite scroll support
 * Loads data in batches and allows "Load More" functionality
 */
export function usePaginatedData<T>(
  table: string,
  selectColumns: string = '*',
  pageSize: number = 100,
  orderBy?: { column: string; ascending: boolean }
) {
  const [data, setData] = useState<T[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    setError(null);

    try {
      const from = currentPage * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from(table)
        .select(selectColumns)
        .range(from, to);

      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending });
      }

      const { data: newData, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      const newItems = (newData as T[]) || [];
      setData((prev) => [...prev, ...newItems]);
      setCurrentPage((prev) => prev + 1);
      setHasMore(newItems.length === pageSize);

      console.log(`[v0] Loaded page ${currentPage + 1} from ${table} - Got ${newItems.length} items`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load data';
      console.error('[v0] Pagination error:', err);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, table, selectColumns, orderBy, isLoading, hasMore]);

  const reset = useCallback(() => {
    setData([]);
    setCurrentPage(0);
    setHasMore(true);
    setError(null);
  }, []);

  return { data, isLoading, hasMore, error, loadMore, reset };
}
