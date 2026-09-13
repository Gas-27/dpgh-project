import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type StoreOption = { id: string; label: string; kind: "agent" | "subagent" | "subsubagent" };

export default function AdminDomainPurchasesPanel() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStores, setSelectedStores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [purchases, agents, subagents, subSubagents] = await Promise.all([
      supabase.rpc("admin_list_domain_purchases"),
      supabase.from("agent_stores").select("id, store_name, user_id").order("store_name"),
      supabase.from("subagent_stores").select("id, store_name, user_id").order("store_name"),
      supabase.from("sub_subagent_stores").select("id, store_name, user_id").order("store_name"),
    ]);
    if (purchases.error) toast({ title: "Could not load domain purchases", description: purchases.error.message, variant: "destructive" });
    const options: StoreOption[] = [
      ...(agents.data ?? []).map((store: any) => ({ id: store.id, label: `Agent · ${store.store_name || store.user_id}`, kind: "agent" as const })),
      ...(subagents.data ?? []).map((store: any) => ({ id: store.id, label: `Sub-agent · ${store.store_name || store.user_id}`, kind: "subagent" as const })),
      ...(subSubagents.data ?? []).map((store: any) => ({ id: store.id, label: `Sub-sub-agent · ${store.store_name || store.user_id}`, kind: "subsubagent" as const })),
    ];
    setStores(options);
    setItems(purchases.data ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  async function assign(item: any) {
    const value = selectedStores[item.id];
    const [storeKind, storeId] = value?.split(":") ?? [];
    if (!storeKind || !storeId) {
      toast({ title: "Select a person", description: "Choose the agent or sub-agent who should receive this domain.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.rpc("admin_reassign_domain_purchase", {
      p_domain_purchase_id: item.id,
      p_store_kind: storeKind,
      p_store_id: storeId,
    });
    if (error) toast({ title: "Could not assign domain", description: error.message, variant: "destructive" });
    else { toast({ title: "Domain assigned", description: `${item.domain || item.assigned_domain || "The purchased domain"} is now an additional URL for the selected storefront. Its default URL is unchanged.` }); await load(); }
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchased Domains</CardTitle>
        <p className="text-sm text-muted-foreground">Every purchased domain appears here. Assign or reassign each domain to the storefront owner who should receive it.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? <p className="text-sm text-muted-foreground">No domain purchases yet.</p> : items.map((item) => {
          const assigned = item.store_kind && item.store_id ? stores.find((store) => store.kind === item.store_kind && store.id === item.store_id) : null;
          const purchasedDomain = item.domain || item.assigned_domain || item.domain_name || item.hostname;
          return (
            <div key={item.id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1.1fr_1fr_1.6fr_auto] md:items-center">
              <div>
                <p className="font-semibold">{purchasedDomain || "Unnamed purchased domain"}</p>
                <p className="text-xs text-muted-foreground">Purchased {item.created_at ? new Date(item.created_at).toLocaleDateString() : "Date unavailable"}</p>
                {item.buyer_user_id && <p className="text-xs text-muted-foreground">Buyer: {item.buyer_user_id}</p>}
              </div>
              <Badge variant={item.status === "active" ? "default" : "outline"}>{item.status || "purchased"}</Badge>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">{assigned ? `Assigned to ${assigned.label}` : "Not assigned"}</p>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={selectedStores[item.id] ?? (assigned ? `${assigned.kind}:${assigned.id}` : "")} onChange={(event) => setSelectedStores((current) => ({ ...current, [item.id]: event.target.value }))} aria-label={`Assign ${item.domain}`}>
                  <option value="">Select storefront owner</option>
                  {stores.map((store) => <option key={`${store.kind}:${store.id}`} value={`${store.kind}:${store.id}`}>{store.label}</option>)}
                </select>
              </div>
              <Button onClick={() => void assign(item)} disabled={loading}>{assigned ? "Reassign" : "Assign"}</Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
