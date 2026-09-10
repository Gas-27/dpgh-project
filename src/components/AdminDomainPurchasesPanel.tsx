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
  const [aliases, setAliases] = useState<Record<string, any[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("domain_purchases").select("*").order("created_at", { ascending: false });
    if (error) toast({ title: "Could not load domain purchases", description: error.message, variant: "destructive" });
    setItems(data ?? []);
    const { data: aliasRows } = await supabase.from("store_domain_aliases").select("id, domain_purchase_id, hostname, status, store_kind, store_id").eq("status", "active");
    setAliases((aliasRows ?? []).reduce((result: Record<string, any[]>, alias: any) => { (result[alias.store_kind + ":" + alias.store_id] ??= []).push(alias); return result; }, {}));
    setLoading(false);
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  async function assign(item: any) {
    const domain = normalize(domains[item.id] || item.domain);
    if (!validDomain(domain)) { toast({ title: "Invalid domain", description: "Enter the domain purchased on Spaceship, such as example.com.", variant: "destructive" }); return; }
    setLoading(true);
    const { error } = await supabase.rpc("admin_assign_store_domain", { p_domain_purchase_id: item.id, p_hostname: domain });
    if (error) toast({ title: "Could not assign domain", description: error.message, variant: "destructive" });
    else { toast({ title: "Domain assigned", description: `${domain} now opens the same storefront. Configure this hostname in Vercel and DNS if needed.` }); await load(); }
    setLoading(false);
  }

  async function unassign(item: any) {
    setLoading(true);
    const { error } = await supabase.rpc("admin_unassign_store_domain", { p_domain_purchase_id: item.id });
    if (error) toast({ title: "Could not unassign domain", description: error.message, variant: "destructive" }); else { setDomains((current) => ({ ...current, [item.id]: "" })); toast({ title: "Domain unassigned", description: "The store is back on its default link." }); await load(); }
    setLoading(false);
  }

  return <Card><CardHeader><CardTitle>Custom Branding (Domain)</CardTitle><p className="text-sm text-muted-foreground">Buy your own domain and use it as an alternate URL for the same prebuilt storefront. Your branding, products, and controls stay unchanged. Assign additional purchases to add more domains.</p></CardHeader><CardContent className="space-y-3">{items.length === 0 ? <p className="text-sm text-muted-foreground">No domain purchases yet.</p> : items.map((item) => <div key={item.id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_1fr_1.4fr_auto_auto] md:items-center"><div><p className="font-semibold">{item.domain}</p><p className="text-xs text-muted-foreground">{item.store_kind} store · GHC {Number(item.price).toFixed(2)}</p>{(aliases[item.store_kind + ":" + (item.store_id || item.agent_store_id)] ?? []).map((alias) => <p key={alias.id} className="text-xs text-primary">Alias: {alias.hostname}</p>)}</div><Badge variant={item.term_ends_at && new Date(item.term_ends_at) < new Date() ? "destructive" : "outline"}>{item.term_ends_at && new Date(item.term_ends_at) < new Date() ? "expired" : item.renewal_due_at && new Date(item.renewal_due_at) <= new Date() ? "renewal due" : item.status}</Badge><Input value={domains[item.id] ?? item.assigned_domain ?? ""} onChange={(event) => setDomains((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Paste purchased domain" aria-label={`Purchased domain for ${item.domain}`} /><Button onClick={() => void (item.status === "active" ? unassign(item) : assign(item))} disabled={loading}>{item.status === "active" ? "Unassign" : "Assign domain"}</Button></div>)}</CardContent></Card>;
}
