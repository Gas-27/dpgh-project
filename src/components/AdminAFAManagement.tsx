import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Plus, Edit2, Trash2, Save, X } from 'lucide-react';

interface AFAPackage {
  id: string;
  name: string;
  description: string;
  base_price: number;
  max_price?: number;
  min_price?: number;
  commission_percent: number;
  is_active: boolean;
}

export default function AdminAFAManagement() {
  const [packages, setPackages] = useState<AFAPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<AFAPackage>>({
    name: '',
    description: '',
    base_price: 0,
    max_price: undefined,
    min_price: undefined,
    commission_percent: 10,
    is_active: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('afa_packages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPackages(data || []);
    } catch (error) {
      console.error('[Admin] Fetch AFA packages error:', error);
      toast({
        title: 'Error',
        description: 'Failed to load AFA packages',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditStart = (pkg: AFAPackage) => {
    setEditingId(pkg.id);
    setFormData(pkg);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.base_price) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        // Update
        const { error } = await supabase
          .from('afa_packages')
          .update(formData)
          .eq('id', editingId);

        if (error) throw error;

        setPackages((prev) =>
          prev.map((p) => (p.id === editingId ? { ...p, ...formData as AFAPackage } : p))
        );

        toast({
          title: 'Success',
          description: 'Package updated successfully',
        });
      } else {
        // Create
        const { data, error } = await supabase
          .from('afa_packages')
          .insert([formData])
          .select();

        if (error) throw error;

        if (data) {
          setPackages((prev) => [data[0], ...prev]);
        }

        toast({
          title: 'Success',
          description: 'Package created successfully',
        });
      }

      handleCancel();
    } catch (error) {
      console.error('[Admin] Save error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save package',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this package?')) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('afa_packages').delete().eq('id', id);

      if (error) throw error;

      setPackages((prev) => prev.filter((p) => p.id !== id));

      toast({
        title: 'Success',
        description: 'Package deleted successfully',
      });
    } catch (error) {
      console.error('[Admin] Delete error:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete package',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      name: '',
      description: '',
      base_price: 0,
      max_price: undefined,
      min_price: undefined,
      commission_percent: 10,
      is_active: true,
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>AFA Package Management</CardTitle>
            <CardDescription>Create and manage AFA packages and base prices</CardDescription>
          </div>
          <Button onClick={() => setShowForm(true)} disabled={loading || showForm}>
            <Plus className="h-4 w-4 mr-2" />
            New Package
          </Button>
        </CardHeader>
      </Card>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Package' : 'Create New Package'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Package Name *</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Premium AFA"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="base_price">Base Price (GHS) *</Label>
                <Input
                  id="base_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.base_price || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, base_price: parseFloat(e.target.value) || 0 }))
                  }
                  placeholder="0.00"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Package description"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min_price">Min Price (GHS)</Label>
                <Input
                  id="min_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.min_price || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      min_price: e.target.value ? parseFloat(e.target.value) : undefined,
                    }))
                  }
                  placeholder="Optional"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_price">Max Price (GHS)</Label>
                <Input
                  id="max_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.max_price || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      max_price: e.target.value ? parseFloat(e.target.value) : undefined,
                    }))
                  }
                  placeholder="Optional"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="commission_percent">Commission %</Label>
                <Input
                  id="commission_percent"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={formData.commission_percent || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, commission_percent: parseFloat(e.target.value) || 0 }))
                  }
                  placeholder="10"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={loading} className="flex-1">
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingId ? 'Update Package' : 'Create Package'}
              </Button>
              <Button variant="outline" onClick={handleCancel} disabled={loading}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {loading && packages.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12">
              <Loader2 className="h-4 w-4 animate-spin" />
              <p>Loading packages...</p>
            </div>
          ) : packages.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No AFA packages created yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Package Name</TableHead>
                    <TableHead>Base Price</TableHead>
                    <TableHead>Price Range</TableHead>
                    <TableHead>Default Commission</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packages.map((pkg) => (
                    <TableRow key={pkg.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{pkg.name}</p>
                          <p className="text-sm text-muted-foreground">{pkg.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>GHS {pkg.base_price.toFixed(2)}</TableCell>
                      <TableCell>
                        {pkg.min_price || pkg.max_price
                          ? `${pkg.min_price ? `GHS ${pkg.min_price.toFixed(2)}` : 'No min'} - ${
                              pkg.max_price ? `GHS ${pkg.max_price.toFixed(2)}` : 'No max'
                            }`
                          : 'No limits'}
                      </TableCell>
                      <TableCell>{pkg.commission_percent}%</TableCell>
                      <TableCell>
                        {pkg.is_active ? (
                          <span className="inline-block px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                            Inactive
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditStart(pkg)}
                            disabled={loading || showForm}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(pkg.id)}
                            disabled={loading || showForm}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
