import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const normalize = (value: string) => value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
const validDomain = (value: string) => /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value);

export default function AdminDomainPurchasesPanel() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [domains, setDomains] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("domain_purchases").select("*").order("created_at", { ascending: false });
    if (error) toast({ title: "Could not load domain purchases", description: error.message, variant: "destructive" });
    setItems(data ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  async function assign(item: any) {
    const domain = normalize(domains[item.id] || item.domain);
    if (!validDomain(domain)) { toast({ title: "Invalid domain", description: "Enter the domain purchased on Spaceship, such as example.com.", variant: "destructive" }); return; }
    setLoading(true);
    const table = item.store_kind === "subagent" ? "subagent_stores" : item.store_kind === "subsubagent" ? "sub_subagent_stores" : "agent_stores";
    let { error: storeError } = await supabase.from(table).update({ custom_domain: domain, custom_domain_status: "pending_dns" }).eq("id", item.store_id || item.agent_store_id);
    if (!storeError) {
      const { error } = await supabase.from("domain_purchases").update({ assigned_domain: domain, status: "assigned", assigned_at: new Date().toISOString() }).eq("id", item.id);
      if (error) storeError = error;
    }
    if (storeError) toast({ title: "Could not assign domain", description: storeError.message, variant: "destructive" });
    else { toast({ title: "Domain assigned", description: `${domain} is now the preferred domain for this store. Configure Vercel and DNS manually.` }); await load(); }
    setLoading(false);
  }

  return <Card><CardHeader><CardTitle>Domain purchases</CardTitle><p className="text-sm text-muted-foreground">Pending purchases are paid from the owner wallet. Buy the domain manually on Spaceship, then paste the purchased domain below to assign it.</p></CardHeader><CardContent className="space-y-3">{items.length === 0 ? <p className="text-sm text-muted-foreground">No domain purchases yet.</p> : items.map((item) => <div key={item.id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_1fr_1.4fr_auto] md:items-center"><div><p className="font-semibold">{item.domain}</p><p className="text-xs text-muted-foreground">{item.store_kind} store · GHC {Number(item.price).toFixed(2)}</p></div><Badge variant="outline">{item.status}</Badge><Input value={domains[item.id] ?? item.assigned_domain ?? ""} onChange={(event) => setDomains((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Paste purchased domain" aria-label={`Purchased domain for ${item.domain}`} /><Button onClick={() => void assign(item)} disabled={loading}>{item.status === "assigned" ? "Update domain" : "Assign domain"}</Button></div>)}</CardContent></Card>;
}
