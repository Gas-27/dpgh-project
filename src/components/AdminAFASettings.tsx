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
  bundle_price: number;
  agent_commission_percent: number;
  is_enabled: boolean;
}

export default function AdminAFASettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AFASettings>({
    bundle_price: 0,
    agent_commission_percent: 0,
    is_enabled: true,
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
          bundle_price: data.bundle_price || 0,
          agent_commission_percent: data.agent_commission_percent || 0,
          is_enabled: data.is_enabled !== false,
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
          bundle_price: parseFloat(settings.bundle_price.toString()),
          agent_commission_percent: parseFloat(settings.agent_commission_percent.toString()),
          is_enabled: settings.is_enabled,
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

  const agentPrice = settings.bundle_price * (1 + settings.agent_commission_percent / 100);

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
              checked={settings.is_enabled}
              onCheckedChange={(checked) => {
                setSettings({ ...settings, is_enabled: checked });
                setChanged(true);
              }}
            />
          </div>

          {/* Base Registration Fee */}
          <div className="space-y-2">
            <Label htmlFor="bundle-price" className="text-base font-semibold">
              Base Registration Fee (GHC)
            </Label>
            <p className="text-sm text-muted-foreground">
              Minimum price charged for AFA registration. This is the amount you receive.
            </p>
            <Input
              id="bundle-price"
              type="number"
              step="0.01"
              min="0"
              value={settings.bundle_price}
              onChange={(e) => {
                setSettings({ ...settings, bundle_price: parseFloat(e.target.value) || 0 });
                setChanged(true);
              }}
              className="text-lg"
              placeholder="0.00"
            />
            <p className="text-sm font-medium text-green-600">
              You will receive: GHC{settings.bundle_price.toFixed(2)} per registration
            </p>
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
              Agents can charge from GHC{settings.bundle_price.toFixed(2)} to GHC{agentPrice.toFixed(2)}
            </p>
          </div>

          {/* Price Summary */}
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              <strong>Price Structure:</strong>
              <ul className="mt-2 space-y-1 ml-4">
                <li>• Admin minimum price: GHC{settings.bundle_price.toFixed(2)}</li>
                <li>• Agent commission allowed: {settings.agent_commission_percent.toFixed(1)}%</li>
                <li>• Max agent can charge: GHC{agentPrice.toFixed(2)}</li>
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
                You receive GHC{settings.bundle_price.toFixed(2)} per successful registration
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Agent Flexibility</p>
              <p className="text-sm text-muted-foreground">
                Agents can set prices between GHC{settings.bundle_price.toFixed(2)} - GHC{agentPrice.toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
