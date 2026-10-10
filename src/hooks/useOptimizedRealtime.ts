import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook for optimized realtime subscriptions with debouncing
 * Prevents excessive refreshes when multiple changes occur rapidly
 * 
 * @param callback - Function to call after debounce period
 * @param debounceMs - Milliseconds to wait before executing callback (default: 2000)
 * @param tables - Array of table names to listen to
 * @returns Cleanup function
 */
export function useOptimizedRealtime(
  callback: () => void,
  debounceMs: number = 2000,
  tables: { name: string; filter?: { column: string; value: string } }[] = []
) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const channelsRef = useRef<any[]>([]);
  const subscriptionSetupRef = useRef(false);

  useEffect(() => {
    if (tables.length === 0 || subscriptionSetupRef.current) return;

    subscriptionSetupRef.current = true;

    // Create debounced callback
    const debouncedCallback = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        console.log('[v0] Realtime update triggered, refreshing data...');
        callback();
      }, debounceMs);
    };

    // Subscribe to each table
    tables.forEach(({ name, filter }) => {
      const channel = supabase.channel(`optimized-${name}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: name,
            ...(filter && { filter: `${filter.column}=eq.${filter.value}` }),
          },
          () => debouncedCallback()
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[v0] Subscribed to ${name} updates`);
          }
        });

      channelsRef.current.push(channel);
    });

    // Cleanup
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      channelsRef.current.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
      subscriptionSetupRef.current = false;
    };
  }, []); // Empty dependency array - setup once on mount
}

/**
 * Hook to optimize database queries by selecting only needed columns
 * Reduces network transfer and parsing time
 */
export function useOptimizedQuery(query: any, columns: string[]) {
  const selectStatement = columns.join(', ');
  return query.select(selectStatement);
}

/**
 * Hook for parallel query execution with proper error handling
 * Executes all queries simultaneously instead of sequentially
 */
export async function executeParallelQueries(queries: Promise<any>[]) {
  try {
    const results = await Promise.all(queries);
    return results;
  } catch (error) {
    console.error('[v0] Parallel query execution error:', error);
    throw error;
  }
}
