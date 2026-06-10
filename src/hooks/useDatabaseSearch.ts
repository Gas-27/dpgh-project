'use client';

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook for searching data directly from Supabase
 * Used across admin, agent, and subagent dashboards
 */
export function useDatabaseSearch<T>(
  table: string,
  searchColumn: string,
  selectColumns: string = '*'
) {
  const [results, setResults] = useState<T[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (query: string) => {
    if (!query || query.length === 0) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      // Use ilike for case-insensitive search, sorted by created_at descending (newest first)
      const { data, error: searchError } = await supabase
        .from(table)
        .select(selectColumns)
        .ilike(searchColumn, `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (searchError) {
        throw searchError;
      }

      setResults((data as T[]) || []);
      console.log(`[v0] Database search: ${table}.${searchColumn} = "${query}" - Found ${data?.length || 0} results`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Search failed';
      console.error('[v0] Database search error:', err);
      setError(errorMsg);
    } finally {
      setIsSearching(false);
    }
  };

  return { results, isSearching, error, search };
}
