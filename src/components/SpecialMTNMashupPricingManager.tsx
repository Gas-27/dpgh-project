'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';

interface SpecialMTNTier {
  number: number;
  label: string;
  specs: string;
}

const TIERS: SpecialMTNTier[] = [
  { number: 1, label: 'Tier 1', specs: '125 mins + 0.36GB' },
  { number: 2, label: 'Tier 2', specs: '360 mins + 0.87GB' },
  { number: 3, label: 'Tier 3', specs: '700 mins + 1.6GB' },
  { number: 4, label: 'Tier 4', specs: '1000 mins + 2.6GB' },
];

export default function SpecialMTNMashupPricingManager() {
  const [pricing, setPricing] = useState({
    tier1_user_price: '6.00',
    tier1_agent_price: '6.00',
    tier1_enabled: true,
    tier2_user_price: '13.00',
    tier2_agent_price: '13.00',
    tier2_enabled: true,
    tier3_user_price: '25.00',
    tier3_agent_price: '25.00',
    tier3_enabled: true,
    tier4_user_price: '35.00',
    tier4_agent_price: '35.00',
    tier4_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    try {
      setLoading(true);
      // Fetch Special MTN packages from data_packages table
      const { data, error } = await supabase
        .from('data_packages')
        .select('id, user_price, agent_price, is_active, mins')
        .eq('network', 'mtn')
        .like('package_name', 'Special MTN Mashup%')
        .order('mins', { ascending: true });

      if (error) throw error;

      if (data && data.length === 4) {
        setPricing({
          tier1_user_price: String(data[0].user_price || '6.00'),
          tier1_agent_price: String(data[0].agent_price || '6.00'),
          tier1_enabled: data[0].is_active !== false,
          tier2_user_price: String(data[1].user_price || '13.00'),
          tier2_agent_price: String(data[1].agent_price || '13.00'),
          tier2_enabled: data[1].is_active !== false,
          tier3_user_price: String(data[2].user_price || '25.00'),
          tier3_agent_price: String(data[2].agent_price || '25.00'),
          tier3_enabled: data[2].is_active !== false,
          tier4_user_price: String(data[3].user_price || '35.00'),
          tier4_agent_price: String(data[3].agent_price || '35.00'),
          tier4_enabled: data[3].is_active !== false,
        });
        // Store package IDs for updating later
        (window as any).specialMTNPackageIds = data.map(d => d.id);
      }
    } catch (error) {
      console.error('[v0] Error fetching Special MTN pricing:', error);
      toast({ title: 'Error', description: 'Failed to load pricing', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ids = (window as any).specialMTNPackageIds || [];
      
      // Update each tier package individually
      const updates = [
        { id: ids[0], user_price: parseFloat(pricing.tier1_user_price), agent_price: parseFloat(pricing.tier1_agent_price), is_active: pricing.tier1_enabled },
        { id: ids[1], user_price: parseFloat(pricing.tier2_user_price), agent_price: parseFloat(pricing.tier2_agent_price), is_active: pricing.tier2_enabled },
        { id: ids[2], user_price: parseFloat(pricing.tier3_user_price), agent_price: parseFloat(pricing.tier3_agent_price), is_active: pricing.tier3_enabled },
        { id: ids[3], user_price: parseFloat(pricing.tier4_user_price), agent_price: parseFloat(pricing.tier4_agent_price), is_active: pricing.tier4_enabled },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('data_packages')
          .update({ user_price: update.user_price, agent_price: update.agent_price, is_active: update.is_active })
          .eq('id', update.id);
        
        if (error) throw error;
      }
      
      toast({ title: 'Success', description: 'Special MTN Mashup pricing saved' });
    } catch (error: any) {
      console.error('[v0] Error saving Special MTN pricing:', error);
      toast({ title: 'Error', description: error?.message || 'Failed to save pricing', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/30 bg-amber-50/5">
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <span className="text-xl">⚡</span> Special MTN Mashup Pricing
        </CardTitle>
        <p className="text-sm text-muted-foreground">Manage pricing and enable/disable for the 4 Special MTN Mashup tiers</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {TIERS.map((tier) => {
            const tierKey = `tier${tier.number}`;
            const isEnabled = pricing[`${tierKey}_enabled` as keyof typeof pricing] as boolean;

            return (
              <div key={tier.number} className="border p-4 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-semibold text-amber-600">{tier.label}: {tier.specs}</div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) =>
                      setPricing({ ...pricing, [`${tierKey}_enabled`]: checked })
                    }
                  />
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">User Price (GH₵)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={pricing[`${tierKey}_user_price` as keyof typeof pricing]}
                      onChange={(e) =>
                        setPricing({ ...pricing, [`${tierKey}_user_price`]: e.target.value })
                      }
                      disabled={!isEnabled}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Agent Base Price (GH₵)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={pricing[`${tierKey}_agent_price` as keyof typeof pricing]}
                      onChange={(e) =>
                        setPricing({ ...pricing, [`${tierKey}_agent_price`]: e.target.value })
                      }
                      disabled={!isEnabled}
                      className="bg-background"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Special MTN Pricing
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
