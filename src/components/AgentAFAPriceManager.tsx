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
import { Edit2, Loader2, DollarSign, TrendingUp, AlertCircle } from "lucide-react";

interface AFAPackage {
  id: string;
  name: string;
  base_price: number;
  commission_percent: number;
  min_price?: number;
  max_price?: number;
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
  const [loading, setLoading] = useState(true);
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

      // Get agent store ID
      const { data: agentStore } = await supabase
        .from("agent_stores")
        .select("id")
        .eq("user_id", authData.user.id)
        .single();

      if (!agentStore) {
        toast({ title: "Error", description: "Agent store not found", variant: "destructive" });
        return;
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
        .eq("agent_store_id", agentStore.id);

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

  if (packages.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">No AFA packages available. Contact admin to create packages.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">AFA Package Pricing</h3>
        <p className="text-sm text-muted-foreground">Set your selling prices for each AFA package</p>
      </div>

      <Card>
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
      </Card>

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
