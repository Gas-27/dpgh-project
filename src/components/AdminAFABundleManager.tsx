'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Trash2, Edit2, CheckCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AFARegistration {
  id: string;
  customer_name: string;
  phone_number: string;
  ghana_card_number: string;
  date_of_birth: string;
  region: string;
  town: string;
  crop_type: string;
  occupation: string;
  amount_paid: number;
  status: string;
  created_at: string;
  agent_stores?: { store_name: string };
  subagent_stores?: { store_name: string };
}

interface AFASettings {
  id: string;
  registration_fee: number;
  agent_commission_percent: number;
  registration_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export default function AdminAFABundleManager() {
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<AFARegistration[]>([]);
  const [settings, setSettings] = useState<AFASettings>({
    id: '00000000-0000-0000-0000-000000000001',
    registration_fee: 15,
    agent_commission_percent: 10,
    registration_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch AFA registrations
      const { data: regsData, error: regsError } = await supabase
        .from('afa_registrations')
        .select(`
          *,
          agent_stores:agent_store_id (store_name),
          subagent_stores:subagent_store_id (store_name)
        `)
        .order('created_at', { ascending: false });

      if (regsError) throw regsError;
      setRegistrations(regsData || []);

      // Fetch AFA settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('afa_settings')
        .select('*')
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;
      if (settingsData) {
        setSettings(settingsData);
      }
    } catch (err) {
      console.error('Error fetching AFA data:', err);
      toast({ title: 'Error', description: 'Failed to load AFA data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async () => {
    try {
      setSettingsLoading(true);
      const { error } = await supabase
        .from('afa_settings')
        .upsert({
          id: '00000000-0000-0000-0000-000000000001',
          registration_fee: parseFloat(String(settings.registration_fee)),
          agent_commission_percent: parseFloat(String(settings.agent_commission_percent)),
          registration_enabled: settings.registration_enabled,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error("[v0] Supabase error updating afa_settings:", error);
        throw error;
      }
      toast({ title: 'Success', description: 'AFA settings updated' });
      setEditingSettings(false);
      // Refetch settings to ensure we have the latest values
      const { data: updatedSettings } = await supabase
        .from('afa_settings')
        .select('*')
        .single();
      if (updatedSettings) {
        setSettings(updatedSettings);
      }
    } catch (err) {
      console.error("[v0] Error updating settings:", err);
      toast({ title: 'Error', description: `Failed to update settings: ${err instanceof Error ? err.message : 'Unknown error'}`, variant: 'destructive' });
    } finally {
      setSettingsLoading(false);
    }
  };

  const updateRegistrationStatus = async (registrationId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('afa_registrations')
        .update({ status: newStatus })
        .eq('id', registrationId);

      if (error) throw error;
      setRegistrations(registrations.map(r => r.id === registrationId ? { ...r, status: newStatus } : r));
      toast({ title: 'Success', description: `Registration marked as ${newStatus}` });
    } catch (err) {
      console.error('Error updating status:', err);
      toast({ title: 'Error', description: 'Failed to update registration', variant: 'destructive' });
    }
  };

  const deleteRegistration = async (registrationId: string) => {
    try {
      const { error } = await supabase
        .from('afa_registrations')
        .delete()
        .eq('id', registrationId);

      if (error) throw error;
      setRegistrations(registrations.filter(r => r.id !== registrationId));
      toast({ title: 'Success', description: 'Registration deleted' });
    } catch (err) {
      console.error('Error deleting registration:', err);
      toast({ title: 'Error', description: 'Failed to delete registration', variant: 'destructive' });
    }
  };

  const filteredRegistrations = registrations.filter(r =>
    !filterStatus || r.status === filterStatus
  );

  const pendingCount = registrations.filter(r => r.status === 'pending').length;
  const completedCount = registrations.filter(r => r.status === 'completed').length;
  const totalRevenue = registrations.reduce((sum, r) => sum + (Number(r.amount_paid) || 0), 0);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Settings Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>AFA Bundle Settings</CardTitle>
          {!editingSettings && (
            <Button variant="outline" size="sm" onClick={() => setEditingSettings(true)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {editingSettings ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Base Registration Fee (GHC)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={settings.registration_fee}
                    onChange={(e) => setSettings({ ...settings, registration_fee: parseFloat(e.target.value) })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Agent Commission (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={settings.agent_commission_percent}
                    onChange={(e) => setSettings({ ...settings, agent_commission_percent: parseFloat(e.target.value) })}
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <Label className="text-base">AFA Registration Status</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {settings.registration_enabled ? 'Currently accepting registrations' : 'Registrations disabled'}
                  </p>
                </div>
                <Switch
                  checked={settings.registration_enabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, registration_enabled: checked })}
                />
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  <strong>Expected Agent Price Range:</strong> GHC{Number(settings.registration_fee || 0).toFixed(2)} - GHC{(Number(settings.registration_fee || 0) * (1 + Number(settings.agent_commission_percent || 0) / 100)).toFixed(2)}
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={updateSettings} disabled={settingsLoading}>
                  {settingsLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Settings
                </Button>
                <Button 
                  variant="outline" 
                  onClick={async () => {
                    setEditingSettings(false);
                    // Refetch to discard unsaved changes
                    const { data: currentSettings } = await supabase
                      .from('afa_settings')
                      .select('*')
                      .single();
                    if (currentSettings) {
                      setSettings(currentSettings);
                    }
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Base Registration Fee</p>
                <p className="text-2xl font-bold mt-2">GHC{Number(settings.registration_fee || 0).toFixed(2)}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Agent Commission</p>
                <p className="text-2xl font-bold mt-2">{Number(settings.agent_commission_percent || 0).toFixed(1)}%</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={settings.registration_enabled ? 'default' : 'secondary'} className="mt-2">
                  {settings.registration_enabled ? 'Accepting' : 'Disabled'}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{registrations.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{completedCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">GHC{Number(totalRevenue || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Registrations Table */}
      <Card>
        <CardHeader>
          <CardTitle>AFA Registrations</CardTitle>
          <div className="flex gap-2 mt-4">
            <Button
              variant={!filterStatus ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('')}
            >
              All ({registrations.length})
            </Button>
            <Button
              variant={filterStatus === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('pending')}
            >
              Pending ({pendingCount})
            </Button>
            <Button
              variant={filterStatus === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('completed')}
            >
              Completed ({completedCount})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Ghana Card</TableHead>
                  <TableHead>Region/Town</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell className="font-medium">{reg.customer_name}</TableCell>
                    <TableCell>{reg.phone_number}</TableCell>
                    <TableCell className="text-sm">{reg.ghana_card_number}</TableCell>
                    <TableCell className="text-sm">{reg.town}, {reg.region}</TableCell>
                    <TableCell className="text-sm">
                      {reg.agent_stores?.store_name || reg.subagent_stores?.store_name || 'N/A'}
                    </TableCell>
                    <TableCell className="font-medium">GHC{Number(reg.amount_paid || 0).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={reg.status === 'completed' ? 'default' : 'secondary'}>
                        {reg.status === 'completed' ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Completed
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(reg.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {reg.status === 'pending' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateRegistrationStatus(reg.id, 'completed')}
                          >
                            Approve
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateRegistrationStatus(reg.id, 'pending')}
                          >
                            Revert
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => deleteRegistration(reg.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredRegistrations.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No registrations found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
