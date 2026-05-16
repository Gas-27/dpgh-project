import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save } from "lucide-react";

interface DataPackage {
  id: string;
  network: string;
  size_gb: number;
  agent_price: number;
}

interface SubagentPriceRow {
  subagentId: string;
  subagentName: string;
  packageId: string;
  agentMinimumPrice: number;
  currentSubagentPrice: number;
}

interface SubagentPricesManagerProps {
  agentStoreId: string;
  packages: DataPackage[];
  subagents: any[];
}

export default function SubagentPricesManager({
  agentStoreId,
  packages,
  subagents,
}: SubagentPricesManagerProps) {
  const { toast } = useToast();
  const [prices, setPrices] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPrices();
  }, [subagents]);

  const loadPrices = async () => {
    try {
      setLoading(true);
      const priceMap: Record<string, Record<string, number>> = {};

      for (const subagent of subagents) {
        const { data } = await supabase
          .from("subagent_package_prices")
          .select("package_id, sell_price")
          .eq("subagent_store_id", subagent.id);

        priceMap[subagent.id] = {};
        if (data) {
          data.forEach((p: any) => {
            priceMap[subagent.id][p.package_id] = p.sell_price;
          });
        }
      }

      setPrices(priceMap);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load prices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (subagentId: string, packageId: string, value: number) => {
    setPrices((prev) => ({
      ...prev,
      [subagentId]: {
        ...prev[subagentId],
        [packageId]: value,
      },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      for (const subagentId of Object.keys(prices)) {
        for (const packageId of Object.keys(prices[subagentId])) {
          const price = prices[subagentId][packageId];

          await supabase
            .from("subagent_package_prices")
            .upsert(
              {
                subagent_store_id: subagentId,
                package_id: packageId,
                agent_minimum_price:
                  packages.find((p) => p.id === packageId)?.agent_price || 0,
                sell_price: price,
              },
              { onConflict: "subagent_store_id,package_id" }
            );
        }
      }

      toast({
        title: "Success",
        description: "Subagent prices updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save prices",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-muted-foreground">Loading prices...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (subagents.length === 0) {
    return (
      <Card className="border-border">
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">No subagents to manage prices for</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader>
          <CardTitle>Set Subagent Prices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {subagents.map((subagent) => (
            <div key={subagent.id} className="border-b border-border pb-6 last:border-0">
              <h3 className="font-semibold mb-4">{subagent.store_name}</h3>
              <div className="grid gap-4">
                {packages.map((pkg) => (
                  <div key={pkg.id} className="grid grid-cols-2 gap-4 items-end">
                    <div>
                      <Label className="text-sm text-muted-foreground">
                        {pkg.network.toUpperCase()} - {pkg.size_gb}GB
                      </Label>
                      <p className="text-xs mt-1 text-muted-foreground">Min: GH₵ {Number(pkg.agent_price).toFixed(2)}</p>
                    </div>
                    <div>
                      <Label htmlFor={`price-${subagent.id}-${pkg.id}`} className="text-xs mb-1 block">
                        Sell Price
                      </Label>
                      <div className="flex gap-2 items-center">
                        <span className="text-sm">GH₵</span>
                        <Input
                          id={`price-${subagent.id}-${pkg.id}`}
                          type="number"
                          step="0.01"
                          min={pkg.agent_price}
                          value={prices[subagent.id]?.[pkg.id] || pkg.agent_price}
                          onChange={(e) =>
                            handlePriceChange(subagent.id, pkg.id, parseFloat(e.target.value) || 0)
                          }
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full"
        size="lg"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            Save All Prices
          </>
        )}
      </Button>
    </div>
  );
}
