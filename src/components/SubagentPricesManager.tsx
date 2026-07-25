import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Percent, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SubagentPricesManagerProps {
  agentStoreId: string;
  packages: any[];
  agentPrices?: Record<string, number>;
  onPricesSaved?: () => void;
}

export default function SubagentPricesManager({ agentStoreId, packages, agentPrices, onPricesSaved }: SubagentPricesManagerProps) {
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [markupPercent, setMarkupPercent] = useState("");
  const [editedPrices, setEditedPrices] = useState<Record<string, number | string>>({});
  const [savedBasePrices, setSavedBasePrices] = useState<Record<string, number>>({});
  const [savingPrices, setSavingPrices] = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const { toast } = useToast();

  // Fetch existing saved base prices for this agent's subagents
  React.useEffect(() => {
    const fetchSavedPrices = async () => {
      if (!agentStoreId) return;
      setLoadingPrices(true);
      
      const { data, error } = await supabase
        .from("subagent_package_prices")
        .select("package_id, base_price")
        .eq("agent_store_id", agentStoreId);
      
      if (!error && data) {
        const priceMap: Record<string, number> = {};
        data.forEach((p: any) => {
          if (p.base_price) priceMap[p.package_id] = p.base_price;
        });
        setSavedBasePrices(priceMap);
      }
      setLoadingPrices(false);
    };
    
    fetchSavedPrices();
  }, [agentStoreId]);

  const filteredPackages = packages.filter(p => {
    let networkMatch;
    if (networkFilter === "mtn_mashup") {
      networkMatch = p.network === "mtn_mashup" || p.network === "mashup";
    } else if (networkFilter === "airteltigo") {
      networkMatch = p.network === "airteltigo" || p.network === "atbigtime" || p.network === "atbigshare";
    } else {
      networkMatch = p.network === networkFilter;
    }
    return networkMatch && p.active !== false;
  });

  const handlePriceChange = (packageId: string, value: string) => {
    // Allow empty string for clearing the box - store as string for display
    setEditedPrices(prev => ({
      ...prev,
      [packageId]: value === "" ? "" : (parseFloat(value) || value)
    }));
  };

  const applyMarkup = () => {
    if (!markupPercent) {
      toast({ title: "Error", description: "Enter a markup percentage", variant: "destructive" });
      return;
    }

    const markup = parseFloat(markupPercent) / 100;
    const networkName = networkFilter === "mtn" ? "MTN" : networkFilter === "airteltigo" ? "AirtelTigo" : networkFilter === "telecel" ? "Telecel" : "Special MTN Mashup";
    
    filteredPackages.forEach(pkg => {
      // Use agent_price as the base (this already has admin's custom price if set)
      const basePrice = pkg.agent_price || pkg.price;
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

      // Validate that no price is below base price (agent's cost price, which is already overridden with admin's custom price if set)
      for (const [packageId, priceVal] of Object.entries(editedPrices)) {
        const price = typeof priceVal === "string" ? parseFloat(priceVal) : priceVal;
        const pkg = packages.find(p => p.id === packageId);
        // Use agent_price as the base (this already has admin's custom price if set)
        const basePrice = pkg?.agent_price || pkg?.price || 0;
        if (isNaN(price) || price <= 0) {
          toast({
            title: "Invalid Price",
            description: "Please enter a valid price",
            variant: "destructive"
          });
          setSavingPrices(false);
          return;
        }
        if (price < basePrice) {
          toast({
            title: "Invalid Price",
            description: `Subagent price cannot be below your cost price (GHC ${basePrice.toFixed(2)})`,
            variant: "destructive"
          });
          setSavingPrices(false);
          return;
        }
      }
      
      // Save to subagent_package_prices table (NOT agent_package_prices)
      // This is the base price agents set for their subagents
      for (const [packageId, priceVal] of Object.entries(editedPrices)) {
        const price = typeof priceVal === "string" ? parseFloat(priceVal) : priceVal;
        // First delete existing entry for this agent + package
        await supabase
          .from("subagent_package_prices")
          .delete()
          .eq("agent_store_id", agentStoreId)
          .eq("package_id", packageId);
        
        // Then insert new price
        const { error } = await supabase
          .from("subagent_package_prices")
          .insert({
            agent_store_id: agentStoreId,
            package_id: packageId,
            base_price: price
          });

        if (error) throw error;
      }

      // Update local saved prices state with the new values (convert to numbers)
      const numericPrices: Record<string, number> = {};
      Object.entries(editedPrices).forEach(([k, v]) => {
        numericPrices[k] = typeof v === "string" ? parseFloat(v) : v;
      });
      setSavedBasePrices(prev => ({ ...prev, ...numericPrices }));
      setEditedPrices({});
      setMarkupPercent("");
      toast({ title: "Success", description: "Subagent base prices saved successfully" });
      
      // Refresh data to show saved prices
      if (onPricesSaved) onPricesSaved();
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
          {["mtn", "airteltigo", "telecel", "mtn_mashup"].map(net => (
            <Button
              key={net}
              variant={networkFilter === net ? "hero" : "outline"}
              size="sm"
              onClick={() => setNetworkFilter(net)}
            >
              {net === "mtn" ? "MTN" : net === "airteltigo" ? "AirtelTigo" : net === "telecel" ? "Telecel" : "Special MTN Mashup"}
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
          Markup changes all subagent selling prices for the selected network based on the percentage you want all prices to be increased by. Markup is applied to the <strong>Base Price</strong> (agent cost). For example, if Base Price = GHC 4.10, +10% gives GHC 4.51. After applying, you must click <strong>"Save Prices"</strong> to keep the changes. The markup affects only the currently selected network (<strong>{networkFilter === "mtn" ? "MTN" : networkFilter === "airteltigo" ? "AirtelTigo" : networkFilter === "telecel" ? "Telecel" : "Special MTN Mashup"}</strong>).
        </p>
      </div>

      <p className="text-sm text-muted-foreground">Subagent profit = Their Selling Price - Your Cost Price. Use markup to increase all subagent prices by a % (based on your cost price).</p>

      <Card className="border-border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Size</TableHead>
                <TableHead>Your Cost Price</TableHead>
                <TableHead>Subagent Base Price</TableHead>
                <TableHead>Your Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingPrices ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Loading prices...
                  </TableCell>
                </TableRow>
              ) : (
                filteredPackages.map(pkg => {
                  const basePrice = pkg.agent_price || pkg.price;
                  const displayPrice = editedPrices[pkg.id] ?? savedBasePrices[pkg.id] ?? basePrice;
                  const profit = Number(displayPrice) - basePrice;
                  
                  return (
                    <TableRow key={pkg.id}>
                      <TableCell className="font-display font-bold">{pkg.size_gb_text || `${pkg.size_gb}GB`}</TableCell>
                      <TableCell className="text-muted-foreground">GHC {Number(basePrice).toFixed(2)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min={basePrice}
                          value={displayPrice}
                          onChange={e => handlePriceChange(pkg.id, e.target.value)}
                          className="w-24 h-8"
                        />
                      </TableCell>
                      <TableCell className={`font-semibold ${profit >= 0 ? "text-green-400" : "text-destructive"}`}>
                        GHC {profit.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
