import { useState } from "react";
import { CheckCircle2, Globe2, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const tlds = [".com", ".net", ".org", ".co", ".io", ".app", ".shop", ".site", ".online", ".website", ".cheap", ".me", ".dev", ".ai", ".xyz", ".tech", ".store", ".cloud", ".pro", ".info", ".biz", ".live", ".space", ".blog", ".club", ".today", ".world", ".digital", ".solutions", ".gh"];
type RecordItem = { type: string; name: string; value: string; ttl: number };

type DomainDashboardPanelProps = { walletBalance?: number; walletLabel?: string; agentStoreId?: string | null; onPurchaseComplete?: () => void };

export default function DomainDashboardPanel({ walletBalance = 0, walletLabel = "Wallet balance", agentStoreId = null, onPurchaseComplete }: DomainDashboardPanelProps) {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<any>(null);
  const [domains, setDomains] = useState<any[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tldPricing, setTldPricing] = useState<Record<string, { customer_price: number; active: boolean }>>({});
  const results = Array.isArray(result) ? result : result ? [result] : [];
  const isAvailable = (item: any) => item?.available === true || item?.isAvailable === true || item?.result === "available";

  async function call(method: string, path: string, body?: unknown, queryParams?: Record<string, string>) {
    const response = await supabase.functions.invoke("spaceship-api", { body: { method, path, body, query: queryParams } });
    if (response.error) {
      const context = (response.error as any).context;
      let detail = response.error.message;
      try { const payload = await context?.clone().json(); detail = payload?.error || payload?.details?.detail || detail; } catch {}
      throw new Error(detail);
    }
      if (response.data?.error) {
        const detail = response.data.message || response.data.details?.detail || response.data.details?.message || response.data.details?.title;
        const code = response.data.spaceshipErrorCode ? ` [${response.data.spaceshipErrorCode}]` : "";
        throw new Error(`${detail || response.data.error}${response.data.status ? ` (HTTP ${response.data.status})` : ""}${code}`);
      }
    return response.data?.data ?? response.data;
  }

  async function search() {
    const raw = query.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    const base = raw.split(".")[0];
    if (!/^[a-z0-9-]{1,63}$/.test(base)) { setError("Enter a domain name using letters, numbers, or hyphens."); return; }
    const requested = raw.includes(".") ? [raw] : tlds.map((tld) => `${base}${tld}`);
    setLoading(true); setError(""); setMessage(""); setResult(null);
    try {
      const responses = await Promise.all(requested.map(async (candidate) => {
        try { return await call("POST", "/v1/domains/available", { domains: [candidate] }); } catch { return null; }
      }));
      const items = responses.flatMap((data: any) => Array.isArray(data) ? data : data?.domains ?? data?.items ?? data?.results ?? (data ? [data] : []));
      const resultTlds = Array.from(new Set(items.map((item: any) => {
        const name = String(item.domain || item.name || item.domainName || "").trim().toLowerCase();
        const parts = name.split(".").filter(Boolean);
        return parts.length > 1 ? `.${parts.slice(1).join(".")}` : "";
      }).filter(Boolean)));
      const { data: pricingRows, error: pricingError } = await supabase.from("spaceship_tld_pricing").select("tld,customer_price,active");
      if (pricingError) throw pricingError;
      const normalizedPricing = (pricingRows ?? []).map((row: any) => {
        const rawTld = String(row.tld ?? row.extension ?? "").trim().toLowerCase();
        const tld = rawTld.startsWith(".") ? rawTld : `.${rawTld}`;
        return [tld, { customer_price: Number(row.customer_price ?? row.price ?? 0), active: row.active !== false }] as const;
      });
      setTldPricing(Object.fromEntries(normalizedPricing));
      setResult(items);
      if (!items.length) setMessage("No domain availability results were returned. Try another name.");
    }
    catch (cause) { const text = cause instanceof Error ? cause.message : "Domain search failed."; setError(text.includes("credentials") ? "Domain search is temporarily unavailable. Please try again shortly." : text); } finally { setLoading(false); }
  }

  async function loadDomains() {
    setLoading(true); setError("");
    try { const userId = (await supabase.auth.getUser()).data.user?.id; let query = supabase.from("domain_purchases").select("id, domain, status, price, provider_operation_id, created_at"); query = agentStoreId ? query.eq("agent_store_id", agentStoreId) : query.eq("buyer_user_id", userId ?? "00000000-0000-0000-0000-000000000000"); const { data, error: loadError } = await query.order("created_at", { ascending: false }); if (loadError) throw loadError; setDomains(data ?? []); setMessage("Owned domains loaded successfully."); }
    catch (cause) { const text = cause instanceof Error ? cause.message : "Could not load domains."; setError(text.includes("credentials") ? "Domain management is temporarily unavailable. Please try again shortly." : text); } finally { setLoading(false); }
  }

  async function manage(value: string) {
    setDomain(value); setLoading(true); setError(""); setMessage("");
    try { const data = await call("GET", `/v1/dns/records/${encodeURIComponent(value)}`, undefined, { take: "100", skip: "0" }); setRecords(data?.items ?? data?.records ?? []); setMessage(`DNS records loaded for ${value}.`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load DNS records."); } finally { setLoading(false); }
  }

  async function buy(selected?: string) {
    const value = selected || result?.domain || query.trim().toLowerCase();
    if (!value) return;
    setLoading(true); setError(""); setMessage("");
    try {
      const selectedResult = (Array.isArray(result) ? result.find((item: any) => (item.domain || item.name) === value) : result) as any;
      const tld = `.${value.split(".").slice(1).join(".")}`.toLowerCase();
      const { data: pricing, error: pricingError } = await supabase.from("spaceship_tld_pricing").select("customer_price,active").eq("tld", tld).maybeSingle();
      if (pricingError) throw pricingError;
      if (pricing && pricing.active === false) throw new Error(`${tld} domains are not currently available for purchase.`);
      const price = Number(pricing?.customer_price ?? selectedResult?.price ?? selectedResult?.registrationPrice ?? selectedResult?.amount ?? 0);
      if (!Number.isFinite(price) || price <= 0) throw new Error("No customer price is configured for this domain extension.");
      if (walletBalance < price) throw new Error(`Insufficient wallet balance. You need GHC ${price.toFixed(2)}.`);
      const idempotencyKey = `${agentStoreId ?? "user"}:${value}:${Date.now()}`;
      const { data: purchase, error: purchaseError } = await supabase.rpc("purchase_domain", { p_domain: value, p_agent_store_id: agentStoreId, p_idempotency_key: idempotencyKey, p_registration_metadata: {} });
      if (purchaseError) throw purchaseError;
      const data = await call("POST", `/v1/domains/${encodeURIComponent(value)}`, { autoRenew: false, privacyProtection: true });
      setMessage(data?.operationId || data?.asyncOperationId ? `Purchase started. Operation: ${data.operationId || data.asyncOperationId}` : `Purchase submitted for ${purchase?.domain ?? value}.`);
      onPurchaseComplete?.();
      await loadDomains();
    }
    catch (cause) { const text = cause instanceof Error ? cause.message : "Purchase request failed."; setError(text); } finally { setLoading(false); }
  }

  async function saveDns() {
    setLoading(true); setError("");
    try { await call("PUT", `/v1/dns/records/${encodeURIComponent(domain)}`, { records }); setMessage("DNS records saved."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save DNS records."); } finally { setLoading(false); }
  }

  return <div className="space-y-6">
    <Card className="border-primary/30 bg-primary/5"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Globe2 className="h-5 w-5 text-primary" /> Domains</CardTitle><p className="text-sm text-muted-foreground">Search, buy, and manage your domains, DNS records, and nameservers from one place.</p></div><Badge variant="outline">{walletLabel}: GHC {walletBalance.toFixed(2)}</Badge></div></CardHeader><CardContent className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row"><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="example.com" aria-label="Domain to search" /><Button onClick={search} disabled={loading || !query.trim()}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Search domain</Button></div>
      <div className="flex flex-wrap gap-2">{tlds.map((tld) => <button type="button" key={tld} className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary" onClick={() => setQuery((query.split(".")[0] || "example") + tld)}>{tld}</button>)}</div>
      {results.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{results.map((item: any) => { const name = item.domain || item.name || item.domainName || query; const available = isAvailable(item); const nameParts = String(name).trim().toLowerCase().split(".").filter(Boolean); const tld = nameParts.length > 1 ? `.${nameParts.slice(1).join(".")}` : ""; const configured = tldPricing[tld]; const price = configured?.customer_price ?? 0; const purchasable = available && Boolean(configured?.active) && Number.isFinite(price) && price > 0; const canAfford = purchasable && walletBalance >= price; return <div key={name} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 p-4"><div><p className="font-semibold">{name}</p><div className="flex flex-wrap items-center gap-2"><Badge variant={available ? "default" : "secondary"}>{available ? "Available" : "Domain taken"}</Badge><span className="text-sm font-semibold text-primary">{purchasable ? `GHC ${price.toFixed(2)}` : "Price unavailable"}</span></div>{!purchasable && available && <p className="text-xs text-muted-foreground">This extension is not available for purchase yet.</p>}</div><Button onClick={() => { setResult(item); setQuery(name); void buy(name); }} disabled={loading || !canAfford}>{!purchasable ? "Unavailable" : canAfford ? "Buy domain" : "Insufficient wallet"}</Button></div>; })}</div>}
    </CardContent></Card>

    <Card><CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Your domains</CardTitle><p className="text-sm text-muted-foreground">Load registered domains and open DNS management.</p></div><Button variant="outline" onClick={loadDomains} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button></div></CardHeader><CardContent>{domains.length ? <div className="space-y-2">{domains.map((item, index) => { const name = item.name || item.domain; return <div key={`${name}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"><span className="font-medium">{name}</span><Button variant="outline" size="sm" onClick={() => manage(name)}>Manage DNS</Button></div>; })}</div> : <p className="text-sm text-muted-foreground">Click Refresh to load your domains.</p>}</CardContent></Card>

    {domain && <Card><CardHeader><CardTitle>DNS records for {domain}</CardTitle></CardHeader><CardContent className="space-y-3">{records.map((record, index) => <div key={`${record.type}-${index}`} className="grid gap-2 md:grid-cols-[100px_1fr_1fr_100px_40px]"><Input value={record.type} aria-label="DNS type" onChange={(e) => setRecords((items) => items.map((item, i) => i === index ? { ...item, type: e.target.value.toUpperCase() } : item))} /><Input value={record.name} aria-label="DNS name" onChange={(e) => setRecords((items) => items.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} /><Input value={record.value} aria-label="DNS value" onChange={(e) => setRecords((items) => items.map((item, i) => i === index ? { ...item, value: e.target.value } : item))} /><Input type="number" value={record.ttl} aria-label="DNS TTL" onChange={(e) => setRecords((items) => items.map((item, i) => i === index ? { ...item, ttl: Number(e.target.value) || 3600 } : item))} /><Button variant="ghost" size="icon" onClick={() => setRecords((items) => items.filter((_, i) => i !== index))} aria-label="Delete DNS record"><Trash2 className="h-4 w-4" /></Button></div>)}<div className="flex gap-2"><Button variant="outline" onClick={() => setRecords((items) => [...items, { type: "A", name: "@", value: "", ttl: 3600 }])}><Plus className="mr-2 h-4 w-4" />Add record</Button><Button onClick={saveDns} disabled={loading}><Save className="mr-2 h-4 w-4" />Save DNS</Button></div></CardContent></Card>}
    {message && <p className="flex items-center gap-2 text-sm text-primary"><CheckCircle2 className="h-4 w-4" />{message}</p>}{error && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><strong>Domain request failed:</strong> {error}</div>}
  </div>;
}
