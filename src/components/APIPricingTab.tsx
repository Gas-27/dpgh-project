import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Save, User, Package, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DataPackage {
  id: string;
  network: string;
  size_gb: number;
  price?: number;
  agent_price?: number;
  api_price?: number;
  active?: boolean;
}

interface APIUser {
  id: string;
  full_name?: string;
  email?: string;
  user_email?: string;
  store_name?: string;
  api_key: string;
  wallet: number;
  active: boolean;
  custom_price: boolean;
  topup_reference?: string;
}

interface CustomPrice {
  package_id: string;
  custom_price: number;
}

interface APIPricingTabProps {
  supabase: any;
  packages: DataPackage[];
}

export function APIPricingTab({ supabase, packages }: APIPricingTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [apiUsers, setApiUsers] = useState<APIUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<APIUser | null>(null);
  const [existingPrices, setExistingPrices] = useState<Record<string, number>>({});
  const [customPrices, setCustomPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(false);

  // active field may be undefined if not in DB — default to showing all packages
  const activePackages = packages.filter((p) => p.active !== false);

  const searchUsers = useCallback(async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    setSelectedUser(null);
    setExistingPrices({});
    setCustomPrices({});
    try {
      const term = searchTerm.trim();

      // Call the admin API route which uses the service role key to bypass RLS
      const res = await fetch(`/api/admin/search-api-users?q=${encodeURIComponent(term)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Search failed");

      setApiUsers((json.data as APIUser[]) || []);
      if (!json.data || json.data.length === 0) {
        toast({ title: "No API user found", description: `No results for "${term}". Try top-up reference, name, email, store name or API key.`, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Search failed", description: err.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }, [searchTerm, supabase]);

  const selectUser = useCallback(async (user: APIUser) => {
    setSelectedUser(user);
    setLoadingPrices(true);
    setCustomPrices({});
    try {
      const { data, error } = await supabase
        .from("api_user_package_prices")
        .select("package_id, custom_price")
        .eq("api_user_id", user.id);
      if (error) throw error;
      const priceMap: Record<string, number> = {};
      (data || []).forEach((row: CustomPrice) => {
        priceMap[row.package_id] = row.custom_price;
      });
      setExistingPrices(priceMap);
      // Pre-fill inputs with existing custom prices
      const inputMap: Record<string, string> = {};
      (data || []).forEach((row: CustomPrice) => {
        inputMap[row.package_id] = String(row.custom_price);
      });
      setCustomPrices(inputMap);
    } catch (err: any) {
      toast({ title: "Failed to load existing prices", description: err.message, variant: "destructive" });
    } finally {
      setLoadingPrices(false);
    }
  }, [supabase]);

  const saveCustomPrices = async () => {
    if (!selectedUser) return;
    const entries = Object.entries(customPrices).filter(([, v]) => v !== "" && !isNaN(Number(v)));
    if (entries.length === 0) {
      toast({ title: "No prices to save", description: "Enter at least one custom price." });
      return;
    }
    setSaving(true);
    try {
      // Call the admin-set-custom-prices edge function
      const supabaseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = (supabase as any).supabaseKey || import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/admin-set-custom-prices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          api_key: selectedUser.api_key,
          custom_prices: entries.map(([package_id, custom_price]) => ({
            package_id,
            custom_price: Number(custom_price),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      toast({ title: "Custom prices saved", description: `${json.custom_prices_set} package price(s) updated for ${selectedUser.store_name || selectedUser.user_email || selectedUser.email}.` });
      // Refresh existing prices
      await selectUser(selectedUser);
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const groupedPackages = activePackages.reduce((acc, pkg) => {
    const key = pkg.network.toUpperCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(pkg);
    return acc;
  }, {} as Record<string, DataPackage[]>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Set Custom API Package Prices
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Search for an API user by top-up reference, full name, email, store name or API key and set custom prices per package. These override the default API price for that user only.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by top-up reference, name, email, store name or API key..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) searchUsers();
                }}
                className="pl-10"
              />
            </div>
            <Button onClick={searchUsers} disabled={searching || !searchTerm.trim()}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>

          {/* User results */}
          {apiUsers.length > 0 && !selectedUser && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Select a user to set prices</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {apiUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => selectUser(user)}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 text-left transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{user.store_name || user.full_name || user.user_email || user.email || "Unnamed"}</div>
                      <div className="text-xs text-muted-foreground truncate">{user.full_name ? `${user.full_name} — ` : ""}{user.user_email || user.email}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {user.topup_reference && (
                          <Badge variant="outline" className="text-xs font-mono text-cyan-400 border-cyan-500/40">{user.topup_reference}</Badge>
                        )}
                        <Badge variant="outline" className="text-xs font-mono">{user.api_key.slice(0, 16)}...</Badge>
                        {user.custom_price && <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">Custom Prices</Badge>}
                        <Badge variant={user.active ? "default" : "secondary"} className="text-xs">{user.active ? "Active" : "Inactive"}</Badge>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected user + price editor */}
          {selectedUser && (
            <div className="space-y-4">
              {/* Selected user header */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div>
                  <div className="font-semibold">{selectedUser.store_name || selectedUser.full_name || selectedUser.user_email || selectedUser.email || "Unnamed"}</div>
                  <div className="text-xs text-muted-foreground">{selectedUser.full_name ? `${selectedUser.full_name} — ` : ""}{selectedUser.user_email || selectedUser.email} &bull; Balance: GHC {Number(selectedUser.wallet || 0).toFixed(2)}</div>
                  {selectedUser.topup_reference && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs text-muted-foreground">Top-up Ref:</span>
                      <span className="font-mono font-bold text-cyan-400 text-xs">{selectedUser.topup_reference}</span>
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => { setSelectedUser(null); setApiUsers([]); setSearchTerm(""); }}>
                  Change User
                </Button>
              </div>

              {loadingPrices ? (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading existing prices...
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedPackages).map(([network, pkgs]) => (
                    <div key={network} className="space-y-2">
                      <Label className="text-sm font-semibold text-primary">{network}</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {pkgs.sort((a, b) => a.size_gb - b.size_gb).map((pkg) => {
                          const hasCustom = existingPrices[pkg.id] !== undefined;
                          const inputVal = customPrices[pkg.id] ?? "";
                          return (
                            <div key={pkg.id} className={`border rounded-lg p-3 space-y-2 ${hasCustom ? "border-blue-500/30 bg-blue-500/5" : "border-border"}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="font-medium text-sm">{pkg.size_gb}GB</span>
                                </div>
                                {hasCustom && <CheckCircle className="h-3.5 w-3.5 text-blue-400" />}
                              </div>
                              <div className="text-xs text-muted-foreground space-y-0.5">
                                <div>Default API price: <span className="font-medium text-foreground">GHC {pkg.api_price?.toFixed(2)}</span></div>
                                {hasCustom && <div>Current custom: <span className="font-medium text-blue-400">GHC {existingPrices[pkg.id]?.toFixed(2)}</span></div>}
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Custom Price (GHC)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder={`Default: ${pkg.api_price?.toFixed(2)}`}
                                  value={inputVal}
                                  onChange={(e) => setCustomPrices((prev) => ({ ...prev, [pkg.id]: e.target.value }))}
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <Button onClick={saveCustomPrices} disabled={saving} className="w-full sm:w-auto">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Custom Prices for {selectedUser.store_name || selectedUser.user_email || selectedUser.email}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
