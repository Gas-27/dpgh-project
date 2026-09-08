import { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const supportedTlds = [".com", ".net", ".org", ".co", ".io", ".app", ".shop", ".site", ".online", ".website", ".cheap", ".me", ".dev", ".ai", ".xyz", ".tech", ".store", ".cloud", ".pro", ".info", ".biz", ".live", ".space", ".blog", ".club", ".today", ".world", ".digital", ".solutions", ".gh"];

export default function AdminSpaceshipPricing() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("spaceship_tld_pricing").select("tld,customer_price,active").order("tld");
    if (error) {
      setMessage(`Pricing could not be loaded: ${error.message}`);
    }
    const existing = new Map((data ?? []).map((row: any) => [String(row.tld).trim().toLowerCase(), { ...row, tld: String(row.tld).trim().toLowerCase(), customer_price: Number(row.customer_price ?? 0) }]));
    setRows(supportedTlds.map((tld) => existing.get(tld) ?? { tld, customer_price: 0, active: true }));
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save(row: any) {
    const tld = String(row.tld).trim().toLowerCase();
    setSaving(tld);
    setMessage("");
    const customerPrice = Number(row.customer_price);
    if (!tld.startsWith(".") || !Number.isFinite(customerPrice) || customerPrice < 0) {
      setSaving(null);
      setMessage(`Enter a valid non-negative price for ${tld || "this TLD"}.`);
      return;
    }
    const { data: saved, error } = await supabase.from("spaceship_tld_pricing").upsert({ tld, provider_price: 0, customer_price: customerPrice, active: Boolean(row.active), updated_at: new Date().toISOString() }, { onConflict: "tld" }).select("tld,customer_price,active").single();
    setSaving(null);
    if (error) {
      setMessage(`Pricing could not be saved: ${error.message}`);
      return;
    }
    setRows((current) => current.map((item) => item.tld === row.tld ? { ...item, customer_price: Number(saved?.customer_price ?? customerPrice), active: saved?.active ?? Boolean(row.active) } : item));
    await load();
    setMessage(`${row.tld} pricing saved.`);
  }

  return <Card className="border-border/60 bg-card/80"><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>Spaceship domain pricing</CardTitle><p className="text-sm text-muted-foreground">Manage customer prices for every supported TLD.</p></div><Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></CardHeader><CardContent className="space-y-3">{loading ? <p className="text-sm text-muted-foreground">Loading pricing...</p> : rows.map((row) => <div key={row.tld} className="grid grid-cols-[80px_1fr_auto_auto] items-center gap-3 rounded-lg border border-border p-3"><strong>{row.tld}</strong><Input type="number" placeholder="Customer price (GHC)" min="0" step="0.01" value={row.customer_price} onChange={(e) => setRows(rows.map((item) => item.tld === row.tld ? { ...item, customer_price: e.target.value } : item))} aria-label={`${row.tld} customer price`} /><Switch checked={row.active} onCheckedChange={(active) => setRows(rows.map((item) => item.tld === row.tld ? { ...item, active } : item))} aria-label={`${row.tld} active`} /><Button size="sm" onClick={() => save(row)} disabled={saving === row.tld}><Save className="h-4 w-4" /></Button></div>)}{message && <p className="text-sm text-muted-foreground">{message}</p>}</CardContent></Card>;
}
