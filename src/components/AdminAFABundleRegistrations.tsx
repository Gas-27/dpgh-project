import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2, Search } from 'lucide-react';

interface AFARegistration {
  id: string;
  customer_name: string;
  customer_phone: string;
  region: string;
  crop: string;
  registration_status: string;
  afa_package_id: string;
  agent_store_id?: string;
  subagent_store_id?: string;
  store_name?: string;
  created_at: string;
  amount_paid?: number;
}

export default function AdminAFABundleRegistrations() {
  const [registrations, setRegistrations] = useState<AFARegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('afa_registrations')
        .select(`
          id,
          customer_name,
          customer_phone,
          region,
          crop,
          registration_status,
          afa_package_id,
          agent_store_id:agent_store_id(store_name),
          subagent_store_id:subagent_store_id(store_name),
          created_at,
          amount_paid
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Flatten the data structure
      const flatData = (data || []).map((reg: any) => ({
        ...reg,
        store_name: reg.agent_store_id?.store_name || reg.subagent_store_id?.store_name || 'Unknown',
        agent_store_id: reg.agent_store_id?.id,
        subagent_store_id: reg.subagent_store_id?.id,
      }));

      setRegistrations(flatData);
    } catch (err) {
      console.error('[v0] Failed to fetch registrations:', err);
      toast({ title: 'Error', description: 'Failed to load registrations', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const filteredRegistrations = registrations.filter((reg) =>
    reg.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reg.customer_phone.includes(searchTerm) ||
    reg.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reg.store_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToCSV = () => {
    const headers = [
      'Date',
      'Customer Name',
      'Phone',
      'Region',
      'Crop',
      'Store',
      'Status',
      'Amount Paid',
    ];

    const rows = filteredRegistrations.map((reg) => [
      new Date(reg.created_at).toLocaleDateString(),
      reg.customer_name,
      reg.customer_phone,
      reg.region,
      reg.crop,
      reg.store_name,
      reg.registration_status,
      reg.amount_paid || 'N/A',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `afa_registrations_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: 'Success', description: 'Registrations exported to CSV' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-600">Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-600">Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">AFA Bundle Registrations</h3>
          <p className="text-sm text-muted-foreground">View and manage all AFA registrations across all stores</p>
        </div>
        <Button onClick={exportToCSV} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone, region, or store..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredRegistrations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No registrations found</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Crop</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Amount Paid</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell>{new Date(reg.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{reg.customer_name}</TableCell>
                    <TableCell>{reg.customer_phone}</TableCell>
                    <TableCell>{reg.region}</TableCell>
                    <TableCell>{reg.crop}</TableCell>
                    <TableCell className="text-sm">{reg.store_name}</TableCell>
                    <TableCell>GH₵{reg.amount_paid?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>{getStatusBadge(reg.registration_status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{filteredRegistrations.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {filteredRegistrations.filter((r) => r.registration_status === 'completed').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {filteredRegistrations.filter((r) => r.registration_status === 'pending').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              GH₵{filteredRegistrations.reduce((sum, r) => sum + (r.amount_paid || 0), 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
