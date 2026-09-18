import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type StoreOption = { id: string; label: string; kind: "agent" | "subagent" | "subsubagent"; userId: string | null };

export default function AdminDomainPurchasesPanel() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedStoreByItem, setSelectedStoreByItem] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [purchases, owners] = await Promise.all([
      supabase.rpc("admin_list_domain_purchases"),
      supabase.rpc("admin_list_domain_store_owners"),
    ]);
    if (purchases.error) toast({ title: "Could not load domain purchases", description: purchases.error.message, variant: "destructive" });
    if (owners.error) toast({ title: "Could not load purchaser storefronts", description: owners.error.message, variant: "destructive" });
    const options: StoreOption[] = (owners.data ?? []).map((store: any) => ({
      id: store.store_id,
      label: `${store.store_kind === "agent" ? "Agent" : store.store_kind === "subagent" ? "Sub-agent" : "Sub-sub-agent"} · ${store.store_name || store.user_id}`,
      kind: store.store_kind as StoreOption["kind"],
      userId: store.user_id ?? null,
    }));
    const resolvedPurchases = (purchases.data ?? []).map((item: any) => {
      const owner = options.find((store) =>
        (item.store_kind && item.store_id && store.kind === item.store_kind && store.id === item.store_id) ||
        (item.agent_store_id && store.kind === "agent" && store.id === item.agent_store_id) ||
        (item.buyer_user_id && store.userId === item.buyer_user_id) ||
        (item.buyer_code && store.userId === item.buyer_code) ||
        (item.buyer_id && store.userId === item.buyer_id) ||
        (item.purchaser_id && store.userId === item.purchaser_id) ||
        (item.user_id && store.userId === item.user_id)
      );
      return owner ? { ...item, store_id: owner.id, store_kind: owner.kind } : item;
    });
    setStores(options);
    setItems(resolvedPurchases);
    setSelectedStoreByItem((current) => {
      const next = { ...current };
      resolvedPurchases.forEach((item: any) => {
        const owner = options.find((store) =>
          (item.store_kind && item.store_id && store.kind === item.store_kind && store.id === item.store_id) ||
          (item.agent_store_id && store.kind === "agent" && store.id === item.agent_store_id) ||
          (item.buyer_user_id && store.userId === item.buyer_user_id) ||
          (item.buyer_code && store.userId === item.buyer_code) ||
          (item.buyer_id && store.userId === item.buyer_id) ||
          (item.purchaser_id && store.userId === item.purchaser_id) ||
          (item.user_id && store.userId === item.user_id)
        );
        if (owner) next[item.id] = owner.id;
      });
      return next;
    });
    setLoading(false);
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => {
      const owner = stores.find((store) => store.id === item.store_id && store.kind === item.store_kind);
      return [item.domain, item.assigned_domain, item.buyer_user_id, item.buyer_id, item.purchaser_id, item.user_id, owner?.label].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [items, search, stores]);

  async function assignUnresolved(item: any) {
    const selected = stores.find((store) => store.id === selectedStoreByItem[item.id]);
    if (!selected) return;
    setLoading(true);
    const { error } = await supabase.rpc("admin_reassign_domain_purchase", {
      p_domain_purchase_id: item.id,
      p_store_kind: selected.kind,
      p_store_id: selected.id,
    });
    if (error) toast({ title: "Could not link purchased domain", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Domain linked", description: `${item.domain || item.assigned_domain} is now linked to ${selected.label}.` });
      await load();
    }
    setLoading(false);
  }

  async function toggleAssignment(item: any) {
    setLoading(true);
    const enabled = !item.custom_domain_enabled;
    const { error } = await supabase.rpc("admin_toggle_domain_assignment", {
      p_domain_purchase_id: item.id,
      p_enabled: enabled,
    });
    if (error) {
      toast({ title: enabled ? "Could not assign domain" : "Could not unassign domain", description: error.message, variant: "destructive" });
    } else {
      const domain = item.domain || item.assigned_domain || "The purchased domain";
      toast({ title: enabled ? "Domain assigned" : "Domain unassigned", description: enabled ? `${domain} is active as an additional store URL. The default URL is unchanged.` : `${domain} was removed from the custom URL while the purchase remains with the original buyer.` });
      await load();
    }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchased Domains</CardTitle>
        <p className="text-sm text-muted-foreground">Each domain stays linked to the storefront that purchased it. Admin can assign or unassign that custom URL, but cannot change its owner.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search domain, buyer ID, or storefront"
          aria-label="Search purchased domains"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        {items.length === 0 ? <p className="text-sm text-muted-foreground">No domain purchases yet.</p> : filteredItems.length === 0 ? <p className="text-sm text-muted-foreground">No purchased domains match your search.</p> : filteredItems.map((item) => {
          const assigned = stores.find((store) =>
            (item.store_kind && item.store_id && store.kind === item.store_kind && store.id === item.store_id) ||
            (item.agent_store_id && store.kind === "agent" && store.id === item.agent_store_id) ||
            (item.buyer_user_id && store.userId === item.buyer_user_id) ||
            (item.buyer_id && store.userId === item.buyer_id) ||
            (item.purchaser_id && store.userId === item.purchaser_id) ||
            (item.user_id && store.userId === item.user_id) ||
        (item.buyer_id && store.userId === item.buyer_id) ||
        (item.purchaser_id && store.userId === item.purchaser_id) ||
        (item.user_id && store.userId === item.user_id)
          );
          const purchasedDomain = item.domain || item.assigned_domain || item.domain_name || item.hostname;
          const isAssigned = Boolean(item.custom_domain_enabled);
          return (
            <div key={item.id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1.1fr_1fr_1.6fr_auto] md:items-center">
              <div>
                <p className="font-semibold">{purchasedDomain || "Unnamed purchased domain"}</p>
                <p className="text-xs text-muted-foreground">Purchased {item.created_at ? new Date(item.created_at).toLocaleDateString() : "Date unavailable"}</p>
                {(item.buyer_user_id || item.buyer_id || item.purchaser_id || item.user_id) && <p className="text-xs text-muted-foreground">Buyer: {item.buyer_user_id || item.buyer_id || item.purchaser_id || item.user_id}</p>}
              </div>
              <Badge variant={isAssigned ? "default" : "outline"}>{isAssigned ? "assigned" : "unassigned"}</Badge>
              <div>
                {assigned ? (
                  <>
                    <p className="text-xs text-muted-foreground">Purchased by {assigned.label}</p>
                    <p className="text-sm">Owner is fixed to this storefront</p>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedStoreByItem[item.id] ?? ""}
                      onChange={(event) => setSelectedStoreByItem((current) => ({ ...current, [item.id]: event.target.value }))}
                      aria-label={`Select purchaser storefront for ${purchasedDomain}`}
                      className="min-w-64 rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Search/select purchaser storefront</option>
                      {stores.filter((store) => !search || store.label.toLowerCase().includes(search.toLowerCase()) || store.userId === item.buyer_user_id).map((store) => <option key={`${store.kind}:${store.id}`} value={store.id}>{store.label}</option>)}
                    </select>
                    <Button onClick={() => void assignUnresolved(item)} disabled={loading || !selectedStoreByItem[item.id]}>Link purchaser</Button>
                  </div>
                )}
              </div>
              {assigned && <Button onClick={() => void toggleAssignment(item)} disabled={loading}>{isAssigned ? "Unassign" : "Assign"}</Button>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
