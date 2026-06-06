'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, AlertCircle, Check } from 'lucide-react';

interface AFASettings {
  registration_fee: number;
  package_page_price: number;
  agent_base_price: number;
  agent_commission_percent: number;
  registration_enabled: boolean;
}

export default function AdminAFASettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AFASettings>({
    registration_fee: 0,
    package_page_price: 0,
    agent_base_price: 0,
    agent_commission_percent: 0,
    registration_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    fetchAFASettings();
  }, []);

  const fetchAFASettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('afa_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          registration_fee: data.registration_fee || 0,
          package_page_price: data.package_page_price || 0,
          agent_base_price: data.agent_base_price || 0,
          agent_commission_percent: data.agent_commission_percent || 0,
          registration_enabled: data.registration_enabled !== false,
        });
      }
    } catch (err) {
      console.error('Error fetching AFA settings:', err);
      toast({ title: 'Error', description: 'Failed to load AFA settings', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('afa_settings')
        .upsert({
          id: 1, // Single settings row
          registration_fee: parseFloat(settings.registration_fee.toString()),
          package_page_price: parseFloat(settings.package_page_price.toString()),
          agent_base_price: parseFloat(settings.agent_base_price.toString()),
          agent_commission_percent: parseFloat(settings.agent_commission_percent.toString()),
          registration_enabled: settings.registration_enabled,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setChanged(false);
      toast({
        title: 'Success',
        description: 'AFA settings have been updated.',
      });
    } catch (err) {
      console.error('Error saving AFA settings:', err);
      toast({ title: 'Error', description: 'Failed to save AFA settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const agentPrice = settings.agent_base_price * (1 + settings.agent_commission_percent / 100);

  return (
    <div className="space-y-6">
      {/* Main Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>AFA Registration Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable AFA */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <Label className="text-base font-semibold">Enable AFA Registrations</Label>
              <p className="text-sm text-muted-foreground mt-1">
                When disabled, users will see "AFA is currently not available"
              </p>
            </div>
            <Switch
              checked={settings.registration_enabled}
              onCheckedChange={(checked) => {
                setSettings({ ...settings, registration_enabled: checked });
                setChanged(true);
              }}
            />
          </div>

          {/* Storefront/Package Page Price */}
          <div className="space-y-2">
            <Label htmlFor="package-price" className="text-base font-semibold">
              Package Page Display Price (GH₵)
            </Label>
            <p className="text-sm text-muted-foreground">
              Price shown on the packages/AFA listing page for customers to see
            </p>
            <Input
              id="package-price"
              type="number"
              step="0.01"
              min="0"
              value={settings.package_page_price}
              onChange={(e) => {
                setSettings({ ...settings, package_page_price: parseFloat(e.target.value) || 0 });
                setChanged(true);
              }}
              className="text-lg"
              placeholder="0.00"
            />
          </div>

          {/* Agent Base Price */}
          <div className="space-y-2">
            <Label htmlFor="agent-base-price" className="text-base font-semibold">
              Agent Base Price (GH₵)
            </Label>
            <p className="text-sm text-muted-foreground">
              Minimum price agents can charge for AFA registration
            </p>
            <Input
              id="agent-base-price"
              type="number"
              step="0.01"
              min="0"
              value={settings.agent_base_price}
              onChange={(e) => {
                setSettings({ ...settings, agent_base_price: parseFloat(e.target.value) || 0 });
                setChanged(true);
              }}
              className="text-lg"
              placeholder="0.00"
            />
            <p className="text-sm font-medium text-green-600">
              You will receive: GH₵{settings.registration_fee.toFixed(2)} per agent registration
            </p>
          </div>

          {/* Storefront Registration Fee */}
          <div className="space-y-2">
            <Label htmlFor="registration-fee" className="text-base font-semibold">
              Storefront Registration Fee (GH₵)
            </Label>
            <p className="text-sm text-muted-foreground">
              Amount you receive from direct storefront registrations
            </p>
            <Input
              id="registration-fee"
              type="number"
              step="0.01"
              min="0"
              value={settings.registration_fee}
              onChange={(e) => {
                setSettings({ ...settings, registration_fee: parseFloat(e.target.value) || 0 });
                setChanged(true);
              }}
              className="text-lg"
              placeholder="0.00"
            />
          </div>

          {/* Agent Commission */}
          <div className="space-y-2">
            <Label htmlFor="agent-commission" className="text-base font-semibold">
              Agent Commission Markup (%)
            </Label>
            <p className="text-sm text-muted-foreground">
              Percentage markup agents can add to the base price. Agents can set prices up to this percentage above the base fee.
            </p>
            <Input
              id="agent-commission"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={settings.agent_commission_percent}
              onChange={(e) => {
                setSettings({ ...settings, agent_commission_percent: parseFloat(e.target.value) || 0 });
                setChanged(true);
              }}
              className="text-lg"
              placeholder="0"
            />
            <p className="text-sm text-muted-foreground">
              Agents can charge from GH₵{settings.bundle_price.toFixed(2)} to GH₵{agentPrice.toFixed(2)}
            </p>
          </div>

          {/* Price Summary */}
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              <strong>Price Structure:</strong>
              <ul className="mt-2 space-y-1 ml-4">
                <li>• Package page display price: GH₵{settings.package_page_price.toFixed(2)}</li>
                <li>• Agent base price: GH₵{settings.agent_base_price.toFixed(2)}</li>
                <li>• Agent commission allowed: {settings.agent_commission_percent.toFixed(1)}%</li>
                <li>• Max agent can charge: GH₵{agentPrice.toFixed(2)}</li>
                <li>• Storefront registration fee (admin receives): GH₵{settings.registration_fee.toFixed(2)}</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={!changed || saving}
            className="w-full"
            size="lg"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-900">AFA System Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Registration Status</p>
              <p className="text-sm text-muted-foreground">
                {settings.is_enabled ? '✓ AFA registrations are enabled' : '✗ AFA registrations are disabled'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Your Revenue</p>
              <p className="text-sm text-muted-foreground">
                You receive GH₵{settings.bundle_price.toFixed(2)} per successful registration
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Agent Flexibility</p>
              <p className="text-sm text-muted-foreground">
                Agents can set prices between GH₵{settings.bundle_price.toFixed(2)} - GH₵{agentPrice.toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
