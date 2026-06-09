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
  const [loading, setLoading] = useState(true);
  const [savingBundle, setSavingBundle] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    sell_price: 0,
  });

  useEffect(() => {
    fetchData();
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
          console.log("[v0] AgentAFAPriceManager: Store updated via realtime:", { storeId: agentStore.id, payload });
          if (payload.new && 'afa_bundle_price' in payload.new) {
            const newPrice = payload.new.afa_bundle_price ?? 0;
            console.log("[v0] AgentAFAPriceManager: Updating price from realtime:", newPrice);
            setAgentBundlePrice(newPrice);
          }
        }
      )
      .subscribe((status) => {
        console.log("[v0] AgentAFAPriceManager: Subscription status:", status);
      });

    return () => {
      console.log("[v0] AgentAFAPriceManager: Unsubscribing from price updates");
      subscription.unsubscribe();
    };
  }, [agentStore?.id]); // Empty dependency - this might cause stale data across different user sessions

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get authenticated user
      const { data: authData } = await supabase.auth.getUser();
      console.log("[v0] AgentAFAPriceManager: Current authenticated user:", authData.user?.id);
      if (!authData.user) {
        toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
        return;
      }

      // Get agent store with afa_bundle_price - scoped to current user only
      const { data: store } = await supabase
        .from("agent_stores")
        .select("id, store_name, afa_bundle_price, user_id")
        .eq("user_id", authData.user.id)
        .single();

      if (!store) {
        toast({ title: "Error", description: "Agent store not found", variant: "destructive" });
        return;
      }

      console.log("[v0] AgentAFAPriceManager: Fetched store for user:", { userId: authData.user.id, storeId: store.id, afa_bundle_price: store.afa_bundle_price });
      setAgentStore(store as AgentStore);
      const bundlePrice = store.afa_bundle_price || 0;
      setAgentBundlePrice(bundlePrice);
      console.log("[v0] Agent store loaded:", { storeId: store.id, userId: store.user_id, afa_bundle_price: bundlePrice });

      // Get AFA settings - fetch first row with base_registration_price
      const { data: afaSettings } = await supabase
        .from("afa_settings")
        .select("base_registration_price")
        .order("created_at", { ascending: true })
        .limit(1);
      
      if (afaSettings && afaSettings.length > 0 && afaSettings[0].base_registration_price) {
        setMinBundlePrice(afaSettings[0].base_registration_price);
      } else {
        setMinBundlePrice(14.00);
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
        description: `AFA registration price must be at least GH₵${minimumPrice.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    if (!agentStore) return;

    setSavingBundle(true);
    console.log("[v0] Saving AFA bundle price:", { agentStoreId: agentStore.id, newPrice: agentBundlePrice });
    try {
      // Update agent store's afa_bundle_price with detailed response handling
      const { data: updateData, error: updateError } = await supabase
        .from("agent_stores")
        .update({
          afa_bundle_price: agentBundlePrice,
        })
        .eq("id", agentStore.id)
        .select("id, afa_bundle_price, user_id");

      console.log("[v0] Update response:", { data: updateData, error: updateError, storeId: agentStore.id });
      
      if (updateError) {
        console.error("[v0] Update error details:", updateError);
        throw updateError;
      }

      if (!updateData || updateData.length === 0) {
        console.error("[v0] No data returned from update");
        throw new Error("Failed to update price - no data returned");
      }

      // Use the returned data directly instead of fetching again
      const updatedPrice = updateData[0].afa_bundle_price;
      console.log("[v0] Price saved successfully:", { newPrice: updatedPrice, storeId: updateData[0].id, userId: updateData[0].user_id });
      
      // Immediately verify the write by fetching it back
      const { data: verifyData } = await supabase
        .from("agent_stores")
        .select("id, afa_bundle_price")
        .eq("id", agentStore.id)
        .single();
      console.log("[v0] Verification fetch after update:", { id: verifyData?.id, afa_bundle_price: verifyData?.afa_bundle_price });
      
      if (updatedPrice !== null && updatedPrice !== undefined) {
        setAgentBundlePrice(updatedPrice);
      } else {
        console.warn("[v0] Saved price is null, keeping current value:", agentBundlePrice);
      }

      toast({
        title: "Success",
        description: `AFA registration price updated to GH₵${agentBundlePrice.toFixed(2)}`,
      });

      // Notify parent component to refresh data
      if (onPriceSaved) {
        console.log("[v0] Calling onPriceSaved callback");
        onPriceSaved();
      }
    } catch (err) {
      console.error("[v0] Error saving bundle price:", err);
      toast({
        title: "Error",
        description: `Failed to save AFA registration price: ${err instanceof Error ? err.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setSavingBundle(false);
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
            Set the price customers must pay to register for AFA. Minimum price set by admin: GH₵{minBundlePrice !== null ? minBundlePrice.toFixed(2) : '14.00'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium">Admin Minimum Price</Label>
              <div className="text-2xl font-bold text-green-600 mt-2">GH₵{minBundlePrice !== null ? minBundlePrice.toFixed(2) : '14.00'}</div>
            </div>
            <div>
              <Label htmlFor="bundlePrice" className="text-sm font-medium">Your Asking Price (GH₵)</Label>
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
          {agentBundlePrice > 0 && agentBundlePrice >= (minBundlePrice !== null ? minBundlePrice : 14) && (
            <div className="text-sm text-green-700 bg-green-50 p-3 rounded">
              Your customers will pay GH₵{agentBundlePrice.toFixed(2)} to register for AFA
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
