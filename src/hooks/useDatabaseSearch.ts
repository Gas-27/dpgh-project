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
      // Parse multiple search terms (comma, newline, or space separated)
      const searchTerms = query
        .split(/[,\n\s]+/)
        .map(term => term.trim())
        .filter(term => term.length > 0);

      if (searchTerms.length === 0) {
        setResults([]);
        return;
      }

      // If single term, use simple ilike
      if (searchTerms.length === 1) {
        const { data, error: searchError } = await supabase
          .from(table)
          .select(selectColumns)
          .ilike(searchColumn, `%${searchTerms[0]}%`)
          .order('created_at', { ascending: false })
          .limit(100);

        if (searchError) throw searchError;
        setResults((data as T[]) || []);
        console.log(`[v0] Database search: ${table}.${searchColumn} = "${searchTerms[0]}" - Found ${data?.length || 0} results`);
      } else {
        // For multiple terms, fetch all matches and combine
        const allResults: T[] = [];
        const seenIds = new Set();

        for (const term of searchTerms) {
          const { data, error: searchError } = await supabase
            .from(table)
            .select(selectColumns)
            .ilike(searchColumn, `%${term}%`)
            .order('created_at', { ascending: false })
            .limit(100);

          if (searchError) throw searchError;

          if (data) {
            for (const item of data) {
              const id = (item as any)?.id;
              if (id && !seenIds.has(id)) {
                seenIds.add(id);
                allResults.push(item as T);
              }
            }
          }
        }

        // Sort final combined results by created_at descending
        allResults.sort((a, b) => {
          const dateA = new Date((a as any)?.created_at || 0).getTime();
          const dateB = new Date((b as any)?.created_at || 0).getTime();
          return dateB - dateA;
        });

        setResults(allResults);
        console.log(`[v0] Database search: ${table}.${searchColumn} - Multiple terms [${searchTerms.join(', ')}] - Found ${allResults.length} results`);
      }
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
