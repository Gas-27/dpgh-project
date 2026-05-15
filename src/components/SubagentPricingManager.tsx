import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SubagentPricingManagerProps {
  subagentStoreId: string;
  subagentStoreName: string;
  agentStoreId: string;
}

interface DataPackage {
  id: string;
  network: string;
  size_gb: number;
  price: number;
  agent_price: number;
}

interface SubagentPrice {
  id: string;
  package_id: string;
  base_cost: number;
  sell_price: number;
}

const SubagentPricingManager = ({
  subagentStoreId,
  subagentStoreName,
  agentStoreId,
}: SubagentPricingManagerProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<DataPackage[]>([]);
  const [prices, setPrices] = useState<Record<string, SubagentPrice>>({});
  const [tempPrices, setTempPrices] = useState<Record<string, string>>({});
  const [selectedNetwork, setSelectedNetwork] = useState("mtn");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        // Fetch packages
        const { data: pkgData, error: pkgError } = await supabase
          .from("data_packages")
          .select("*")
          .eq("active", true)
          .order("network")
          .order("size_gb");

        if (pkgError) throw pkgError;
        setPackages((pkgData || []) as DataPackage[]);

        // Fetch subagent prices
        const { data: priceData, error: priceError } = await supabase
          .from("subagent_package_prices")
          .select("*")
          .eq("subagent_store_id", subagentStoreId);

        if (priceError) throw priceError;

        const priceMap: Record<string, SubagentPrice> = {};
        (priceData || []).forEach((p: any) => {
          priceMap[p.package_id] = p;
        });
        setPrices(priceMap);
      } catch (err: any) {
        console.error("[v0] Error loading subagent pricing:", err);
        toast({
          title: "Error",
          description: "Failed to load pricing data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [subagentStoreId]);

  const handleSavePrices = async () => {
    if (Object.keys(tempPrices).length === 0) {
      toast({
        title: "No changes",
        description: "Please modify at least one price",
        variant: "default",
      });
      return;
    }

    try {
      setSaving(true);
      const networkPackages = packages.filter(p => p.network === selectedNetwork);

      for (const pkg of networkPackages) {
        const newBaseCost = tempPrices[pkg.id];
        if (!newBaseCost) continue;

        const parsedPrice = parseFloat(newBaseCost);
        if (isNaN(parsedPrice) || parsedPrice < pkg.price) {
          toast({
            title: "Invalid price",
            description: `Base price cannot be less than admin base price (GH₵ ${pkg.price.toFixed(2)})`,
            variant: "destructive",
          });
          return;
        }

        const existing = prices[pkg.id];
        if (existing) {
          const { error } = await supabase
            .from("subagent_package_prices")
            .update({
              base_cost: parsedPrice,
              sell_price: Math.max(parsedPrice, existing.sell_price), // Ensure sell price >= base cost
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          if (error) throw error;
        }
      }

      // Refresh
      const { data: priceData } = await supabase
        .from("subagent_package_prices")
        .select("*")
        .eq("subagent_store_id", subagentStoreId);

      const priceMap: Record<string, SubagentPrice> = {};
      (priceData || []).forEach((p: any) => {
        priceMap[p.package_id] = p;
      });
      setPrices(priceMap);
      setTempPrices({});

      toast({
        title: "Success",
        description: "Subagent base prices updated successfully",
      });
    } catch (err: any) {
      console.error("[v0] Error saving prices:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to save prices",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const networkPackages = packages.filter(p => p.network === selectedNetwork);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading pricing data...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Set Base Prices for {subagentStoreName}
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          The base price is what the subagent pays you per package. The subagent can then set their own selling price above this.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Network Selector */}
        <div className="flex gap-2">
          {["mtn", "airteltigo", "telecel"].map(network => (
            <Button
              key={network}
              variant={selectedNetwork === network ? "default" : "outline"}
              onClick={() => setSelectedNetwork(network)}
              size="sm"
            >
              {network === "mtn" ? "MTN" : network === "airteltigo" ? "AirtelTigo" : "Telecel"}
            </Button>
          ))}
        </div>

        {/* Pricing Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Package Size</TableHead>
                <TableHead>Admin Base Price</TableHead>
                <TableHead>Current Base Price for Subagent</TableHead>
                <TableHead>Subagent Selling Price</TableHead>
                <TableHead>Subagent Markup</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {networkPackages.length > 0 ? (
                networkPackages.map(pkg => {
                  const price = prices[pkg.id];
                  const currentBaseCost = tempPrices[pkg.id] !== undefined 
                    ? parseFloat(tempPrices[pkg.id]) 
                    : price?.base_cost || pkg.agent_price;
                  const subagentSellPrice = price?.sell_price || currentBaseCost;
                  const markup = subagentSellPrice - currentBaseCost;

                  return (
                    <TableRow key={pkg.id}>
                      <TableCell className="font-semibold">{pkg.size_gb}GB</TableCell>
                      <TableCell>GH₵ {pkg.price.toFixed(2)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={tempPrices[pkg.id] !== undefined ? tempPrices[pkg.id] : (price?.base_cost?.toString() || "")}
                          onChange={(e) => setTempPrices({ ...tempPrices, [pkg.id]: e.target.value })}
                          min={pkg.price}
                          className="w-24 text-sm"
                        />
                      </TableCell>
                      <TableCell>GH₵ {subagentSellPrice.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={markup > 0 ? "default" : "secondary"}>
                          GH₵ {markup.toFixed(2)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                    No packages available for this network
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSavePrices}
            disabled={saving || Object.keys(tempPrices).length === 0}
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Base Prices
          </Button>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
          <p className="font-semibold mb-1">How it works:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>You set a base price per package for this subagent</li>
            <li>The subagent cannot sell below this base price</li>
            <li>The subagent can set their own selling price and keep the markup as profit</li>
            <li>All profit calculations are automatic</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default SubagentPricingManager;
