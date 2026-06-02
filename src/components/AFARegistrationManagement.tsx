'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, Eye, CheckCircle, XCircle, Clock, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AFARegistration {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_id?: string;
  afa_package_id: string;
  registration_status: string;
  payment_status: string;
  amount_paid: number;
  created_at: string;
  agent_store_id?: string;
  subagent_store_id?: string;
  afa_ref_id?: string;
  town?: string;
  region?: string;
  crop?: string;
}

interface AFAPackage {
  id: string;
  name: string;
  base_price: number;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function AFARegistrationManagement() {
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<AFARegistration[]>([]);
  const [packages, setPackages] = useState<AFAPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [packageFilter, setPackageFilter] = useState<string>('all');
  const [selectedRegistration, setSelectedRegistration] = useState<AFARegistration | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch AFA packages
      const { data: packagesData, error: packagesError } = await supabase
        .from('afa_packages')
        .select('id, name, base_price')
        .eq('is_active', true);

      if (packagesError) throw packagesError;
      setPackages(packagesData || []);

      // Fetch AFA registrations
      const { data: registrationsData, error: registrationsError } = await supabase
        .from('afa_registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (registrationsError) throw registrationsError;
      setRegistrations(registrationsData || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (registrationId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('afa_registrations')
        .update({ registration_status: newStatus })
        .eq('id', registrationId);

      if (error) throw error;

      setRegistrations(registrations.map(r =>
        r.id === registrationId ? { ...r, registration_status: newStatus } : r
      ));

      toast({
        title: 'Success',
        description: `Registration status updated to ${newStatus}`
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      pending: 'secondary',
      rejected: 'destructive',
      verified: 'default',
      inactive: 'outline'
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const filteredRegistrations = registrations.filter(reg => {
    const matchesSearch = 
      reg.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.customer_phone.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || reg.registration_status === statusFilter;
    const matchesPackage = packageFilter === 'all' || reg.afa_package_id === packageFilter;

    return matchesSearch && matchesStatus && matchesPackage;
  });

  const exportToCSV = () => {
    const headers = ['Name', 'Phone', 'Package', 'Status', 'Amount', 'Date'];
    const rows = filteredRegistrations.map(reg => [
      reg.customer_name,
      reg.customer_phone,
      packages.find(p => p.id === reg.afa_package_id)?.name || 'N/A',
      reg.registration_status,
      `GHS ${reg.amount_paid}`,
      new Date(reg.created_at).toLocaleDateString()
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `afa-registrations-${new Date().toISOString()}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AFA Registration Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select value={packageFilter} onValueChange={setPackageFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by package" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Packages</SelectItem>
                {packages.map(pkg => (
                  <SelectItem key={pkg.id} value={pkg.id}>{pkg.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={exportToCSV} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-muted">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold">{filteredRegistrations.length}</div>
                <p className="text-sm text-muted-foreground">Total Registrations</p>
              </CardContent>
            </Card>
            <Card className="bg-green-500/10 border-green-500/20">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-green-500">
                  {filteredRegistrations.filter(r => r.registration_status === 'active').length}
                </div>
                <p className="text-sm text-muted-foreground">Active</p>
              </CardContent>
            </Card>
            <Card className="bg-yellow-500/10 border-yellow-500/20">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-yellow-500">
                  {filteredRegistrations.filter(r => r.registration_status === 'pending').length}
                </div>
                <p className="text-sm text-muted-foreground">Pending</p>
              </CardContent>
            </Card>
            <Card className="bg-blue-500/10 border-blue-500/20">
              <CardContent className="pt-6">
                <div className="text-3xl font-bold text-blue-500">
                  GHS {filteredRegistrations.reduce((sum, r) => sum + (r.amount_paid || 0), 0).toFixed(2)}
                </div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading registrations...</div>
            ) : filteredRegistrations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No registrations found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegistrations.map(reg => (
                    <TableRow key={reg.id}>
                      <TableCell className="font-medium">{reg.customer_name}</TableCell>
                      <TableCell className="font-mono text-sm">{reg.customer_phone}</TableCell>
                      <TableCell>{packages.find(p => p.id === reg.afa_package_id)?.name || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(reg.registration_status)}
                          {getStatusBadge(reg.registration_status)}
                        </div>
                      </TableCell>
                      <TableCell>GHS {reg.amount_paid?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(reg.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Dialog open={detailsOpen && selectedRegistration?.id === reg.id} onOpenChange={setDetailsOpen}>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedRegistration(reg)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Registration Details</DialogTitle>
                            </DialogHeader>
                            {selectedRegistration && (
                              <div className="space-y-4">
                                <div>
                                  <p className="text-sm text-muted-foreground">Customer Name</p>
                                  <p className="font-semibold">{selectedRegistration.customer_name}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Phone</p>
                                  <p className="font-mono">{selectedRegistration.customer_phone}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">ID</p>
                                  <p className="font-mono text-sm">{selectedRegistration.customer_id || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Town/Region</p>
                                  <p>{selectedRegistration.town || 'N/A'} / {selectedRegistration.region || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">Crop</p>
                                  <p>{selectedRegistration.crop || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-sm text-muted-foreground">AFA Reference</p>
                                  <p className="font-mono text-sm">{selectedRegistration.afa_ref_id || 'Pending'}</p>
                                </div>
                                <div className="space-y-2">
                                  <p className="text-sm text-muted-foreground">Update Status</p>
                                  <Select
                                    value={selectedRegistration.registration_status}
                                    onValueChange={(value) => {
                                      handleStatusChange(selectedRegistration.id, value);
                                      setDetailsOpen(false);
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="pending">Pending</SelectItem>
                                      <SelectItem value="verified">Verified</SelectItem>
                                      <SelectItem value="active">Active</SelectItem>
                                      <SelectItem value="rejected">Rejected</SelectItem>
                                      <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
