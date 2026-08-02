import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2, Search, RotateCcw, Flag, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { retryAFARegistration } from '@/services/afa-service';

interface AFAReport {
  id: string;
  customer_phone: string;
  customer_name?: string;
  registration_id?: string;
  dialed_1848: boolean;
  notes?: string;
  status: 'pending' | 'resolved';
  created_at: string;
  afa_registrations?: { customer_name: string; customer_phone: string; registration_status: string };
}

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
  const [retrying, setRetrying] = useState<string | null>(null);
  const [reports, setReports] = useState<AFAReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [resolvingReport, setResolvingReport] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchRegistrations();
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const { data, error } = await supabase
        .from('afa_registration_reports')
        .select(`
          id, customer_phone, customer_name, registration_id, dialed_1848, notes, status, created_at,
          afa_registrations(customer_name, customer_phone, registration_status)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReports((data as AFAReport[]) || []);
    } catch (err) {
      console.error('[v0] AFA reports fetch error:', err);
    } finally {
      setReportsLoading(false);
    }
  };

  const resolveReport = async (id: string) => {
    setResolvingReport(id);
    const { error } = await supabase
      .from('afa_registration_reports')
      .update({ status: 'resolved' })
      .eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setReports(reports.map(r => r.id === id ? { ...r, status: 'resolved' } : r));
      toast({ title: 'Marked as resolved' });
    }
    setResolvingReport(null);
  };

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
          town,
          crop,
          occupation,
          date_of_birth,
          registration_status,
          afa_package_id,
          afa_ref_id,
          agent_profit,
          payment_reference,
          agent_store_id,
          subagent_store_id,
          created_at,
          updated_at,
          amount_paid,
          agent_stores!agent_store_id(store_name),
          subagent_stores!subagent_store_id(store_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Flatten joined store names without overwriting direct column values
      const flatData = (data || []).map((reg: any) => ({
        ...reg,
        store_name:
          (reg.agent_stores as any)?.store_name ||
          (reg.subagent_stores as any)?.store_name ||
          'N/A',
      }));

      setRegistrations(flatData);
    } catch (err) {
      console.error('[v0] Failed to fetch registrations:', err);
      toast({ title: 'Error', description: 'Failed to load registrations', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const s = searchTerm.toLowerCase();
  const filteredRegistrations = registrations.filter((reg) =>
    reg.customer_name?.toLowerCase().includes(s) ||
    reg.customer_phone?.includes(searchTerm) ||
    reg.region?.toLowerCase().includes(s) ||
    (reg as any).town?.toLowerCase().includes(s) ||
    (reg as any).occupation?.toLowerCase().includes(s) ||
    (reg as any).afa_ref_id?.toLowerCase().includes(s) ||
    reg.store_name?.toLowerCase().includes(s)
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

  const handleRetry = async (registrationId: string) => {
    setRetrying(registrationId);
    try {
      const result = await retryAFARegistration(registrationId);
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Registration sent again. Awaiting verification.',
        });
        
        // Update local state
        setRegistrations(registrations.map(reg => 
          reg.id === registrationId 
            ? { ...reg, registration_status: 'pending' }
            : reg
        ));
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to retry registration',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to retry registration',
        variant: 'destructive',
      });
    } finally {
      setRetrying(null);
    }
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

  const pendingReports = reports.filter(r => r.status === 'pending');

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

      <Tabs defaultValue="registrations">
        <TabsList>
          <TabsTrigger value="registrations">Registrations</TabsTrigger>
          <TabsTrigger value="reports" className="relative">
            Reports
            {pendingReports.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingReports.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registrations" className="space-y-6 mt-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, phone number, contact, region, or store..."
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
                  <TableHead>Phone / Contact</TableHead>
                  <TableHead>Region / Town</TableHead>
                  <TableHead>Occupation</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Amount Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell>{new Date(reg.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{reg.customer_name}</TableCell>
                    <TableCell className="font-mono text-sm">{reg.customer_phone || '—'}</TableCell>
                    <TableCell className="text-sm">{reg.region}{(reg as any).town ? `, ${(reg as any).town}` : ''}</TableCell>
                    <TableCell className="text-sm">{(reg as any).occupation || '—'}</TableCell>
                    <TableCell className="text-sm">{reg.store_name}</TableCell>
                    <TableCell>GHC{reg.amount_paid?.toFixed(2) || '0.00'}</TableCell>
                    <TableCell>{getStatusBadge(reg.registration_status)}</TableCell>
                    <TableCell>
                      {reg.registration_status === 'failed' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRetry(reg.id)}
                          disabled={retrying === reg.id}
                          className="gap-1"
                        >
                          {retrying === reg.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                          {retrying === reg.id ? 'Retrying...' : 'Retry'}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {filteredRegistrations.filter((r) => r.registration_status === 'failed').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              GHC{filteredRegistrations.reduce((sum, r) => sum + (r.amount_paid || 0), 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4 mt-4">
          <div>
            <h4 className="text-base font-semibold">AFA Registration Reports</h4>
            <p className="text-sm text-muted-foreground">Reports submitted by customers who say their AFA registration is not showing after approval.</p>
          </div>

          {/* Important notice */}
          <Card className="border-amber-500/40 bg-amber-500/10">
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold">Before resolving a report, confirm the customer has dialed *1848#</p>
                  <p>When a registration shows as <strong>Approved</strong>, it means MTN has confirmed it. The customer must dial <strong>*1848#</strong> to verify — if they see AFA bundles there, their registration is active and they can buy directly from that menu.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {reportsLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : reports.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No AFA registration reports yet.</CardContent></Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer Phone</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Dialed *1848#</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{r.customer_phone}</TableCell>
                      <TableCell>{r.customer_name || r.afa_registrations?.customer_name || '—'}</TableCell>
                      <TableCell>
                        {r.dialed_1848
                          ? <Badge className="bg-green-600 text-white">Yes</Badge>
                          : <Badge variant="destructive">No</Badge>}
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{r.notes || '—'}</TableCell>
                      <TableCell>
                        {r.status === 'resolved'
                          ? <Badge className="bg-green-600 text-white"><CheckCircle className="h-3 w-3 mr-1" />Resolved</Badge>
                          : <Badge className="bg-yellow-600 text-white"><Clock className="h-3 w-3 mr-1" />Pending</Badge>}
                      </TableCell>
                      <TableCell>
                        {r.status !== 'resolved' && (
                          <Button size="sm" variant="outline" disabled={resolvingReport === r.id} onClick={() => resolveReport(r.id)} className="gap-1">
                            {resolvingReport === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                            Resolve
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
