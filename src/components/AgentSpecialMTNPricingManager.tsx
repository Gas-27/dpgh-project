'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';

interface AgentPricing {
  tier1_price: string;
  tier2_price: string;
  tier3_price: string;
  tier4_price: string;
}

interface AdminBasePrice {
  tier1: number;
  tier2: number;
  tier3: number;
  tier4: number;
}

export default function AgentSpecialMTNPricingManager() {
  const { toast } = useToast();
  const [agentPricing, setAgentPricing] = useState<AgentPricing>({
    tier1_price: '',
    tier2_price: '',
    tier3_price: '',
    tier4_price: '',
  });
  const [adminBasePrices, setAdminBasePrices] = useState<AdminBasePrice>({
    tier1: 0,
    tier2: 0,
    tier3: 0,
    tier4: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id || null);
    };
    getUser();
  }, []);

  // Fetch admin base prices and agent's current prices
  useEffect(() => {
    if (!userId) return;
    fetchPrices();
  }, [userId]);

  const fetchPrices = async () => {
    try {
      setLoading(true);
      
      // Fetch admin base prices from afa_settings
      const { data: adminData } = await supabase
        .from('afa_settings')
        .select('special_mtn_mashup_1_agent_price, special_mtn_mashup_2_agent_price, special_mtn_mashup_3_agent_price, special_mtn_mashup_4_agent_price')
        .single();

      if (adminData) {
        setAdminBasePrices({
          tier1: adminData.special_mtn_mashup_1_agent_price || 6.00,
          tier2: adminData.special_mtn_mashup_2_agent_price || 13.00,
          tier3: adminData.special_mtn_mashup_3_agent_price || 25.00,
          tier4: adminData.special_mtn_mashup_4_agent_price || 35.00,
        });
      }

      // Fetch agent's custom prices
      const { data: agentData } = await supabase
        .from('agent_special_mtn_mashup_pricing')
        .select('tier_1_price, tier_2_price, tier_3_price, tier_4_price')
        .eq('agent_id', userId)
        .maybeSingle();

      if (agentData) {
        setAgentPricing({
          tier1_price: String(agentData.tier_1_price || adminData?.special_mtn_mashup_1_agent_price || '6.00'),
          tier2_price: String(agentData.tier_2_price || adminData?.special_mtn_mashup_2_agent_price || '13.00'),
          tier3_price: String(agentData.tier_3_price || adminData?.special_mtn_mashup_3_agent_price || '25.00'),
          tier4_price: String(agentData.tier_4_price || adminData?.special_mtn_mashup_4_agent_price || '35.00'),
        });
      } else {
        // Use admin base prices as defaults if agent has no custom pricing
        setAgentPricing({
          tier1_price: String(adminData?.special_mtn_mashup_1_agent_price || '6.00'),
          tier2_price: String(adminData?.special_mtn_mashup_2_agent_price || '13.00'),
          tier3_price: String(adminData?.special_mtn_mashup_3_agent_price || '25.00'),
          tier4_price: String(adminData?.special_mtn_mashup_4_agent_price || '35.00'),
        });
      }
    } catch (error) {
      console.error('[v0] Error fetching prices:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pricing information',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const savePrices = async () => {
    if (!userId) {
      toast({ title: 'Error', description: 'User not authenticated', variant: 'destructive' });
      return;
    }

    // Validate prices are not below admin base prices
    const tier1Price = parseFloat(agentPricing.tier1_price);
    const tier2Price = parseFloat(agentPricing.tier2_price);
    const tier3Price = parseFloat(agentPricing.tier3_price);
    const tier4Price = parseFloat(agentPricing.tier4_price);

    if (tier1Price < adminBasePrices.tier1) {
      toast({
        title: 'Price Too Low',
        description: `Tier 1 price cannot be below admin base (GH₵ ${adminBasePrices.tier1.toFixed(2)})`,
        variant: 'destructive',
      });
      return;
    }
    if (tier2Price < adminBasePrices.tier2) {
      toast({
        title: 'Price Too Low',
        description: `Tier 2 price cannot be below admin base (GH₵ ${adminBasePrices.tier2.toFixed(2)})`,
        variant: 'destructive',
      });
      return;
    }
    if (tier3Price < adminBasePrices.tier3) {
      toast({
        title: 'Price Too Low',
        description: `Tier 3 price cannot be below admin base (GH₵ ${adminBasePrices.tier3.toFixed(2)})`,
        variant: 'destructive',
      });
      return;
    }
    if (tier4Price < adminBasePrices.tier4) {
      toast({
        title: 'Price Too Low',
        description: `Tier 4 price cannot be below admin base (GH₵ ${adminBasePrices.tier4.toFixed(2)})`,
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Check if agent has existing pricing
      const { data: existing } = await supabase
        .from('agent_special_mtn_mashup_pricing')
        .select('id')
        .eq('agent_id', userId)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('agent_special_mtn_mashup_pricing')
          .update({
            tier_1_price: tier1Price,
            tier_2_price: tier2Price,
            tier_3_price: tier3Price,
            tier_4_price: tier4Price,
            updated_at: new Date().toISOString(),
          })
          .eq('agent_id', userId);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('agent_special_mtn_mashup_pricing')
          .insert({
            agent_id: userId,
            tier_1_price: tier1Price,
            tier_2_price: tier2Price,
            tier_3_price: tier3Price,
            tier_4_price: tier4Price,
          });

        if (error) throw error;
      }

      toast({ title: 'Success!', description: 'Special MTN Mashup pricing saved!' });
    } catch (error: any) {
      console.error('[v0] Error saving prices:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to save pricing',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
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
        <CardDescription>Set your custom prices based on admin base prices</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tier 1 */}
          <div className="border p-4 rounded-lg space-y-3">
            <div>
              <div className="font-semibold text-amber-600">Tier 1: 125 mins + 0.36GB</div>
              <p className="text-xs text-muted-foreground">Admin base: GHS {adminBasePrices.tier1.toFixed(2)}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Your Price (GH₵)</Label>
              <Input
                type="number"
                step="0.01"
                value={agentPricing.tier1_price}
                onChange={(e) => setAgentPricing({ ...agentPricing, tier1_price: e.target.value })}
                className={parseFloat(agentPricing.tier1_price) < adminBasePrices.tier1 ? 'border-red-500' : ''}
              />
              {parseFloat(agentPricing.tier1_price) < adminBasePrices.tier1 && (
                <p className="text-xs text-red-500">Minimum price: GH₵ {adminBasePrices.tier1.toFixed(2)}</p>
              )}
            </div>
          </div>

          {/* Tier 2 */}
          <div className="border p-4 rounded-lg space-y-3">
            <div>
              <div className="font-semibold text-amber-600">Tier 2: 360 mins + 0.87GB</div>
              <p className="text-xs text-muted-foreground">Admin base: GHS {adminBasePrices.tier2.toFixed(2)}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Your Price (GH₵)</Label>
              <Input
                type="number"
                step="0.01"
                value={agentPricing.tier2_price}
                onChange={(e) => setAgentPricing({ ...agentPricing, tier2_price: e.target.value })}
                className={parseFloat(agentPricing.tier2_price) < adminBasePrices.tier2 ? 'border-red-500' : ''}
              />
              {parseFloat(agentPricing.tier2_price) < adminBasePrices.tier2 && (
                <p className="text-xs text-red-500">Minimum price: GH₵ {adminBasePrices.tier2.toFixed(2)}</p>
              )}
            </div>
          </div>

          {/* Tier 3 */}
          <div className="border p-4 rounded-lg space-y-3">
            <div>
              <div className="font-semibold text-amber-600">Tier 3: 700 mins + 1.6GB</div>
              <p className="text-xs text-muted-foreground">Admin base: GHS {adminBasePrices.tier3.toFixed(2)}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Your Price (GH₵)</Label>
              <Input
                type="number"
                step="0.01"
                value={agentPricing.tier3_price}
                onChange={(e) => setAgentPricing({ ...agentPricing, tier3_price: e.target.value })}
                className={parseFloat(agentPricing.tier3_price) < adminBasePrices.tier3 ? 'border-red-500' : ''}
              />
              {parseFloat(agentPricing.tier3_price) < adminBasePrices.tier3 && (
                <p className="text-xs text-red-500">Minimum price: GH₵ {adminBasePrices.tier3.toFixed(2)}</p>
              )}
            </div>
          </div>

          {/* Tier 4 */}
          <div className="border p-4 rounded-lg space-y-3">
            <div>
              <div className="font-semibold text-amber-600">Tier 4: 1000 mins + 2.6GB</div>
              <p className="text-xs text-muted-foreground">Admin base: GHS {adminBasePrices.tier4.toFixed(2)}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Your Price (GH₵)</Label>
              <Input
                type="number"
                step="0.01"
                value={agentPricing.tier4_price}
                onChange={(e) => setAgentPricing({ ...agentPricing, tier4_price: e.target.value })}
                className={parseFloat(agentPricing.tier4_price) < adminBasePrices.tier4 ? 'border-red-500' : ''}
              />
              {parseFloat(agentPricing.tier4_price) < adminBasePrices.tier4 && (
                <p className="text-xs text-red-500">Minimum price: GH₵ {adminBasePrices.tier4.toFixed(2)}</p>
              )}
            </div>
          </div>
        </div>

        <Button onClick={savePrices} disabled={saving} className="w-full bg-amber-600 hover:bg-amber-700">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save My Special MTN Prices
        </Button>
      </CardContent>
    </Card>
  );
}
