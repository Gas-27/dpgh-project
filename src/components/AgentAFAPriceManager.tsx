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

export default function AgentAFAPriceManager() {
  const [packages, setPackages] = useState<AFAPackage[]>([]);
  const [agentPrices, setAgentPrices] = useState<AgentAFAPrice[]>([]);
  const [agentStore, setAgentStore] = useState<AgentStore | null>(null);
  const [minBundlePrice, setMinBundlePrice] = useState(13.00);
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

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get authenticated user
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
        return;
      }

      // Get agent store ID and AFA bundle price
      const { data: store } = await supabase
        .from("agent_stores")
        .select("id, store_name, afa_bundle_price")
        .eq("user_id", authData.user.id)
        .single();

      if (!store) {
        toast({ title: "Error", description: "Agent store not found", variant: "destructive" });
        return;
      }

      setAgentStore(store as AgentStore);
      setAgentBundlePrice(store.afa_bundle_price || 0);

      // Get AFA settings to show minimum price
      try {
        const { data: afaSettings } = await supabase
          .from("afa_settings")
          .select("bundle_price")
          .single();
        
        if (afaSettings?.bundle_price) {
          setMinBundlePrice(afaSettings.bundle_price);
        }
      } catch (err) {
        console.log("[v0] AFA settings not found, using default minimum");
        setMinBundlePrice(13.00);
      }

      // Fetch available AFA packages
      const { data: pkgsData, error: pkgsError } = await supabase
        .from("afa_packages")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (pkgsError) throw pkgsError;

      // Fetch agent's current prices
      const { data: pricesData, error: pricesError } = await supabase
        .from("agent_afa_prices")
        .select("*")
        .eq("agent_store_id", store.id);

      if (pricesError) throw pricesError;

      // Merge data
      const packagesWithPrices = (pkgsData || []).map((pkg) => {
        const existingPrice = (pricesData || []).find((p) => p.afa_package_id === pkg.id);
        return {
          ...pkg,
          existing_price: existingPrice,
        };
      });

      setPackages(pkgsData || []);
      setAgentPrices(pricesData || []);
    } catch (err) {
      console.error("Failed to fetch data:", err);
      toast({ title: "Error", description: "Failed to load pricing data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBundlePrice = async () => {
    if (agentBundlePrice < minBundlePrice) {
      toast({
        title: "Price too low",
        description: `AFA Bundle price must be at least GH₵${minBundlePrice.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    if (!agentStore) return;

    setSavingBundle(true);
    try {
      const { error } = await supabase
        .from("agent_stores")
        .update({ afa_bundle_price: agentBundlePrice })
        .eq("id", agentStore.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `AFA Bundle price updated to GH₵${agentBundlePrice.toFixed(2)}`,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save bundle price",
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
    if (formData.sell_price <= 0) {
      toast({ title: "Error", description: "Please enter a valid price", variant: "destructive" });
      return;
    }

    const pkg = packages.find((p) => p.id === editingPackageId);
    if (!pkg) return;

    // Validate price is within limits if set
    if (pkg.min_price && formData.sell_price < pkg.min_price) {
      toast({
        title: "Error",
        description: `Price must be at least GHS ${pkg.min_price.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    if (pkg.max_price && formData.sell_price > pkg.max_price) {
      toast({
        title: "Error",
        description: `Price cannot exceed GHS ${pkg.max_price.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        toast({ title: "Error", description: "Not authenticated", variant: "destructive" });
        return;
      }

      const { data: agentStore } = await supabase
        .from("agent_stores")
        .select("id")
        .eq("user_id", authData.user.id)
        .single();

      if (!agentStore) {
        toast({ title: "Error", description: "Agent store not found", variant: "destructive" });
        return;
      }

      const commissionAmount = formData.sell_price * (pkg.commission_percent / 100);

      const existingPrice = agentPrices.find((p) => p.afa_package_id === editingPackageId);

      if (existingPrice) {
        // Update existing price
        const { error } = await supabase
          .from("agent_afa_prices")
          .update({
            sell_price: formData.sell_price,
            commission_amount: commissionAmount,
          })
          .eq("id", existingPrice.id);

        if (error) throw error;
        toast({ title: "Success", description: "AFA price updated successfully" });
      } else {
        // Create new price
        const { error } = await supabase.from("agent_afa_prices").insert([
          {
            agent_store_id: agentStore.id,
            afa_package_id: editingPackageId,
            sell_price: formData.sell_price,
            commission_amount: commissionAmount,
          },
        ]);

        if (error) throw error;
        toast({ title: "Success", description: "AFA price set successfully" });
      }

      setShowDialog(false);
      fetchData();
    } catch (err) {
      console.error("Failed to save price:", err);
      toast({ title: "Error", description: (err as any).message || "Failed to save price", variant: "destructive" });
    } finally {
      setSubmitting(false);
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
            Set the price customers must pay to register for AFA. Minimum price set by admin: GH₵{minBundlePrice.toFixed(2)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium">Admin Minimum Price</Label>
              <div className="text-2xl font-bold text-green-600 mt-2">GH₵{minBundlePrice.toFixed(2)}</div>
            </div>
            <div>
              <Label htmlFor="bundlePrice" className="text-sm font-medium">Your Asking Price (GH₵)</Label>
              <Input
                id="bundlePrice"
                type="number"
                min={minBundlePrice}
                step="0.01"
                value={agentBundlePrice || ""}
                onChange={(e) => setAgentBundlePrice(Number(e.target.value) || 0)}
                className="mt-2"
                placeholder={`Minimum: ${minBundlePrice.toFixed(2)}`}
              />
            </div>
            <div className="flex flex-col justify-end">
              <Button 
                onClick={handleSaveBundlePrice}
                disabled={savingBundle || agentBundlePrice < minBundlePrice}
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
          {agentBundlePrice > 0 && agentBundlePrice >= minBundlePrice && (
            <div className="text-sm text-green-700 bg-green-50 p-3 rounded">
              Your customers will pay GH₵{agentBundlePrice.toFixed(2)} to register for AFA
            </div>
          )}
        </CardContent>
      </Card>

      {/* AFA Packages Pricing */}
      {packages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              AFA Package Pricing
            </CardTitle>
            <CardDescription>
              Set individual prices for each AFA package. Customers see these prices on your storefront.
            </CardDescription>
          </CardHeader>
          <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Package Name</TableHead>
              <TableHead>Admin Base Price</TableHead>
              <TableHead>Your Selling Price</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead>Your Profit</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.map((pkg) => {
              const agentPrice = agentPrices.find((p) => p.afa_package_id === pkg.id);
              const sellPrice = agentPrice?.sell_price || 0;
              const commission = agentPrice?.commission_amount || (pkg.base_price * pkg.commission_percent) / 100;
              const profit = sellPrice - pkg.base_price;

              return (
                <TableRow key={pkg.id}>
                  <TableCell className="font-medium">{pkg.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      {pkg.base_price.toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {agentPrice ? (
                      <Badge variant="default">{sellPrice.toFixed(2)}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Not set
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      {commission.toFixed(2)} ({pkg.commission_percent}%)
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={profit > 0 ? "text-green-600 font-semibold" : "text-muted-foreground"}>
                      {profit.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => handleOpenDialog(pkg.id)}>
                      <Edit2 className="h-4 w-4 mr-1" />
                      {agentPrice ? "Edit" : "Set Price"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
          </CardContent>
        </Card>
      )}

      {/* Price Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set AFA Selling Price</DialogTitle>
            <DialogDescription>
              {packages.find((p) => p.id === editingPackageId)?.name || "Package"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {editingPackageId && (
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Admin Base Price:</span>
                  <span className="font-semibold">
                    {packages.find((p) => p.id === editingPackageId)?.base_price.toFixed(2)}
                  </span>
                </div>
                {packages.find((p) => p.id === editingPackageId)?.min_price && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Minimum Price:</span>
                    <span className="font-semibold">
                      {packages.find((p) => p.id === editingPackageId)?.min_price?.toFixed(2)}
                    </span>
                  </div>
                )}
                {packages.find((p) => p.id === editingPackageId)?.max_price && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Maximum Price:</span>
                    <span className="font-semibold">
                      {packages.find((p) => p.id === editingPackageId)?.max_price?.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="sell_price">Your Selling Price (GHS) *</Label>
              <Input
                id="sell_price"
                type="number"
                step="0.01"
                placeholder="50.00"
                value={formData.sell_price || ""}
                onChange={(e) => setFormData({ sell_price: parseFloat(e.target.value) || 0 })}
              />
              {editingPackageId && (
                <p className="text-xs text-muted-foreground mt-2">
                  Your profit per sale:{" "}
                  <span className="font-semibold">
                    {(
                      (formData.sell_price || 0) - (packages.find((p) => p.id === editingPackageId)?.base_price || 0)
                    ).toFixed(2)}{" "}
                    GHS
                  </span>
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save Price
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
