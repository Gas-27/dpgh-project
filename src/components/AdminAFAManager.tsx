'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, Eye, Settings, Users } from 'lucide-react';

interface AFARegistration {
  id: string;
  full_name: string;
  customer_phone: string;
  ghana_card_number: string;
  region: string;
  crop_produce: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export default function AdminAFAManager() {
  const [activeTab, setActiveTab] = useState('settings');
  const [registrationFee, setRegistrationFee] = useState(0);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<AFARegistration[]>([]);
  const [fetching, setFetching] = useState(false);

  // Load AFA settings
  useEffect(() => {
    loadAFASettings();
    loadRegistrations();
  }, []);

  const loadAFASettings = async () => {
    try {
      const { data, error } = await supabase
        .from('afa_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading AFA settings:', error);
        return;
      }

      if (data) {
        setRegistrationFee(data.registration_fee || 0);
        setRegistrationEnabled(data.registration_enabled !== false);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRegistrations = async () => {
    try {
      setFetching(true);
      const { data, error } = await supabase
        .from('afa_registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading registrations:', error);
        return;
      }

      setRegistrations(data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setFetching(false);
    }
  };

  const saveAFASettings = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('afa_settings')
        .upsert({
          id: 1,
          registration_fee: registrationFee,
          registration_enabled: registrationEnabled,
        });

      if (error) {
        console.error('Error saving settings:', error);
        alert('Failed to save settings');
        return;
      }

      alert('AFA settings saved successfully!');
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setSaving(false);
    }
  };

  const downloadRegistrationsCSV = () => {
    const headers = ['Full Name', 'Phone', 'Ghana Card', 'Region', 'Crop Produce', 'Status', 'Date'];
    const rows = registrations.map(reg => [
      reg.full_name,
      reg.customer_phone,
      reg.ghana_card_number,
      reg.region,
      reg.crop_produce,
      reg.status,
      new Date(reg.created_at).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `afa-registrations-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const updateRegistrationStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('afa_registrations')
        .update({ status })
        .eq('id', id);

      if (error) {
        console.error('Error updating status:', error);
        return;
      }

      setRegistrations(registrations.map(reg => 
        reg.id === id ? { ...reg, status } : reg
      ));
    } catch (err) {
      console.error('Error:', err);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="registrations" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Registrations
          </TabsTrigger>
        </TabsList>

        {/* SETTINGS TAB */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AFA Registration Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Registration Fee */}
                  <div className="space-y-2">
                    <Label htmlFor="reg-fee">Base Registration Fee (GH₵)</Label>
                    <Input
                      id="reg-fee"
                      type="number"
                      min="0"
                      step="0.01"
                      value={registrationFee}
                      onChange={(e) => setRegistrationFee(Number(e.target.value))}
                      placeholder="Enter fee amount"
                    />
                    <p className="text-xs text-muted-foreground">
                      This is the base price. Agents can set their own markup on top of this.
                    </p>
                  </div>

                  {/* Enable/Disable */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      <Label htmlFor="enabled">Registration Status</Label>
                      <Badge variant={registrationEnabled ? 'default' : 'secondary'}>
                        {registrationEnabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <Button
                      onClick={() => setRegistrationEnabled(!registrationEnabled)}
                      variant={registrationEnabled ? 'destructive' : 'default'}
                      className="w-full"
                    >
                      {registrationEnabled ? 'Disable Registrations' : 'Enable Registrations'}
                    </Button>
                  </div>

                  {/* Save Button */}
                  <Button
                    onClick={saveAFASettings}
                    disabled={saving}
                    className="w-full"
                    size="lg"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save Settings
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* REGISTRATIONS TAB */}
        <TabsContent value="registrations" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>AFA Registrations ({registrations.length})</CardTitle>
              <Button
                onClick={downloadRegistrationsCSV}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
            </CardHeader>
            <CardContent>
              {fetching ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : registrations.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No AFA registrations yet</p>
              ) : (
                <div className="space-y-4">
                  {registrations.map((reg) => (
                    <div key={reg.id} className="border rounded-lg p-4 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="font-semibold">{reg.full_name}</p>
                          <p className="text-muted-foreground">{reg.customer_phone}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-muted-foreground">Card Number</p>
                          <p>{reg.ghana_card_number}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-muted-foreground">Region</p>
                          <p>{reg.region}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-muted-foreground">Crop Produce</p>
                          <p>{reg.crop_produce}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-muted-foreground">Status</p>
                          <Badge variant={
                            reg.status === 'approved' ? 'default' :
                            reg.status === 'rejected' ? 'destructive' : 'secondary'
                          }>
                            {reg.status}
                          </Badge>
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-muted-foreground">Date</p>
                          <p>{new Date(reg.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>

                      {reg.status === 'pending' && (
                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            onClick={() => updateRegistrationStatus(reg.id, 'approved')}
                            size="sm"
                            className="flex-1"
                          >
                            Approve
                          </Button>
                          <Button
                            onClick={() => updateRegistrationStatus(reg.id, 'rejected')}
                            variant="destructive"
                            size="sm"
                            className="flex-1"
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
