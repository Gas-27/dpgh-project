'use client';

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface AgentAFAPriceManagerProps {
  onPriceSaved?: () => void;
}
import { Edit2, Loader2, DollarSign, TrendingUp, AlertCircle, Zap } from "lucide-react";

interface AFAPackage {
  id: string;
  name: string;
  base_price: number;
  commission_percent: number;
  min_price?: number;
  max_price?: number;
}

interface AgentStore {
  id: string;
  store_name: string;
  afa_bundle_price?: number;
  afa_subagent_base_price?: number;
}

interface AgentAFAPrice {
  id: string;
  afa_package_id: string;
  sell_price: number;
  commission_amount: number;
  package_name?: string;
}

export default function AgentAFAPriceManager({ onPriceSaved }: AgentAFAPriceManagerProps) {
  const [packages, setPackages] = useState<AFAPackage[]>([]);
  const [agentPrices, setAgentPrices] = useState<AgentAFAPrice[]>([]);
  const [agentStore, setAgentStore] = useState<AgentStore | null>(null);
  const [minBundlePrice, setMinBundlePrice] = useState<number | null>(null);
  const [agentBundlePrice, setAgentBundlePrice] = useState(0);
  // Price the agent sets as the base cost for subagents (afa_subagent_base_price)
  const [subagentBasePrice, setSubagentBasePrice] = useState(0);
  const [savingSubagentBase, setSavingSubagentBase] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingBundle, setSavingBundle] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    sell_price: 0,
  });

  // Fetch data when component mounts and whenever authenticated user changes
  useEffect(() => {
    const checkUserAndFetch = async () => {
      // Get the current user's ID
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData.user?.id;
      
      if (!currentUserId) {
        console.error("[v0] AgentAFAPriceManager: No authenticated user found");
        return;
      }

      console.log("[v0] AgentAFAPriceManager: Fetching data for authenticated user:", currentUserId);
      fetchData();
    };
    
    checkUserAndFetch();
  }, []);

  // Subscribe to real-time price updates for current agent only
  useEffect(() => {
    if (!agentStore?.id) return;

    console.log("[v0] AgentAFAPriceManager: Setting up real-time subscription for store:", agentStore.id);
    const subscription = supabase
      .channel(`agent_stores_${agentStore.id}_price_updates`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agent_stores',
          filter: `id=eq.${agentStore.id}`,
        },
        (payload) => {
          if (payload.new && 'afa_bundle_price' in payload.new) {
            const newPrice = payload.new.afa_bundle_price ?? 0;
            setAgentBundlePrice(newPrice);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [agentStore?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get authenticated user
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
        return;
      }

      // Get agent store with AFA pricing columns
      const { data: store } = await supabase
        .from("agent_stores")
        .select("id, store_name, afa_bundle_price, afa_subagent_base_price, user_id")
        .eq("user_id", authData.user.id)
        .single();

      if (!store) {
        toast({ title: "Error", description: "Agent store not found", variant: "destructive" });
        return;
      }

      setAgentStore(store as AgentStore);
      setAgentBundlePrice(Number(store.afa_bundle_price) || 0);
      setSubagentBasePrice(Number((store as any).afa_subagent_base_price) || 0);

      // Get AFA settings — the actual column is registration_fee
      const { data: afaSettings } = await supabase
        .from("afa_settings")
        .select("registration_fee")
        .limit(1)
        .maybeSingle();

      if (afaSettings?.registration_fee) {
        setMinBundlePrice(Number(afaSettings.registration_fee));
      } else {
        setMinBundlePrice(15);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
      toast({ title: "Error", description: "Failed to load pricing data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBundlePrice = async () => {
    const minimumPrice = minBundlePrice !== null ? minBundlePrice : 14;
    if (agentBundlePrice < minimumPrice) {
      toast({
        title: "Price too low",
        description: `AFA registration price must be at least GHC${minimumPrice.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    if (!agentStore) return;

    setSavingBundle(true);
    try {
      // Update agent store's afa_bundle_price
      const { data: updateData, error: updateError } = await supabase
        .from("agent_stores")
        .update({ afa_bundle_price: agentBundlePrice })
        .eq("id", agentStore.id)
        .select("id, afa_bundle_price");
      
      if (updateError) throw updateError;
      if (!updateData || updateData.length === 0) throw new Error("Failed to update price");

      const updatedPrice = updateData[0].afa_bundle_price;
      console.log("[v0] Price saved successfully to database:", { storeId: updateData[0].id, newPrice: updatedPrice });
      
      // Update local state with the saved value
      setAgentBundlePrice(updatedPrice || 0);
      
      // Update the agent store state with the new price
      setAgentStore(prev => prev ? { ...prev, afa_bundle_price: updatedPrice } : null);

      toast({
        title: "Success",
        description: `AFA registration price updated to GHC${agentBundlePrice.toFixed(2)}`,
      });

      // Notify parent component to refresh data
      if (onPriceSaved) {
        onPriceSaved();
      }
    } catch (err) {
      console.error("Error saving bundle price:", err);
      toast({
        title: "Error",
        description: `Failed to save AFA registration price: ${err instanceof Error ? err.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setSavingBundle(false);
    }
  };

  const handleSaveSubagentBasePrice = async () => {
    if (!agentStore) return;
    const minimum = minBundlePrice !== null ? minBundlePrice : 15;
    if (subagentBasePrice < minimum) {
      toast({
        title: "Price too low",
        description: `Subagent base price must be at least GHC${minimum.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }
    setSavingSubagentBase(true);
    try {
      const { error } = await supabase
        .from("agent_stores")
        .update({ afa_subagent_base_price: subagentBasePrice } as any)
        .eq("id", agentStore.id);
      if (error) throw error;
      setAgentStore(prev => prev ? { ...prev, afa_subagent_base_price: subagentBasePrice } : null);
      toast({ title: "Saved", description: `Subagent AFA base price set to GHC${subagentBasePrice.toFixed(2)}` });
      if (onPriceSaved) onPriceSaved();
    } catch (err) {
      console.error("[AgentAFAPriceManager] save subagent base error:", err);
      toast({ title: "Error", description: "Failed to save subagent base price", variant: "destructive" });
    } finally {
      setSavingSubagentBase(false);
    }
  };

  const handleOpenDialog = (packageId: string) => {
    const existingPrice = agentPrices.find((p) => p.afa_package_id === packageId);
    const pkg = packages.find((p) => p.id === packageId);

    if (existingPrice) {
      setFormData({ sell_price: existingPrice.sell_price });
    } else if (pkg) {
      setFormData({ sell_price: pkg.base_price });
    }

    setEditingPackageId(packageId);
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    // This is no longer needed for simple registration
    return;
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

  return (
    <div className="space-y-6">
      {/* AFA Bundle Registration Price */}
      <Card className="border-green-500/30 bg-green-900/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-green-600" />
            AFA Bundle Registration Price
          </CardTitle>
          <CardDescription>
            Set the price customers must pay to register for AFA. Minimum price set by admin: GHC{minBundlePrice !== null ? minBundlePrice.toFixed(2) : '14.00'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium">Admin Minimum Price</Label>
              <div className="text-2xl font-bold text-green-600 mt-2">GHC{minBundlePrice !== null ? minBundlePrice.toFixed(2) : '14.00'}</div>
            </div>
            <div>
              <Label htmlFor="bundlePrice" className="text-sm font-medium">Your Asking Price (GHC)</Label>
              <Input
                id="bundlePrice"
                type="number"
                min={minBundlePrice || 14}
                step="0.01"
                value={agentBundlePrice || ""}
                onChange={(e) => setAgentBundlePrice(Number(e.target.value) || 0)}
                className="mt-2"
                placeholder={`Minimum: ${minBundlePrice !== null ? minBundlePrice.toFixed(2) : '14.00'}`}
              />
            </div>
            <div className="flex flex-col justify-end">
              <Button 
                onClick={handleSaveBundlePrice}
                disabled={savingBundle || agentBundlePrice < (minBundlePrice !== null ? minBundlePrice : 14)}
                className="w-full"
              >
                {savingBundle ? (
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
          {agentBundlePrice > 0 && agentBundlePrice >= (minBundlePrice !== null ? minBundlePrice : 15) && (
            <div className="text-sm text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400 p-3 rounded">
              Your customers will pay GHC{agentBundlePrice.toFixed(2)} to register for AFA
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subagent Base Price — what the agent charges subagents */}
      <Card className="border-blue-500/30 bg-blue-900/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            AFA Bundle Price for Subagents
          </CardTitle>
          <CardDescription>
            Set the price your subagents pay per AFA registration (their cost). Subagents then add their own markup to earn profit. Minimum is the admin base price: GHC{(minBundlePrice ?? 15).toFixed(2)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium">Admin Minimum</Label>
              <div className="text-2xl font-bold text-muted-foreground mt-2">GHC{(minBundlePrice ?? 15).toFixed(2)}</div>
            </div>
            <div>
              <Label htmlFor="subagentBasePrice" className="text-sm font-medium">Subagent Base Price (GHC)</Label>
              <Input
                id="subagentBasePrice"
                type="number"
                min={minBundlePrice ?? 15}
                step="0.01"
                value={subagentBasePrice || ""}
                onChange={(e) => setSubagentBasePrice(Number(e.target.value) || 0)}
                className="mt-2"
                placeholder={`Min: GHC${(minBundlePrice ?? 15).toFixed(2)}`}
              />
            </div>
            <div className="flex flex-col justify-end">
              <Button
                onClick={handleSaveSubagentBasePrice}
                disabled={savingSubagentBase || subagentBasePrice < (minBundlePrice ?? 15)}
                className="w-full"
              >
                {savingSubagentBase ? (
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
          {subagentBasePrice > 0 && subagentBasePrice >= (minBundlePrice ?? 15) && (
            <div className="text-sm text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 p-3 rounded">
              Subagents will pay GHC{subagentBasePrice.toFixed(2)} as their cost per AFA registration.
              {agentBundlePrice > 0 && subagentBasePrice > 0 && (
                <> Your commission per subagent sale: GHC{Math.max(0, subagentBasePrice - (minBundlePrice ?? 15)).toFixed(2)}.</>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
