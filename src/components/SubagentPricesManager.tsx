import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save } from "lucide-react";

interface DataPackage {
  id: string;
  network: string;
  size_gb: number;
  agent_price: number;
}

interface SubagentPricesManagerProps {
  agentStoreId: string;
  packages: DataPackage[];
  agentPrices: Record<string, number>;
  onUpdate?: () => void;
}

export default function SubagentPricesManager({
  agentStoreId,
  packages,
  agentPrices,
  onUpdate,
}: SubagentPricesManagerProps) {
  const { toast } = useToast();
  const [subagentPrices, setSubagentPrices] = useState<Record<string, number>>(agentPrices || {});
  const [saving, setSaving] = useState(false);

  const handlePriceChange = (packageId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setSubagentPrices((prev) => ({
      ...prev,
      [packageId]: numValue,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Save subagent prices - these are global prices that apply to all subagents
      const updates = Object.entries(subagentPrices).map(([packageId, price]) => ({
        package_id: packageId,
        agent_store_id: agentStoreId,
        sell_price: price,
      }));

      for (const update of updates) {
        await supabase
          .from("agent_package_prices")
          .upsert(update, { onConflict: "agent_store_id,package_id" });
      }

      toast({
        title: "Success",
        description: "Subagent prices updated for all subagents",
      });

      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("[v0] Error saving prices:", error);
      toast({
        title: "Error",
        description: "Failed to save prices",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Set the selling prices for packages. These prices apply to all your subagents.
      </p>

      <div className="space-y-3">
        {packages.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No packages available</p>
        ) : (
          packages.map((pkg) => (
            <Card key={pkg.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <Label className="text-sm font-semibold">
                      {pkg.network.toUpperCase()} - {pkg.size_gb}GB
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Agent base price: GH₵{Number(pkg.agent_price).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-end gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Price (GH₵)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={subagentPrices[pkg.id] || ""}
                        onChange={(e) => handlePriceChange(pkg.id, e.target.value)}
                        placeholder="0.00"
                        className="w-24"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full"
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Save Subagent Prices
          </>
        )}
      </Button>
    </div>
  );
}
