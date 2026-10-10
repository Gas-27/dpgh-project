'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit2, Loader2, DollarSign, Percent } from "lucide-react";

interface AFAPackage {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  max_price: number | null;
  min_price: number | null;
  commission_percent: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminAFAPackageManager() {
  const [packages, setPackages] = useState<AFAPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingPackage, setEditingPackage] = useState<AFAPackage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Initialize supabase safely
  const getSupabase = () => {
    try {
      const { supabase } = require("@/integrations/supabase/client");
      return supabase;
    } catch (err) {
      console.error("Failed to initialize Supabase:", err);
      return null;
    }
  };

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    base_price: 0,
    max_price: 0,
    min_price: 0,
    commission_percent: 10,
  });

  // Fetch packages
  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error("Supabase not initialized");
      }
      const { data, error } = await supabase
        .from("afa_packages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPackages(data || []);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to fetch AFA packages";
      console.error("[v0] Failed to fetch AFA packages:", err);
      setError(errorMsg);
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (pkg?: AFAPackage) => {
    if (pkg) {
      setEditingPackage(pkg);
      setFormData({
        name: pkg.name,
        description: pkg.description || "",
        base_price: pkg.base_price,
        max_price: pkg.max_price || 0,
        min_price: pkg.min_price || 0,
        commission_percent: pkg.commission_percent,
      });
    } else {
      setEditingPackage(null);
      setFormData({
        name: "",
        description: "",
        base_price: 0,
        max_price: 0,
        min_price: 0,
        commission_percent: 10,
      });
    }
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || formData.base_price <= 0) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error("Supabase not initialized");
      }
      
      if (editingPackage) {
        // Update existing package
        const { error } = await supabase
          .from("afa_packages")
          .update({
            name: formData.name,
            description: formData.description || null,
            base_price: formData.base_price,
            max_price: formData.max_price || null,
            min_price: formData.min_price || null,
            commission_percent: formData.commission_percent,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingPackage.id);

        if (error) throw error;
        toast({ title: "Success", description: "AFA package updated successfully" });
      } else {
        // Create new package
        const { error } = await supabase.from("afa_packages").insert([
          {
            name: formData.name,
            description: formData.description || null,
            base_price: formData.base_price,
            max_price: formData.max_price || null,
            min_price: formData.min_price || null,
            commission_percent: formData.commission_percent,
            is_active: true,
          },
        ]);

        if (error) throw error;
        toast({ title: "Success", description: "AFA package created successfully" });
      }

      setShowDialog(false);
      fetchPackages();
    } catch (err) {
      console.error("Failed to save AFA package:", err);
      toast({ title: "Error", description: (err as any).message || "Failed to save package", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this AFA package?")) return;

    try {
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error("Supabase not initialized");
      }
      
      const { error } = await supabase.from("afa_packages").delete().eq("id", id);

      if (error) throw error;
      toast({ title: "Success", description: "AFA package deleted successfully" });
      fetchPackages();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete package";
      console.error("[v0] Failed to delete AFA package:", err);
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
    }
  };

  const toggleActive = async (pkg: AFAPackage) => {
    try {
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error("Supabase not initialized");
      }
      
      const { error } = await supabase
        .from("afa_packages")
        .update({ is_active: !pkg.is_active })
        .eq("id", pkg.id);

      if (error) throw error;
      toast({ title: "Success", description: `Package ${!pkg.is_active ? "activated" : "deactivated"}` });
      fetchPackages();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to update package status";
      console.error("[v0] Failed to toggle package status:", err);
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-red-500">
            <p className="font-semibold">Failed to load AFA packages</p>
            <p className="text-sm mt-2">{error}</p>
            <Button onClick={() => fetchPackages()} className="mt-4">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">AFA Packages</h3>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" /> Create Package
        </Button>
      </div>

      {packages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No AFA packages created yet. Create your first package to get started.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Package Name</TableHead>
                <TableHead>Base Price (GHS)</TableHead>
                <TableHead>Commission %</TableHead>
                <TableHead>Price Range</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell className="font-medium">{pkg.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      {pkg.base_price.toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Percent className="h-4 w-4 text-blue-600" />
                      {pkg.commission_percent}%
                    </div>
                  </TableCell>
                  <TableCell>
                    {pkg.min_price && pkg.max_price ? (
                      <span className="text-sm text-muted-foreground">
                        {pkg.min_price.toFixed(2)} - {pkg.max_price.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not set</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pkg.is_active ? "default" : "secondary"}>
                      {pkg.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenDialog(pkg)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={pkg.is_active ? "ghost" : "outline"}
                        size="sm"
                        onClick={() => toggleActive(pkg)}
                      >
                        {pkg.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(pkg.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPackage ? "Edit AFA Package" : "Create AFA Package"}</DialogTitle>
            <DialogDescription>
              {editingPackage ? "Update the package details below" : "Create a new AFA package for customers"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Package Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Premium AFA"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Package description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="base_price">Base Price (GHS) *</Label>
                <Input
                  id="base_price"
                  type="number"
                  step="0.01"
                  placeholder="50.00"
                  value={formData.base_price || ""}
                  onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label htmlFor="commission">Commission % *</Label>
                <Input
                  id="commission"
                  type="number"
                  step="0.1"
                  placeholder="10"
                  value={formData.commission_percent || ""}
                  onChange={(e) => setFormData({ ...formData, commission_percent: parseFloat(e.target.value) || 10 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="min_price">Min Price (GHS)</Label>
                <Input
                  id="min_price"
                  type="number"
                  step="0.01"
                  placeholder="40.00"
                  value={formData.min_price || ""}
                  onChange={(e) => setFormData({ ...formData, min_price: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label htmlFor="max_price">Max Price (GHS)</Label>
                <Input
                  id="max_price"
                  type="number"
                  step="0.01"
                  placeholder="60.00"
                  value={formData.max_price || ""}
                  onChange={(e) => setFormData({ ...formData, max_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {editingPackage ? "Update Package" : "Create Package"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
