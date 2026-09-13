import { useCallback, useEffect, useState } from "react";
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
      ...(agents.data ?? []).map((store: any) => ({ id: store.id, label: `Agent · ${store.store_name || store.user_id}`, kind: "agent" as const, userId: store.user_id ?? null })),
      ...(subagents.data ?? []).map((store: any) => ({ id: store.id, label: `Sub-agent · ${store.store_name || store.user_id}`, kind: "subagent" as const, userId: store.user_id ?? null })),
      ...(subSubagents.data ?? []).map((store: any) => ({ id: store.id, label: `Sub-sub-agent · ${store.store_name || store.user_id}`, kind: "subsubagent" as const, userId: store.user_id ?? null })),
    ];
    setStores(options);
    setItems(purchases.data ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

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
        {items.length === 0 ? <p className="text-sm text-muted-foreground">No domain purchases yet.</p> : items.map((item) => {
          const assigned = stores.find((store) =>
            (item.store_kind && item.store_id && store.kind === item.store_kind && store.id === item.store_id) ||
            (!item.store_id && item.buyer_user_id && store.userId === item.buyer_user_id)
          );
          const purchasedDomain = item.domain || item.assigned_domain || item.domain_name || item.hostname;
          const isAssigned = Boolean(item.custom_domain_enabled);
          return (
            <div key={item.id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1.1fr_1fr_1.6fr_auto] md:items-center">
              <div>
                <p className="font-semibold">{purchasedDomain || "Unnamed purchased domain"}</p>
                <p className="text-xs text-muted-foreground">Purchased {item.created_at ? new Date(item.created_at).toLocaleDateString() : "Date unavailable"}</p>
                {item.buyer_user_id && <p className="text-xs text-muted-foreground">Buyer: {item.buyer_user_id}</p>}
              </div>
              <Badge variant={isAssigned ? "default" : "outline"}>{isAssigned ? "assigned" : "unassigned"}</Badge>
              <div>
                <p className="text-xs text-muted-foreground">{assigned ? `Purchased by ${assigned.label}` : "Original storefront not recorded"}</p>
                <p className="text-sm">{assigned ? "Owner is fixed to this storefront" : "Purchase owner could not be resolved"}</p>
              </div>
              <Button onClick={() => void toggleAssignment(item)} disabled={loading || !assigned}>{isAssigned ? "Unassign" : "Assign"}</Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
