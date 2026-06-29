import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DataPackage {
  id: string;
  network: string;
  size_gb: number;
  size_gb_text?: string;
  price: number;
  agent_price?: number;
  api_price?: number;
  active: boolean;
  data_package_id?: string;
}

/**
 * Hook for real-time package updates
 * Subscribes to data_packages table changes and updates state instantly
 */
export const useRealtimePackages = (initialPackages: DataPackage[] = []) => {
  const [packages, setPackages] = useState<DataPackage[]>(initialPackages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to all changes on data_packages table
    const channel = supabase
      .channel('data_packages_realtime')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events: INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'data_packages',
        },
        (payload) => {
          console.log('[v0] Package update received:', payload);

          if (payload.eventType === 'UPDATE') {
            // Update existing package
            setPackages((prev) =>
              prev.map((pkg) =>
                pkg.id === payload.new.id
                  ? { ...pkg, ...payload.new }
                  : pkg
              )
            );
          } else if (payload.eventType === 'INSERT') {
            // Add new package
            setPackages((prev) => [...prev, payload.new as DataPackage]);
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted package
            setPackages((prev) => prev.filter((pkg) => pkg.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        console.log('[v0] Realtime subscription status:', status);
        if (status === 'CHANNEL_ERROR') {
          setError('Failed to subscribe to real-time updates');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { packages, loading, error };
};

/**
 * Hook for fetching packages with real-time updates
 */
export const useFetchRealtimePackages = (filters?: {
  network?: string;
  active?: boolean;
}) => {
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from('data_packages')
          .select('*')
          .order('size_gb');

        if (filters?.network) {
          query = query.eq('network', filters.network);
        }
        if (filters?.active !== undefined) {
          query = query.eq('active', filters.active);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        setPackages(data || []);
        setError(null);
      } catch (err) {
        console.error('[v0] Error fetching packages:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch packages');
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, [filters?.network, filters?.active]);

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('data_packages_realtime_fetch')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'data_packages',
        },
        (payload) => {
          console.log('[v0] Real-time package change:', payload);

          if (payload.eventType === 'UPDATE') {
            setPackages((prev) =>
              prev.map((pkg) =>
                pkg.id === payload.new.id
                  ? { ...pkg, ...payload.new }
                  : pkg
              )
            );
          } else if (payload.eventType === 'INSERT') {
            const newPackage = payload.new as DataPackage;
            
            // Check if it matches filters
            if (filters?.network && newPackage.network !== filters.network) return;
            if (filters?.active !== undefined && newPackage.active !== filters.active) return;

            setPackages((prev) => [...prev, newPackage].sort((a, b) => a.size_gb - b.size_gb));
          } else if (payload.eventType === 'DELETE') {
            setPackages((prev) => prev.filter((pkg) => pkg.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[v0] Realtime subscription error');
          setError('Failed to subscribe to real-time updates');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filters?.network, filters?.active]);

  return { packages, loading, error };
};
