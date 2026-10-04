'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Save } from 'lucide-react';

interface AFAPackage {
  id: string;
  name: string;
  base_price: number;
  commission_percent: number;
  is_active: boolean;
}

export default function AdminAFAPriceManager() {
  const [packages, setPackages] = useState<AFAPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrices, setEditPrices] = useState<Record<string, { base_price: number; commission_percent: number }>>({});
  const [newPackage, setNewPackage] = useState({ name: '', base_price: 0, commission_percent: 10 });
  const { toast } = useToast();

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('afa_packages')
        .select('id, name, base_price, commission_percent, is_active')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPackages(data || []);
    } catch (err) {
      console.error('[v0] Failed to fetch AFA packages:', err);
      toast({ title: 'Error', description: 'Failed to load AFA packages', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePrice = async (packageId: string) => {
    if (!editPrices[packageId]) return;

    try {
      const { base_price, commission_percent } = editPrices[packageId];
      const { error } = await supabase
        .from('afa_packages')
        .update({ base_price, commission_percent })
        .eq('id', packageId);

      if (error) throw error;
      toast({ title: 'Success', description: 'AFA package price updated' });
      setEditingId(null);
      await fetchPackages();
    } catch (err) {
      console.error('[v0] Failed to update price:', err);
      toast({ title: 'Error', description: 'Failed to update price', variant: 'destructive' });
    }
  };

  const handleAddPackage = async () => {
    if (!newPackage.name || newPackage.base_price <= 0) {
      toast({ title: 'Error', description: 'Please fill all fields with valid values', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase.from('afa_packages').insert([
        {
          name: newPackage.name,
          base_price: newPackage.base_price,
          commission_percent: newPackage.commission_percent,
          is_active: true,
        },
      ]);

      if (error) throw error;
      toast({ title: 'Success', description: 'AFA package created' });
      setNewPackage({ name: '', base_price: 0, commission_percent: 10 });
      await fetchPackages();
    } catch (err) {
      console.error('[v0] Failed to create package:', err);
      toast({ title: 'Error', description: 'Failed to create package', variant: 'destructive' });
    }
  };

  const handleDeletePackage = async (packageId: string) => {
    if (!confirm('Delete this AFA package?')) return;

    try {
      const { error } = await supabase.from('afa_packages').delete().eq('id', packageId);
      if (error) throw error;
      toast({ title: 'Success', description: 'AFA package deleted' });
      await fetchPackages();
    } catch (err) {
      console.error('[v0] Failed to delete:', err);
      toast({ title: 'Error', description: 'Failed to delete package', variant: 'destructive' });
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
    <div className="space-y-6">
      {/* Add New Package */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add New AFA Package
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Package Name</Label>
              <Input
                value={newPackage.name}
                onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                placeholder="e.g., Premium AFA"
              />
            </div>
            <div>
              <Label>Base Price (GHS)</Label>
              <Input
                type="number"
                value={newPackage.base_price || ''}
                onChange={(e) => setNewPackage({ ...newPackage, base_price: parseFloat(e.target.value) || 0 })}
                placeholder="50.00"
              />
            </div>
            <div>
              <Label>Commission % (for agents)</Label>
              <Input
                type="number"
                value={newPackage.commission_percent || ''}
                onChange={(e) => setNewPackage({ ...newPackage, commission_percent: parseFloat(e.target.value) || 10 })}
                placeholder="15"
              />
            </div>
          </div>
          <Button onClick={handleAddPackage} className="w-full">Create Package</Button>
        </CardContent>
      </Card>

      {/* Existing Packages */}
      <Card>
        <CardHeader>
          <CardTitle>AFA Packages - Base Prices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Package Name</TableHead>
                <TableHead>Base Price</TableHead>
                <TableHead>Agent Commission %</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell>{pkg.name}</TableCell>
                  <TableCell>
                    {editingId === pkg.id ? (
                      <Input
                        type="number"
                        value={editPrices[pkg.id]?.base_price || pkg.base_price}
                        onChange={(e) =>
                          setEditPrices({
                            ...editPrices,
                            [pkg.id]: { ...editPrices[pkg.id], base_price: parseFloat(e.target.value) || 0 },
                          })
                        }
                        className="w-24"
                      />
                    ) : (
                      `GHS ${pkg.base_price.toFixed(2)}`
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === pkg.id ? (
                      <Input
                        type="number"
                        value={editPrices[pkg.id]?.commission_percent || pkg.commission_percent}
                        onChange={(e) =>
                          setEditPrices({
                            ...editPrices,
                            [pkg.id]: { ...editPrices[pkg.id], commission_percent: parseFloat(e.target.value) || 0 },
                          })
                        }
                        className="w-24"
                      />
                    ) : (
                      `${pkg.commission_percent}%`
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {editingId === pkg.id ? (
                        <Button
                          size="sm"
                          onClick={() => handleSavePrice(pkg.id)}
                          className="gap-1"
                        >
                          <Save className="h-3 w-3" /> Save
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(pkg.id);
                            setEditPrices({
                              [pkg.id]: { base_price: pkg.base_price, commission_percent: pkg.commission_percent },
                            });
                          }}
                        >
                          Edit
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeletePackage(pkg.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {packages.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">No AFA packages created yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
