import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type StoreKind = "agent" | "subagent" | "sub_subagent";

interface StoreRow {
  id: string;
  store_name: string;
  parent_id: string | null;
}

interface PackageRow {
  id: string;
  network: string;
  size: string | number | null;
  price: number | null;
}

const KIND_LABEL: Record<StoreKind, string> = {
  agent: "Agent",
  subagent: "Subagent",
  sub_subagent: "Sub-subagent",
};

const db = supabase as any;

async function fetchStores(kind: StoreKind): Promise<StoreRow[]> {
  if (kind === "agent") {
    const { data, error } = await db.from("agent_stores").select("id, store_name").order("store_name");
    if (error) throw error;
    return (data ?? []).map((s: any) => ({ id: s.id, store_name: s.store_name, parent_id: null }));
  }
  if (kind === "subagent") {
    const { data, error } = await db.from("subagent_stores").select("id, store_name, agent_store_id").order("store_name");
    if (error) throw error;
    return (data ?? []).map((s: any) => ({ id: s.id, store_name: s.store_name, parent_id: s.agent_store_id }));
  }
  const { data, error } = await db.from("sub_subagent_stores").select("id, store_name, subagent_store_id").order("store_name");
  if (error) throw error;
  return (data ?? []).map((s: any) => ({ id: s.id, store_name: s.store_name, parent_id: s.subagent_store_id }));
}

async function fetchPackages(): Promise<PackageRow[]> {
  const { data, error } = await db
    .from("data_packages")
    .select("id, network, size_gb, size_gb_text, price")
    .eq("active", true)
    .order("network")
    .order("size_gb");
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    id: p.id,
    network: p.network,
    size: p.size_gb_text || (p.size_gb != null ? `${p.size_gb}GB` : ""),
    price: p.price,
  }));
}

