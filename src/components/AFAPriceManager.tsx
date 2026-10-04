import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { getAFAPackages, setAFAPrice } from '@/services/afa-service';
import { Loader2, Edit2, Save, X } from 'lucide-react';

interface AFAPriceManagerProps {
  storeId: string;
  storeType: 'agent' | 'subagent';
}

interface AFAPackage {
  id: string;
  name: string;
  description: string;
  base_price: number;
  max_price?: number;
  min_price?: number;
  sell_price?: number;
  commission_amount?: number;
}

export default function AFAPriceManager({ storeId, storeType }: AFAPriceManagerProps) {
  const [packages, setPackages] = useState<AFAPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrices, setEditPrices] = useState<Record<string, number>>({});
  const { toast } = useToast();

  useEffect(() => {
    const fetchPackages = async () => {
      setLoading(true);
      try {
        const data = await getAFAPackages(storeId, storeType);
        setPackages(data || []);
      } catch (error) {
        console.error('[AFA] Fetch packages error:', error);
        toast({
          title: 'Error',
          description: 'Failed to load AFA packages',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, [storeId, storeType, toast]);

  const handleEditStart = (pkg: AFAPackage) => {
    setEditingId(pkg.id);
    setEditPrices({ [pkg.id]: pkg.sell_price || pkg.base_price });
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditPrices({});
  };

  const handleSavePrice = async (pkg: AFAPackage) => {
    const newPrice = editPrices[pkg.id];

    if (!newPrice) {
      toast({
        title: 'Error',
        description: 'Please enter a valid price',
        variant: 'destructive',
      });
      return;
    }

    // Validate price range if limits are set
    if (pkg.min_price && newPrice < pkg.min_price) {
      toast({
        title: 'Error',
        description: `Price must be at least GHS ${pkg.min_price.toFixed(2)}`,
        variant: 'destructive',
      });
      return;
    }

    if (pkg.max_price && newPrice > pkg.max_price) {
      toast({
        title: 'Error',
        description: `Price cannot exceed GHS ${pkg.max_price.toFixed(2)}`,
        variant: 'destructive',
      });
      return;
    }

    // Calculate commission
    const basePrice = pkg.base_price;
    const commission = newPrice - basePrice;

    setLoading(true);
    try {
      const result = await setAFAPrice(storeId, storeType, pkg.id, newPrice, commission);

      if (result.success) {
        // Update local state
        setPackages((prev) =>
          prev.map((p) =>
            p.id === pkg.id
              ? {
                  ...p,
                  sell_price: newPrice,
                  commission_amount: commission,
                }
              : p
          )
        );

        toast({
          title: 'Success',
          description: 'Price updated successfully',
        });

        setEditingId(null);
        setEditPrices({});
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('[AFA] Save price error:', error);
      toast({
        title: 'Error',
        description: 'Failed to save price',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && packages.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <p>Loading AFA packages...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (packages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AFA Pricing</CardTitle>
          <CardDescription>Manage your AFA package prices</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No AFA packages available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AFA Pricing Management</CardTitle>
        <CardDescription>
          Set your selling prices for AFA packages. Your commission is calculated as (Sell Price - Base Price).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Package</TableHead>
                <TableHead>Base Price</TableHead>
                <TableHead>Your Price</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Margin %</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((pkg) => {
                const isEditing = editingId === pkg.id;
                const currentPrice = editPrices[pkg.id] || pkg.sell_price || pkg.base_price;
                const commission = currentPrice - pkg.base_price;
                const marginPercent = ((commission / pkg.base_price) * 100).toFixed(1);

                return (
                  <TableRow key={pkg.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{pkg.name}</p>
                        <p className="text-sm text-muted-foreground">{pkg.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>GHS {pkg.base_price.toFixed(2)}</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            min={pkg.min_price || 0}
                            max={pkg.max_price || undefined}
                            value={editPrices[pkg.id] || ''}
                            onChange={(e) =>
                              setEditPrices((prev) => ({
                                ...prev,
                                [pkg.id]: parseFloat(e.target.value) || 0,
                              }))
                            }
                            className="w-24"
                            disabled={loading}
                          />
                        </div>
                      ) : (
                        <span>GHS {(pkg.sell_price || pkg.base_price).toFixed(2)}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <span>GHS {commission.toFixed(2)}</span>
                      ) : (
                        <span>GHS {((pkg.sell_price || pkg.base_price) - pkg.base_price).toFixed(2)}</span>
                      )}
                    </TableCell>
                    <TableCell>{marginPercent}%</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSavePrice(pkg)}
                            disabled={loading}
                          >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEditCancel}
                            disabled={loading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditStart(pkg)}
                          disabled={loading}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 p-3 rounded-md bg-blue-50 border border-blue-200">
          <p className="text-sm text-blue-900">
            <strong>Tip:</strong> Set prices higher than the base price to earn commission. Check your min/max price limits before saving.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
