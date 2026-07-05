import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Percent, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SubSubagentPricesManagerProps {
  subagentStoreId: string;
  selectedSubSubagentId: string;
  packages: any[];
  subagentPrices?: Record<string, number>;
  onPricesSaved?: () => void;
}

export default function SubSubagentPricesManager({ 
  subagentStoreId, 
  selectedSubSubagentId,
  packages, 
  subagentPrices, 
  onPricesSaved 
}: SubSubagentPricesManagerProps) {
  const [networkFilter, setNetworkFilter] = useState("mtn");
  const [markupPercent, setMarkupPercent] = useState("");
  const [editedPrices, setEditedPrices] = useState<Record<string, number | string>>({});
  const [savedBasePrices, setSavedBasePrices] = useState<Record<string, number>>({});
  const [savingPrices, setSavingPrices] = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const { toast } = useToast();

  // Fetch existing saved base prices THIS SUBAGENT has set for THIS SPECIFIC SUB-SUBAGENT
  React.useEffect(() => {
    const fetchSavedPrices = async () => {
      if (!subagentStoreId || !selectedSubSubagentId) return;
      setLoadingPrices(true);
      
      // Fetch prices this subagent has set for this specific sub-subagent
      const { data, error } = await supabase
        .from("sub_subagent_package_prices")
        .select("package_id, base_price")
        .eq("subagent_store_id", subagentStoreId)
        .eq("sub_subagent_store_id", selectedSubSubagentId);
      
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
  }, [subagentStoreId, selectedSubSubagentId]);

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
      // This saves prices this subagent charges their sub-subagent
      for (const [packageId, priceVal] of Object.entries(editedPrices)) {
        const price = typeof priceVal === "string" ? parseFloat(priceVal) : priceVal;
        
        // First delete existing entry for this subagent + sub-subagent + package
        await supabase
          .from("sub_subagent_package_prices")
          .delete()
          .eq("subagent_store_id", subagentStoreId)
          .eq("sub_subagent_store_id", selectedSubSubagentId)
          .eq("package_id", packageId);
        
        // Then insert new price with all required fields
        const { error } = await supabase
          .from("sub_subagent_package_prices")
          .insert({
            subagent_store_id: subagentStoreId,
            sub_subagent_store_id: selectedSubSubagentId,
            package_id: packageId,
            base_price: price,
            subagent_minimum_price: price,
            sell_price: price
          });

        if (error) {
          console.error("[v0] Error inserting sub-subagent price:", error);
          throw error;
        }
      }

      // Update local saved prices state with the new values
      const numericPrices: Record<string, number> = {};
      Object.entries(editedPrices).forEach(([k, v]) => {
        numericPrices[k] = typeof v === "string" ? parseFloat(v) : v;
      });
      setSavedBasePrices(prev => ({ ...prev, ...numericPrices }));
      setEditedPrices({});
      setMarkupPercent("");
      toast({ title: "Success", description: "Sub-subagent base prices saved successfully" });
      
      // Refresh data
      if (onPricesSaved) onPricesSaved();
    } catch (error) {
      console.error("Error saving sub-subagent prices:", error);
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
          Markup changes all sub-subagent selling prices for the selected network based on the percentage you want all prices to be increased by. Markup is applied to the <strong>Base Price</strong> (your cost). For example, if Base Price = GHC 4.10, +10% gives GHC 4.51. After applying, you must click <strong>"Save Prices"</strong> to keep the changes. The markup affects only the currently selected network (<strong>{networkFilter === "mtn" ? "MTN" : networkFilter === "airteltigo" ? "AirtelTigo" : networkFilter === "telecel" ? "Telecel" : "Special MTN Mashup"}</strong>).
        </p>
      </div>

      <p className="text-sm text-muted-foreground">Sub-subagent profit = Their Selling Price - Your Cost Price. Use markup to increase all sub-subagent prices by a % (based on your cost price).</p>

      <Card className="border-border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Size</TableHead>
                <TableHead>Your Cost Price</TableHead>
                <TableHead>Sub-Subagent Base Price</TableHead>
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
                  const basePrice = subagentPrices?.[pkg.id] || pkg.price;
                  const displayPrice = editedPrices[pkg.id] ?? savedBasePrices[pkg.id] ?? basePrice;
                  const profit = Number(displayPrice) - basePrice;
                  
                  return (
                    <TableRow key={pkg.id}>
                      <TableCell className="font-display font-bold">{pkg.size_gb_text || `${pkg.size_gb}GB`}</TableCell>
                      <TableCell className="text-muted-foreground">GH₵ {Number(basePrice).toFixed(2)}</TableCell>
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
                        GH₵ {profit.toFixed(2)}
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