// Selling price each storefront actually reads, newest row first so a duplicate never wins over the latest.
async function fetchStorePrices(kind: StoreKind, storeId: string): Promise<Record<string, number>> {
  const config = {
    agent: { table: "agent_package_prices", storeColumn: "agent_store_id", priceColumn: "sell_price" },
    subagent: { table: "subagent_package_prices", storeColumn: "subagent_store_id", priceColumn: "sell_price" },
    sub_subagent: { table: "sub_subagent_package_prices", storeColumn: "sub_subagent_store_id", priceColumn: "customer_sell_price" },
  }[kind];

  const { data, error } = await db
    .from(config.table)
    .select(`package_id, ${config.priceColumn}, created_at`)
    .eq(config.storeColumn, storeId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const prices: Record<string, number> = {};
  for (const row of data ?? []) {
    const value = row[config.priceColumn];
    if (value != null && prices[row.package_id] === undefined) prices[row.package_id] = Number(value);
  }
  return prices;
}

async function savePrice(kind: StoreKind, store: StoreRow, pkg: PackageRow, price: number) {
  if (kind === "agent") {
    const { data: existing, error: lookupError } = await db
      .from("agent_package_prices")
      .select("id")
      .eq("agent_store_id", store.id)
      .eq("package_id", pkg.id)
      .order("created_at", { ascending: false });
    if (lookupError) throw lookupError;
    const result = existing?.length
      ? await db.from("agent_package_prices").update({ sell_price: price }).eq("id", existing[0].id)
      : await db.from("agent_package_prices").insert({ agent_store_id: store.id, package_id: pkg.id, sell_price: price });
    if (result.error) throw result.error;
    return;
  }

  if (kind === "subagent") {
    const { data: existing, error: lookupError } = await db
      .from("subagent_package_prices")
      .select("id")
      .eq("subagent_store_id", store.id)
      .eq("package_id", pkg.id)
      .order("created_at", { ascending: false });
    if (lookupError) throw lookupError;
    const result = existing?.length
      ? await db.from("subagent_package_prices").update({ sell_price: price }).eq("id", existing[0].id)
      : await db.from("subagent_package_prices").insert({ subagent_store_id: store.id, package_id: pkg.id, sell_price: price });
    if (result.error) throw result.error;
    return;
  }

  // Only customer_sell_price is touched: sell_price/base_price on this table are the parent subagent's cost-side prices.
  const { data: existing, error: lookupError } = await db
    .from("sub_subagent_package_prices")
    .select("id")
    .eq("sub_subagent_store_id", store.id)
    .eq("package_id", pkg.id)
    .order("created_at", { ascending: false });
  if (lookupError) throw lookupError;
  const cost = Number(pkg.price ?? price);
  const result = existing?.length
    ? await db.from("sub_subagent_package_prices").update({ customer_sell_price: price }).eq("id", existing[0].id)
    : await db.from("sub_subagent_package_prices").insert({
        sub_subagent_store_id: store.id,
        subagent_store_id: store.parent_id,
        package_id: pkg.id,
        base_price: cost,
        subagent_minimum_price: cost,
        sell_price: cost,
        customer_sell_price: price,
      });
  if (result.error) throw result.error;
}

export default function AdminStorePricesManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<StoreKind>("agent");
  const [storeSearch, setStoreSearch] = useState("");
  const [storeId, setStoreId] = useState<string>("");
  const [network, setNetwork] = useState<string>("all");
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const storesQuery = useQuery({ queryKey: ["admin-store-prices", "stores", kind], queryFn: () => fetchStores(kind) });
  const packagesQuery = useQuery({ queryKey: ["admin-store-prices", "packages"], queryFn: fetchPackages });
  const pricesQuery = useQuery({
    queryKey: ["admin-store-prices", "prices", kind, storeId],
    queryFn: () => fetchStorePrices(kind, storeId),
    enabled: Boolean(storeId),
  });

  const stores = storesQuery.data ?? [];
  const selectedStore = stores.find((s) => s.id === storeId);
  const packages = packagesQuery.data ?? [];
  const prices = pricesQuery.data ?? {};

  const filteredStores = useMemo(() => {
    const term = storeSearch.trim().toLowerCase();
    return (term ? stores.filter((s) => s.store_name?.toLowerCase().includes(term)) : stores).slice(0, 100);
  }, [stores, storeSearch]);

  const networks = useMemo(() => Array.from(new Set(packages.map((p) => p.network))).sort(), [packages]);
  const visiblePackages = packages.filter((p) => network === "all" || p.network === network);
  const changedCount = Object.keys(edited).length;

  const changeKind = (next: string) => {
    setKind(next as StoreKind);
    setStoreId("");
    setStoreSearch("");
    setEdited({});
  };

  const changeStore = (id: string) => {
    setStoreId(id);
    setEdited({});
  };

  const handleSave = async () => {
    if (!selectedStore) return;
    const entries = Object.entries(edited);
    const invalid = entries.find(([, value]) => !Number.isFinite(Number(value)) || Number(value) <= 0);
    if (invalid) {
      toast({ title: "Invalid price", description: "Every changed price must be a number greater than 0.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      for (const [packageId, value] of entries) {
        const pkg = packages.find((p) => p.id === packageId);
        if (pkg) await savePrice(kind, selectedStore, pkg, Number(value));
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-store-prices", "prices", kind, storeId] });
      setEdited({});
      toast({ title: "Prices saved", description: `${entries.length} price(s) updated for ${selectedStore.store_name}.` });
    } catch (error: any) {
      toast({ title: "Could not save prices", description: error?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Store Selling Prices</CardTitle>
        <CardDescription>
          Change the price an agent, subagent or sub-subagent store sells each bundle for. Only admins and the store owner can edit these prices.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Tabs value={kind} onValueChange={changeKind}>
          <TabsList>
            {(Object.keys(KIND_LABEL) as StoreKind[]).map((k) => (
              <TabsTrigger key={k} value={k}>{KIND_LABEL[k]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-2 md:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={storeSearch}
              onChange={(e) => setStoreSearch(e.target.value)}
              placeholder={`Search ${KIND_LABEL[kind].toLowerCase()} stores by name`}
              className="pl-9"
              aria-label="Search stores"
            />
          </div>
          <Select value={storeId} onValueChange={changeStore}>
            <SelectTrigger className="md:w-72" aria-label="Select store">
              <SelectValue placeholder={storesQuery.isLoading ? "Loading stores..." : "Select a store"} />
            </SelectTrigger>
            <SelectContent>
              {filteredStores.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.store_name}</SelectItem>
              ))}
              {filteredStores.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No stores found</div>}
            </SelectContent>
          </Select>
        </div>

        {!selectedStore ? (
          <p className="text-sm text-muted-foreground">Select a store to see and change its prices.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <Select value={network} onValueChange={setNetwork}>
                <SelectTrigger className="md:w-48" aria-label="Filter by network">
                  <SelectValue placeholder="Network" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All networks</SelectItem>
                  {networks.map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleSave} disabled={saving || changedCount === 0}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save {changedCount > 0 ? `${changedCount} change${changedCount > 1 ? "s" : ""}` : "changes"}
              </Button>
            </div>

            {pricesQuery.isLoading || packagesQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading prices...
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Network</TableHead>
                      <TableHead>Bundle</TableHead>
                      <TableHead className="text-right">Platform price (GH₵)</TableHead>
                      <TableHead className="text-right">Store price (GH₵)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visiblePackages.map((pkg) => {
                      const current = prices[pkg.id];
                      const value = edited[pkg.id] ?? (current !== undefined ? String(current) : "");
                      return (
                        <TableRow key={pkg.id}>
                          <TableCell>{pkg.network}</TableCell>
                          <TableCell>{pkg.size}</TableCell>
                          <TableCell className="text-right">{pkg.price != null ? Number(pkg.price).toFixed(2) : "-"}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={value}
                              placeholder="Not set"
                              aria-label={`Store price for ${pkg.network} ${pkg.size}`}
                              className="ml-auto h-8 w-28 text-right"
                              onChange={(e) => {
                                const next = e.target.value;
                                setEdited((prev) => {
                                  const copy = { ...prev };
                                  if (next === "" || (current !== undefined && Number(next) === current)) delete copy[pkg.id];
                                  else copy[pkg.id] = next;
                                  return copy;
                                });
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {visiblePackages.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">No bundles found</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
