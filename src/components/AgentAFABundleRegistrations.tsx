'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

interface AgentAFABundleRegistrationsProps {
  agentStoreId: string;
  primaryColor?: string;
}

export default function AgentAFABundleRegistrations({
  agentStoreId,
  primaryColor = '#000000',
}: AgentAFABundleRegistrationsProps) {
  const [registrations, setRegistrations] = useState<AFARegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegistration, setSelectedRegistration] = useState<AFARegistration | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadRegistrations();
    const interval = setInterval(loadRegistrations, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [agentStoreId]);

  const loadRegistrations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('afa_registrations')
        .select('*')
        .eq('agent_store_id', agentStoreId)
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;
      setRegistrations(data || []);
    } catch (err: any) {
      console.error('[v0] Failed to load AFA registrations:', err);
      toast({
        title: 'Error',
        description: 'Failed to load AFA bundle registrations',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredRegistrations = registrations.filter((reg) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      reg.customer_name.toLowerCase().includes(searchLower) ||
      reg.customer_phone.includes(searchTerm) ||
      reg.ghana_card.includes(searchTerm) ||
      reg.region.toLowerCase().includes(searchLower)
    );
  });

  const exportToCSV = () => {
    if (filteredRegistrations.length === 0) {
      toast({
        title: 'No data',
        description: 'No registrations to export',
        variant: 'destructive',
      });
      return;
    }

    const headers = [
      'Date',
      'Customer Name',
      'Phone',
      'Ghana Card',
      'DOB',
      'Town',
      'Occupation',
      'Region',
      'Crop',
      'Amount Paid',
      'Status',
    ];

    const rows = filteredRegistrations.map((reg) => [
      new Date(reg.created_at).toLocaleString(),
      reg.customer_name,
      reg.customer_phone,
      reg.ghana_card,
      reg.date_of_birth,
      reg.town,
      reg.occupation,
      reg.region,
      reg.crop,
      `GH₵${reg.amount_paid.toFixed(2)}`,
      reg.registration_status,
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `afa-bundle-registrations-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: 'Success',
      description: `Exported ${filteredRegistrations.length} registrations`,
    });
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" style={{ color: primaryColor }}>
              {registrations.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{completedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{pendingCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" style={{ color: primaryColor }}>
              GH₵{totalRevenue.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Export */}
      <Card>
        <CardHeader>
          <CardTitle>AFA Bundle Registrations</CardTitle>
          <CardDescription>View and manage all AFA bundle registrations from your storefront</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by name, phone, Ghana card, or region..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
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
              <p className="text-muted-foreground">No AFA bundle registrations found</p>
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
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegistrations.map((reg) => (
                    <TableRow key={reg.id}>
                      <TableCell className="text-sm">
                        {new Date(reg.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{reg.customer_name}</TableCell>
                      <TableCell className="text-sm">{reg.customer_phone}</TableCell>
                      <TableCell className="text-sm">{reg.region}</TableCell>
                      <TableCell className="text-sm font-medium">GH₵{reg.amount_paid.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={reg.registration_status === 'completed' ? 'default' : reg.registration_status === 'pending' ? 'secondary' : 'destructive'}
                        >
                          {reg.registration_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedRegistration(reg);
                            setShowDetails(true);
                          }}
                        >
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
              <button
                onClick={() => setShowDetails(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Customer Name</p>
                  <p className="font-medium">{selectedRegistration.customer_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone Number</p>
                  <p className="font-medium">{selectedRegistration.customer_phone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ghana Card</p>
                  <p className="font-mono font-medium">{selectedRegistration.ghana_card}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date of Birth</p>
                  <p className="font-medium">{selectedRegistration.date_of_birth}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Town</p>
                  <p className="font-medium">{selectedRegistration.town}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Occupation</p>
                  <p className="font-medium">{selectedRegistration.occupation}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Region</p>
                  <p className="font-medium">{selectedRegistration.region}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Crop Produce</p>
                  <p className="font-medium">{selectedRegistration.crop}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Amount Paid</p>
                  <p className="font-bold text-lg">GH₵{selectedRegistration.amount_paid.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge
                    variant={
                      selectedRegistration.registration_status === 'completed'
                        ? 'default'
                        : selectedRegistration.registration_status === 'pending'
                          ? 'secondary'
                          : 'destructive'
                    }
                  >
                    {selectedRegistration.registration_status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Registration Date</p>
                  <p className="font-medium">{new Date(selectedRegistration.created_at).toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
