import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Percent, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SubSubagentPricesManagerProps {
  subagentStoreId: string;
  packages: any[];
  subagentPrices?: Record<string, number>;
  onPricesSaved?: () => void;
}

export default function SubSubagentPricesManager({ subagentStoreId, packages, subagentPrices, onPricesSaved }: SubSubagentPricesManagerProps) {
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [markupPercent, setMarkupPercent] = useState("");
  const [editedPrices, setEditedPrices] = useState<Record<string, number | string>>({});
  const [savedBasePrices, setSavedBasePrices] = useState<Record<string, number>>({});
  const [savingPrices, setSavingPrices] = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const { toast } = useToast();

  // Fetch existing saved base prices for this subagent's sub-subagents
  React.useEffect(() => {
    const fetchSavedPrices = async () => {
      if (!subagentStoreId) return;
      setLoadingPrices(true);
      
      const { data, error } = await supabase
        .from("sub_subagent_package_prices")
        .select("package_id, subagent_minimum_price")
        .eq("sub_subagent_store_id", subagentStoreId);
      
      if (!error && data) {
        const priceMap: Record<string, number> = {};
        data.forEach((p: any) => {
          if (p.subagent_minimum_price) priceMap[p.package_id] = p.subagent_minimum_price;
        });
        setSavedBasePrices(priceMap);
      }
      setLoadingPrices(false);
    };
    
    fetchSavedPrices();
  }, [subagentStoreId]);

  const filteredPackages = packages.filter(p => {
    const networkMatch = networkFilter === "mtn_mashup" 
      ? (p.network === "mtn_mashup" || p.network === "mashup")
      : p.network === networkFilter;
    return networkMatch && p.active !== false;
  });

  const handlePriceChange = (packageId: string, value: string) => {
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
    const networkName = networkFilter === "mtn" ? "MTN" : networkFilter === "airteltigo" ? "AirtelTigo" : "Telecel";
    
    filteredPackages.forEach(pkg => {
      // Use your subagent price as the base
      const basePrice = subagentPrices?.[pkg.id] || pkg.price;
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

      for (const [packageId, priceVal] of Object.entries(editedPrices)) {
        const price = typeof priceVal === "string" ? parseFloat(priceVal) : priceVal;
        const pkg = packages.find(p => p.id === packageId);
        const basePrice = subagentPrices?.[pkg?.id] || pkg?.price || 0;
        
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
            description: `Sub-subagent price cannot be below your cost price (GH₵ ${basePrice.toFixed(2)})`,
            variant: "destructive"
          });
          setSavingPrices(false);
          return;
        }
      }
      
      // Save to sub_subagent_package_prices table
      for (const [packageId, priceVal] of Object.entries(editedPrices)) {
        const price = typeof priceVal === "string" ? parseFloat(priceVal) : priceVal;
        
        await supabase
          .from("sub_subagent_package_prices")
          .delete()
          .eq("sub_subagent_store_id", subagentStoreId)
          .eq("package_id", packageId);
        
        const { error } = await supabase
          .from("sub_subagent_package_prices")
          .insert({
            sub_subagent_store_id: subagentStoreId,
            package_id: packageId,
            subagent_minimum_price: price,
            sell_price: price
          });

        if (error) throw error;
      }

      const numericPrices: Record<string, number> = {};
      Object.entries(editedPrices).forEach(([k, v]) => {
        numericPrices[k] = typeof v === "string" ? parseFloat(v) : v;
      });
      setSavedBasePrices(prev => ({ ...prev, ...numericPrices }));
      setEditedPrices({});
      setMarkupPercent("");

      toast({ title: "Success", description: "Prices saved for sub-subagents" });
      onPricesSaved?.();
    } catch (error) {
      console.error("Error saving prices:", error);
      toast({ title: "Error", description: "Failed to save prices", variant: "destructive" });
    } finally {
      setSavingPrices(false);
    }
  };

  if (loadingPrices) {
    return <Card className="border-border"><CardContent className="py-8"><p className="text-center">Loading prices...</p></CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Network Selection</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Bulk Markup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                type="number"
                placeholder="e.g., 10 for +10%"
                value={markupPercent}
                onChange={(e) => setMarkupPercent(e.target.value)}
                className="pr-8"
              />
              <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <Button onClick={applyMarkup} variant="outline">Apply Markup</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Markup is applied to YOUR current {networkFilter === "mtn" ? "MTN" : networkFilter === "airteltigo" ? "AirtelTigo" : "Telecel"} selling prices
          </p>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Set Sub-Subagent Package Prices</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">The price you set here becomes the minimum price for your sub-subagents</p>
        </CardHeader>
        <CardContent>
          {filteredPackages.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No packages available</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Size</TableHead>
                    <TableHead>Your Price</TableHead>
                    <TableHead>Sub-Subagent Min Price</TableHead>
                    <TableHead>Profit/Unit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPackages.map(pkg => {
                    const yourPrice = subagentPrices?.[pkg.id] || pkg.price || 0;
                    const newPrice = editedPrices[pkg.id] !== undefined 
                      ? (typeof editedPrices[pkg.id] === "string" ? parseFloat(editedPrices[pkg.id] as string) : editedPrices[pkg.id])
                      : (savedBasePrices[pkg.id] || yourPrice);
                    const profit = newPrice - yourPrice;

                    return (
                      <TableRow key={pkg.id}>
                        <TableCell className="font-semibold">{pkg.size_gb}GB</TableCell>
                        <TableCell>GH₵ {yourPrice.toFixed(2)}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min={yourPrice}
                            value={editedPrices[pkg.id] !== undefined ? editedPrices[pkg.id] : (savedBasePrices[pkg.id] || "")}
                            onChange={(e) => handlePriceChange(pkg.id, e.target.value)}
                            className="w-24 h-8"
                            placeholder={yourPrice.toFixed(2)}
                          />
                        </TableCell>
                        <TableCell className={profit > 0 ? "text-green-400 font-semibold" : "text-muted-foreground"}>
                          {profit > 0 ? `+GH₵ ${profit.toFixed(2)}` : "GH₵ 0.00"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button
              onClick={savePrices}
              disabled={savingPrices || Object.keys(editedPrices).length === 0}
              className="gap-2"
            >
              <Save className="h-4 w-4" /> Save Prices
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditedPrices({});
                setMarkupPercent("");
              }}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
