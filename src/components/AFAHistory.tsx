'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startVisiblePolling } from '@/lib/visiblePolling';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, Loader2, RefreshCw } from 'lucide-react';

interface AFAHistoryRow {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_id: string | null;
  region: string | null;
  registration_status: string | null;
  amount_paid: number | null;
  source: string | null;
  created_at: string;
}

const sourceLabel = (source: string | null) => {
  const s = (source || '').toLowerCase();
  if (s.includes('api')) return 'API';
  if (s === 'wallet') return 'Wallet';
  return 'Storefront';
};

const statusVariant = (status: string | null) => {
  if (status === 'completed') return 'default' as const;
  if (status === 'pending' || status === 'processing') return 'secondary' as const;
  return 'destructive' as const;
};

interface AFAHistoryProps {
  refreshKey?: number;
  title?: string;
}

export default function AFAHistory({ refreshKey = 0, title = 'AFA History' }: AFAHistoryProps) {
  const [rows, setRows] = useState<AFAHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc('my_afa_history' as any);
    if (rpcError) {
      setError('Could not load your AFA history. Pull to refresh or try again.');
    } else {
      setError(null);
      setRows((data as AFAHistoryRow[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
    return startVisiblePolling(load, 60_000);
  }, [load, refreshKey]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>
            Registrations made from your wallet and through the API appear here.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); load(); }} aria-label="Refresh AFA history">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="py-6 text-center text-sm text-destructive">{error}</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No AFA registrations yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Ghana Card</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm">{new Date(r.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-sm font-medium">{r.customer_name}</TableCell>
                    <TableCell className="text-sm">{r.customer_phone}</TableCell>
                    <TableCell className="font-mono text-xs">{r.customer_id}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">GHC {Number(r.amount_paid || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{sourceLabel(r.source)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.registration_status)}>{r.registration_status || 'pending'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
