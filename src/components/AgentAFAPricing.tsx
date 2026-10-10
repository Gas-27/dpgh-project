'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle } from 'lucide-react';

interface AFAAgentPrice {
  id: string;
  agent_store_id: string;
  base_price: number;
  markup_amount: number;
  sell_price: number;
  updated_at: string;
}

export default function AgentAFAPricing() {
  const { user } = useAuth();
  const [basePrice, setBasePrice] = useState(0);
  const [markupAmount, setMarkupAmount] = useState(0);
  const [sellPrice, setSellPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);

  useEffect(() => {
    loadAFAPricing();
  }, [user]);

  const loadAFAPricing = async () => {
    try {
      if (!user?.id) return;

      // Get agent store ID
      const { data: agentStore } = await supabase
        .from('agent_stores')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!agentStore) {
        setLoading(false);
        return;
      }

      setAgentId(agentStore.id);

      // Get base price from AFA settings
      const { data: afaSettings } = await supabase
        .from('afa_settings')
        .select('registration_fee')
        .single();

      if (afaSettings) {
        setBasePrice(afaSettings.registration_fee);
      }

      // Get agent's custom price
      const { data: agentPrice } = await supabase
        .from('agent_afa_prices')
        .select('*')
        .eq('agent_store_id', agentStore.id)
        .single();

      if (agentPrice) {
        setMarkupAmount(agentPrice.markup_amount);
        setSellPrice(agentPrice.sell_price);
      } else {
        // Default to base price if no custom price set
        setSellPrice(afaSettings?.registration_fee || 0);
      }
    } catch (err) {
      console.error('Error loading AFA pricing:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateSellPrice = (markup: number) => {
    const newSellPrice = basePrice + markup;
    setMarkupAmount(markup);
    setSellPrice(newSellPrice);
  };

  const saveAFAPricing = async () => {
    try {
      if (!agentId) {
        alert('Agent store not found');
        return;
      }

      setSaving(true);

      const { error } = await supabase
        .from('agent_afa_prices')
        .upsert({
          agent_store_id: agentId,
          base_price: basePrice,
          markup_amount: markupAmount,
          sell_price: sellPrice,
        });

      if (error) {
        console.error('Error saving AFA pricing:', error);
        alert('Failed to save AFA pricing');
        return;
      }

      alert('AFA pricing updated successfully!');
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!agentId) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Agent Store Not Found</p>
              <p className="text-sm text-muted-foreground">You need to create an agent store to set AFA pricing.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AFA Registration Pricing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Base Price Display */}
        <div className="p-4 bg-muted rounded-lg space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">Base Price (Set by Admin)</p>
          <p className="text-3xl font-bold">GHC{basePrice.toFixed(2)}</p>
        </div>

        {/* Markup Calculation */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="markup">Your Markup Amount (GHC)</Label>
            <Input
              id="markup"
              type="number"
              min="0"
              step="0.01"
              value={markupAmount}
              onChange={(e) => calculateSellPrice(Number(e.target.value))}
              placeholder="Enter markup amount"
            />
            <p className="text-xs text-muted-foreground">
              This is your profit. Your customers will pay the base price + your markup.
            </p>
          </div>

          {/* Sell Price Display */}
          <div className="p-4 bg-primary/5 rounded-lg space-y-2 border border-primary/20">
            <p className="text-sm font-semibold text-muted-foreground">Your Selling Price</p>
            <p className="text-3xl font-bold text-primary">GHC{sellPrice.toFixed(2)}</p>
            <div className="flex gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Base</p>
                <p className="font-semibold">GHC{basePrice.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">+</p>
              </div>
              <div>
                <p className="text-muted-foreground">Your Markup</p>
                <p className="font-semibold">GHC{markupAmount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">=</p>
              </div>
              <div>
                <p className="text-muted-foreground">Final Price</p>
                <p className="font-semibold text-primary">GHC{sellPrice.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={saveAFAPricing}
          disabled={saving}
          className="w-full"
          size="lg"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save AFA Pricing
        </Button>

        {/* Info */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm">
            <span className="font-semibold">How it works:</span> Set your markup, and when customers register through your agent link, they'll pay your selling price. You keep the difference between your selling price and the base price.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
