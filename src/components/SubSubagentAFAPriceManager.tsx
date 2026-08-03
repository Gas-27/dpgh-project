'use client';

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Zap } from "lucide-react";

interface SubSubagentAFAPriceManagerProps {
  onPriceSaved?: () => void;
}

export default function SubSubagentAFAPriceManager({ onPriceSaved }: SubSubagentAFAPriceManagerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Cost the parent subagent set for this sub-subagent
  const [subagentCostToSubsub, setSubagentCostToSubsub] = useState<number>(0);
  // Admin minimum
  const [adminMinPrice, setAdminMinPrice] = useState<number>(14);
  // Price this sub-subagent charges on their storefront
  const [storefrontPrice, setStorefrontPrice] = useState<number>(0);

  const [storeId, setStoreId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;

      // Fetch this sub-subagent's store
      const { data: store, error: storeErr } = await supabase
        .from("sub_subagent_stores")
        .select("id, afa_bundle_price, subagent_store_id")
        .eq("user_id", authData.user.id)
        .single();

      if (storeErr || !store) {
        toast({ title: "Error", description: "Sub-subagent store not found", variant: "destructive" });
        return;
      }

      setStoreId(store.id);
      setStorefrontPrice((store as any).afa_bundle_price || 0);

      // Fetch parent subagent's sub-subagent base price (the cost set for sub-subagents)
      if (store.subagent_store_id) {
        const { data: parentSubagent } = await supabase
          .from("subagent_stores")
          .select("afa_subsubagent_base_price, afa_bundle_price")
          .eq("id", store.subagent_store_id)
          .single();

        if (parentSubagent) {
          // Prefer afa_subsubagent_base_price; fall back to afa_bundle_price
          const cost =
            (parentSubagent as any).afa_subsubagent_base_price ||
            parentSubagent.afa_bundle_price ||
            0;
          setSubagentCostToSubsub(Number(cost));
        }
      }

      // Fetch admin AFA minimum — use select("*") to avoid 406 on missing columns
      const { data: afaSettings } = await supabase
        .from("afa_settings")
        .select("*")
        .limit(1);

      if (afaSettings && afaSettings.length > 0) {
        const row = afaSettings[0] as any;
        const min = row.base_registration_price || row.bundle_price || 14;
        setAdminMinPrice(Number(min));
      }
    } catch (err) {
      console.error("[SubSubagentAFAPriceManager] fetchData error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!storeId) return;
    const minimum = subagentCostToSubsub > 0 ? subagentCostToSubsub : adminMinPrice;
    if (storefrontPrice < minimum) {
      toast({
        title: "Price too low",
        description: `Your storefront price must be at least GHC${minimum.toFixed(2)} (your cost from subagent)`,
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("sub_subagent_stores")
        .update({ afa_bundle_price: storefrontPrice } as any)
        .eq("id", storeId);
      if (error) throw error;
      toast({ title: "Saved", description: `AFA storefront price set to GHC${storefrontPrice.toFixed(2)}` });
      onPriceSaved?.();
    } catch (err) {
      console.error("[SubSubagentAFAPriceManager] save error:", err);
      toast({ title: "Error", description: "Failed to save price", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const minimum = subagentCostToSubsub > 0 ? subagentCostToSubsub : adminMinPrice;
  const profit = storefrontPrice > 0 && subagentCostToSubsub > 0
    ? storefrontPrice - subagentCostToSubsub
    : 0;

  return (
    <Card className="border-green-500/30 bg-green-900/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-green-600" />
          AFA Registration — Your Storefront Price
        </CardTitle>
        <CardDescription>
          Set the price customers pay to register AFA through your store. Your cost from
          your subagent is <strong>GHC{minimum.toFixed(2)}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-sm font-medium">Your Cost (from Subagent)</Label>
            <div className="text-2xl font-bold text-muted-foreground mt-2">
              GHC{minimum.toFixed(2)}
            </div>
          </div>
          <div>
            <Label htmlFor="subsubStorefrontPrice" className="text-sm font-medium">
              Your Asking Price (GHC)
            </Label>
            <Input
              id="subsubStorefrontPrice"
              type="number"
              min={minimum}
              step="0.01"
              value={storefrontPrice || ""}
              onChange={(e) => setStorefrontPrice(Number(e.target.value) || 0)}
              className="mt-2"
              placeholder={`Min: GHC${minimum.toFixed(2)}`}
            />
          </div>
          <div className="flex flex-col justify-end">
            <Button
              onClick={handleSave}
              disabled={saving || storefrontPrice < minimum}
              className="w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Price"
              )}
            </Button>
          </div>
        </div>
        {profit > 0 && (
          <div className="text-sm text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 p-3 rounded">
            Your profit per registration: GHC{profit.toFixed(2)} (GHC{storefrontPrice.toFixed(2)}{" "}
            charged &minus; GHC{subagentCostToSubsub.toFixed(2)} cost)
          </div>
        )}
      </CardContent>
    </Card>
  );
}
