'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, Eye } from 'lucide-react';

interface AFARegistration {
  id: string;
  customer_name: string;
  customer_phone: string;
  ghana_card: string;
  date_of_birth: string;
  region: string;
  crop: string;
  town: string;
  occupation: string;
  amount_paid: number;
  registration_status: string;
  created_at: string;
}

interface SubSubagentAFABundleRegistrationsProps {
  subsubagentStoreId: string;
  primaryColor?: string;
}

export default function SubSubagentAFABundleRegistrations({
  subsubagentStoreId,
  primaryColor = '#000000',
}: SubSubagentAFABundleRegistrationsProps) {
  const [registrations, setRegistrations] = useState<AFARegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegistration, setSelectedRegistration] = useState<AFARegistration | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [myBundlePrice, setMyBundlePrice] = useState(0);
  const [myCostFromSubagent, setMyCostFromSubagent] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (!subsubagentStoreId) return;
    loadRegistrations();
    loadPriceInfo();
    const interval = setInterval(loadRegistrations, 30000);
    return () => clearInterval(interval);
  }, [subsubagentStoreId]);

  const loadPriceInfo = async () => {
    try {
      const { data: store } = await supabase
        .from('sub_subagent_stores')
        .select('afa_bundle_price, subagent_store_id')
        .eq('id', subsubagentStoreId)
        .single();
      if (!store) return;
      setMyBundlePrice(Number((store as any).afa_bundle_price) || 0);
      if (store.subagent_store_id) {
        const { data: parentStore } = await supabase
          .from('subagent_stores')
          .select('afa_subsubagent_base_price, afa_bundle_price')
          .eq('id', store.subagent_store_id)
          .single();
        if (parentStore) {
          const cost = (parentStore as any).afa_subsubagent_base_price || parentStore.afa_bundle_price || 0;
          setMyCostFromSubagent(Number(cost));
        }
      }
    } catch (err) {
      console.error('[SubSubagentAFABundleRegistrations] loadPriceInfo error:', err);
    }
  };

  const loadRegistrations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('afa_registrations')
        .select('*')
        .eq('sub_subagent_store_id', subsubagentStoreId)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;
      setRegistrations(data || []);
    } catch (err: any) {
      console.error('[SubSubagentAFABundleRegistrations] loadRegistrations error:', err);
      toast({ title: 'Error', description: 'Failed to load AFA registrations', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredRegistrations = registrations.filter((reg) => {
    const q = searchTerm.toLowerCase();
    return (
      (reg.customer_name?.toLowerCase().includes(q) || false) ||
      (reg.customer_phone?.includes(searchTerm) || false) ||
      (reg.ghana_card?.includes(searchTerm) || false) ||
      (reg.region?.toLowerCase().includes(q) || false)
    );
  });

  const exportToCSV = () => {
    if (filteredRegistrations.length === 0) {
      toast({ title: 'No data', description: 'No registrations to export', variant: 'destructive' });
      return;
    }
    const headers = ['Date', 'Customer Name', 'Phone', 'Ghana Card', 'DOB', 'Town', 'Occupation', 'Region', 'Crop', 'Amount Paid', 'Status'];
    const rows = filteredRegistrations.map((reg) => [
      new Date(reg.created_at).toLocaleString(),
      reg.customer_name, reg.customer_phone, reg.ghana_card,
      reg.date_of_birth, reg.town, reg.occupation, reg.region, reg.crop,
      `GHC${reg.amount_paid.toFixed(2)}`, reg.registration_status,
    ]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `afa-registrations-subsubagent-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${filteredRegistrations.length} registrations exported` });
  };

  if (loading && registrations.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const completedCount = registrations.filter((r) => r.registration_status === 'completed').length;
  const pendingCount = registrations.filter((r) => r.registration_status === 'pending').length;
  const totalRevenue = registrations.reduce((sum, r) => sum + (r.amount_paid || 0), 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Total Registrations</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" style={{ color: primaryColor }}>{registrations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Completed</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-green-600">{completedCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Pending</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-yellow-600">{pendingCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Total Revenue</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" style={{ color: primaryColor }}>GHC{totalRevenue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Table */}
      <Card>
        <CardHeader>
          <CardTitle>AFA Bundle Registrations</CardTitle>
          <CardDescription>All AFA registrations through your storefront</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Input
              className="flex-1"
              placeholder="Search by name, phone, Ghana card, or region..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button onClick={exportToCSV} variant="outline" disabled={filteredRegistrations.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            Showing {filteredRegistrations.length} of {registrations.length} registrations
          </div>

          {filteredRegistrations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No AFA registrations found</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Amount Paid</TableHead>
                    <TableHead>Your Price</TableHead>
                    <TableHead>Profit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegistrations.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell className="text-sm">{new Date(reg.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-sm font-medium">{reg.customer_name}</TableCell>
                      <TableCell className="text-sm">{reg.customer_phone}</TableCell>
                      <TableCell className="text-sm">{reg.region}</TableCell>
                      <TableCell className="text-sm font-medium">GHC{reg.amount_paid.toFixed(2)}</TableCell>
                      <TableCell className="text-sm text-blue-600 font-medium">
                        {myBundlePrice > 0 ? `GHC${myBundlePrice.toFixed(2)}` : '—'}
                      </TableCell>
                      <TableCell className="text-sm font-bold text-green-600">
                        {myBundlePrice > 0 && myCostFromSubagent > 0
                          ? `GHC${Math.max(0, myBundlePrice - myCostFromSubagent).toFixed(2)}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={reg.registration_status === 'completed' ? 'default' : reg.registration_status === 'pending' ? 'secondary' : 'destructive'}>
                          {reg.registration_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedRegistration(reg); setShowDetails(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      {showDetails && selectedRegistration && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="sticky top-0 bg-background border-b">
              <CardTitle>Registration Details</CardTitle>
              <button onClick={() => setShowDetails(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                &times;
              </button>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Customer Name', selectedRegistration.customer_name],
                  ['Phone', selectedRegistration.customer_phone],
                  ['Ghana Card', selectedRegistration.ghana_card],
                  ['Date of Birth', selectedRegistration.date_of_birth],
                  ['Region', selectedRegistration.region],
                  ['Town', selectedRegistration.town],
                  ['Occupation', selectedRegistration.occupation],
                  ['Crop', selectedRegistration.crop],
                  ['Amount Paid', `GHC${selectedRegistration.amount_paid.toFixed(2)}`],
                  ['Status', selectedRegistration.registration_status],
                  ['Date', new Date(selectedRegistration.created_at).toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="font-medium">{value}</p>
                  </div>
                ))}
              </div>
              <Button className="w-full" onClick={() => setShowDetails(false)}>Close</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
