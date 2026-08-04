'use client';

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Zap } from "lucide-react";

interface SubagentAFAPriceManagerProps {
  onPriceSaved?: () => void;
}

export default function SubagentAFAPriceManager({ onPriceSaved }: SubagentAFAPriceManagerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [savingStorefront, setSavingStorefront] = useState(false);
  const [savingSubsub, setSavingSubsub] = useState(false);

  // Admin-set minimum (from afa_settings)
  const [adminMinPrice, setAdminMinPrice] = useState<number>(14);
  // What the agent charges this subagent (agent_stores.afa_bundle_price)
  const [agentCostToSubagent, setAgentCostToSubagent] = useState<number>(0);

  // Price subagent charges on their own storefront (customers pay this)
  const [storefrontPrice, setStorefrontPrice] = useState<number>(0);
  // Base price subagent gives their sub-subagents (sub-subagents' cost)
  const [subsubPrice, setSubsubPrice] = useState<number>(0);

  const [storeId, setStoreId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;

      const { data: store, error: storeErr } = await supabase
        .from("subagent_stores")
        .select("id, afa_bundle_price, afa_subsubagent_base_price, agent_store_id")
        .eq("user_id", authData.user.id)
        .single();

      if (storeErr || !store) {
        toast({ title: "Error", description: "Subagent store not found", variant: "destructive" });
        return;
      }

      setStoreId(store.id);
      setStorefrontPrice((store as any).afa_bundle_price || 0);
      setSubsubPrice((store as any).afa_subsubagent_base_price || 0);

      // Fetch the agent's dedicated subagent AFA base price (afa_subagent_base_price).
      // This is the price the agent set specifically for what subagents pay — NOT afa_bundle_price
      // (which is what the agent charges their direct customers).
      // Falls back to afa_bundle_price if afa_subagent_base_price has not been set yet.
      if (store.agent_store_id) {
        const { data: agentStore } = await supabase
          .from("agent_stores")
          .select("afa_subagent_base_price, afa_bundle_price")
          .eq("id", store.agent_store_id)
          .single();
        if (agentStore) {
          const cost =
            Number((agentStore as any).afa_subagent_base_price || 0) ||
            Number(agentStore.afa_bundle_price || 0) ||
            0;
          setAgentCostToSubagent(cost);
        }
      }

      // Fetch admin minimum AFA registration price
      const { data: afaSettings } = await supabase
        .from("afa_settings")
        .select("registration_fee")
        .single();

      if (afaSettings?.registration_fee) {
        setAdminMinPrice(Number(afaSettings.registration_fee));
      }
    } catch (err) {
      console.error("[SubagentAFAPriceManager] fetchData error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStorefrontPrice = async () => {
    if (!storeId) return;
    const minimum = agentCostToSubagent > 0 ? agentCostToSubagent : adminMinPrice;
    if (storefrontPrice < minimum) {
      toast({
        title: "Price too low",
        description: `Your storefront price must be at least GHC${minimum.toFixed(2)} (your cost from agent)`,
        variant: "destructive",
      });
      return;
    }
    setSavingStorefront(true);
    try {
      const { error } = await supabase
        .from("subagent_stores")
        .update({ afa_bundle_price: storefrontPrice })
        .eq("id", storeId);
      if (error) throw error;
      toast({ title: "Saved", description: `Storefront AFA price set to GHC${storefrontPrice.toFixed(2)}` });
      onPriceSaved?.();
    } catch (err) {
      console.error("[SubagentAFAPriceManager] save storefront error:", err);
      toast({ title: "Error", description: "Failed to save storefront price", variant: "destructive" });
    } finally {
      setSavingStorefront(false);
    }
  };

  const handleSaveSubsubPrice = async () => {
    if (!storeId) return;
    // Sub-subagent base must be >= agent's price to this subagent (not just admin min)
    const subsubMinimum = agentCostToSubagent > 0 ? agentCostToSubagent : adminMinPrice;
    if (subsubPrice < subsubMinimum) {
      toast({
        title: "Price too low",
        description: `Sub-subagent base price must be at least GHC${subsubMinimum.toFixed(2)} (your cost from agent)`,
        variant: "destructive",
      });
      return;
    }
    if (storefrontPrice > 0 && subsubPrice > storefrontPrice) {
      toast({
        title: "Price too high",
        description: `Sub-subagent base price cannot exceed your storefront price (GHC${storefrontPrice.toFixed(2)})`,
        variant: "destructive",
      });
      return;
    }
    setSavingSubsub(true);
    try {
      const { error } = await supabase
        .from("subagent_stores")
        .update({ afa_subsubagent_base_price: subsubPrice } as any)
        .eq("id", storeId);
      if (error) throw error;
      toast({ title: "Saved", description: `Sub-subagent AFA base price set to GHC${subsubPrice.toFixed(2)}` });
      onPriceSaved?.();
    } catch (err) {
      console.error("[SubagentAFAPriceManager] save subsub error:", err);
      toast({ title: "Error", description: "Failed to save sub-subagent price", variant: "destructive" });
    } finally {
      setSavingSubsub(false);
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

  const minimum = agentCostToSubagent > 0 ? agentCostToSubagent : adminMinPrice;
  const storefrontProfit =
    storefrontPrice > 0 && agentCostToSubagent > 0
      ? storefrontPrice - agentCostToSubagent
      : 0;

  return (
    <div className="space-y-6">
      {/* ── STOREFRONT PRICE ── what customers on this subagent's store pay */}
      <Card className="border-green-500/30 bg-green-900/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-green-600" />
            AFA Registration — Your Storefront Price
          </CardTitle>
          <CardDescription>
            Set the price customers pay to register AFA through your store. Your cost from
            your agent is{" "}
            <strong>GHC{minimum.toFixed(2)}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium">Your Cost (from Agent)</Label>
              <div className="text-2xl font-bold text-muted-foreground mt-2">
                GHC{minimum.toFixed(2)}
              </div>
            </div>
            <div>
              <Label htmlFor="storefrontPrice" className="text-sm font-medium">
                Your Asking Price (GHC)
              </Label>
              <Input
                id="storefrontPrice"
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
                onClick={handleSaveStorefrontPrice}
                disabled={savingStorefront || storefrontPrice < minimum}
                className="w-full"
              >
                {savingStorefront ? (
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
          {storefrontProfit > 0 && (
            <div className="text-sm text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 p-3 rounded">
              Your profit per registration: GHC{storefrontProfit.toFixed(2)} (GHC
              {storefrontPrice.toFixed(2)} charged &minus; GHC{agentCostToSubagent.toFixed(2)}{" "}
              cost)
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── SUB-SUBAGENT BASE PRICE ── what sub-subagents pay (their cost) */}
      <Card className="border-blue-500/30 bg-blue-900/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            AFA Registration — Price for Your Sub-Subagents
          </CardTitle>
          <CardDescription>
            Set the base price your sub-subagents pay per AFA registration. They set their own
            storefront price above this to earn their own profit. Minimum is your cost from
            agent (GHC{(agentCostToSubagent > 0 ? agentCostToSubagent : adminMinPrice).toFixed(2)}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(() => {
              const subsubMin = agentCostToSubagent > 0 ? agentCostToSubagent : adminMinPrice;
              return (
                <>
                  <div>
                    <Label className="text-sm font-medium">Your Cost (from Agent)</Label>
                    <div className="text-2xl font-bold text-muted-foreground mt-2">
                      GHC{subsubMin.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="subsubPrice" className="text-sm font-medium">
                      Sub-Subagent Base Price (GHC)
                    </Label>
                    <Input
                      id="subsubPrice"
                      type="number"
                      min={subsubMin}
                      step="0.01"
                      value={subsubPrice || ""}
                      onChange={(e) => setSubsubPrice(Number(e.target.value) || 0)}
                      className="mt-2"
                      placeholder={`Min: GHC${subsubMin.toFixed(2)}`}
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <Button
                      onClick={handleSaveSubsubPrice}
                      disabled={savingSubsub || subsubPrice < subsubMin}
                      className="w-full"
                    >
                      {savingSubsub ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Price"
                      )}
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
          {(() => {
            const subsubMin = agentCostToSubagent > 0 ? agentCostToSubagent : adminMinPrice;
            return subsubPrice > 0 && subsubPrice >= subsubMin ? (
              <div className="text-sm text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 p-3 rounded">
                Sub-subagents will pay GHC{subsubPrice.toFixed(2)} per AFA registration.
                {agentCostToSubagent > 0 && subsubPrice > agentCostToSubagent && (
                  <>
                    {" "}Your commission per sub-subagent sale: GHC
                    {(subsubPrice - agentCostToSubagent).toFixed(2)}.
                  </>
                )}
              </div>
            ) : null;
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
