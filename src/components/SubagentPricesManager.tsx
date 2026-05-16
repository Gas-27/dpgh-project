import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Percent, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@supabase/supabase-js";

interface SubagentPricesManagerProps {
  agentStoreId: string;
  packages: any[];
  agentPrices: Record<string, number>;
}

export default function SubagentPricesManager({ agentStoreId, packages, agentPrices }: SubagentPricesManagerProps) {
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [markupPercent, setMarkupPercent] = useState("");
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [savingPrices, setSavingPrices] = useState(false);
  const { toast } = useToast();
  const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL || "",
    process.env.REACT_APP_SUPABASE_ANON_KEY || ""
  );

  const filteredPackages = packages.filter(p => p.network === networkFilter);

  const handlePriceChange = (packageId: string, value: string) => {
    setEditedPrices(prev => ({
      ...prev,
      [packageId]: parseFloat(value) || 0
    }));
  };

  const applyMarkup = () => {
    if (!markupPercent) {
      toast({ title: "Error", description: "Enter a markup percentage", variant: "destructive" });
      return;
    }

    const markup = parseFloat(markupPercent) / 100;
    const networkName = networkFilter === "mtn" ? "MTN" : networkFilter === "airteltigo" ? "AirtelTigo" : "Telecel";
    
    filteredPackages.forEach(pkg => {
      const basePrice = pkg.agent_price;
      const newPrice = basePrice * (1 + markup);
      setEditedPrices(prev => ({
        ...prev,
        [pkg.id]: parseFloat(newPrice.toFixed(2))
      }));
    });

    toast({
      title: `Markup applied to ${networkName} packages`,
      description: `All prices increased by ${markupPercent}%`
    });
  };

  const savePrices = async () => {
    try {
      setSavingPrices(true);
      
      for (const [packageId, price] of Object.entries(editedPrices)) {
        const { error } = await supabase
          .from("agent_package_prices")
          .upsert(
            {
              agent_store_id: agentStoreId,
              package_id: packageId,
              sell_price: price
            },
            { onConflict: "agent_store_id,package_id" }
          );

        if (error) throw error;
      }

      setEditedPrices({});
      setMarkupPercent("");
      toast({ title: "Success", description: "Prices saved for all subagents" });
    } catch (error) {
      console.error("Error saving prices:", error);
      toast({ title: "Error", description: "Failed to save prices", variant: "destructive" });
    } finally {
      setSavingPrices(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {["mtn", "airteltigo", "telecel"].map(net => (
            <Button
              key={net}
              variant={networkFilter === net ? "hero" : "outline"}
              size="sm"
              onClick={() => setNetworkFilter(net)}
            >
              {net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : "Telecel"}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Markup:</span>
          <Input
            type="number"
            placeholder="+10"
            value={markupPercent}
            onChange={e => setMarkupPercent(e.target.value)}
            className="w-20 h-8 text-sm"
          />
          <Button variant="outline" size="sm" onClick={applyMarkup}>
            <Percent className="h-3 w-3 mr-1" /> Apply
          </Button>
        </div>
        {Object.keys(editedPrices).length > 0 && (
          <Button variant="hero" size="sm" onClick={savePrices} disabled={savingPrices}>
            <Save className="h-4 w-4 mr-1" />
            {savingPrices ? "Saving..." : "Save Prices"}
          </Button>
        )}
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-sm">
        <p className="font-semibold">USE Markup if you feel lazy and do not want to edit each GB price one by one <br /> 💡 Markup Explanation (Remember to click save after applying markup)</p>
        <p className="text-xs text-muted-foreground mt-2">
          Markup changes all subagent selling prices for the selected network based on the percentage you want all prices to be increased by. Markup is applied to the <strong>Base Price</strong> (agent cost). For example, if Base Price = GHC 4.10, +10% gives GHC 4.51. After applying, you must click <strong>"Save Prices"</strong> to keep the changes. The markup affects only the currently selected network (<strong>{networkFilter === "mtn" ? "MTN" : networkFilter === "airteltigo" ? "AirtelTigo" : "Telecel"}</strong>).
        </p>
      </div>

      <p className="text-sm text-muted-foreground">Subagent profit = Their Selling Price - Your Base Price. Use markup to increase all subagent prices by a % (based on base price).</p>

      <Card className="border-border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Size</TableHead>
                <TableHead>Base Price (Your Cost)</TableHead>
                <TableHead>Subagent Base Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPackages.map(pkg => {
                const cur = editedPrices[pkg.id] ?? agentPrices[pkg.id] ?? pkg.price;
                return (
                  <TableRow key={pkg.id}>
                    <TableCell className="font-display font-bold">{pkg.size_gb}GB</TableCell>
                    <TableCell className="text-muted-foreground">GH₵ {Number(pkg.agent_price).toFixed(2)}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        value={cur}
                        onChange={e => handlePriceChange(pkg.id, e.target.value)}
                        className="w-24 h-8"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
