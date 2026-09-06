import { useState } from "react";
import { Globe2, Link2, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const supportedTlds = [".com", ".net", ".org", ".co", ".io", ".app", ".shop", ".site", ".online", ".website", ".cheap"];
type DnsRecord = { type: string; name: string; value: string; ttl: number };

export default function CustomDomainPanel() {
  const [domain, setDomain] = useState("");
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function callSpaceship(method: string, path: string, body?: unknown) {
    const { data, error: invokeError } = await supabase.functions.invoke("spaceship-api", {
      body: { method, path, body },
    });
    if (invokeError) throw new Error(invokeError.message);
    if (data?.error) throw new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error));
    return data;
  }

  async function loadDns() {
    const normalized = domain.trim().toLowerCase();
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(normalized)) {
      setError("Enter a valid domain you manage at Spaceship.");
      return;
    }
    setLoading(true); setError(""); setMessage("");
    try {
      const data = await callSpaceship("GET", `/v1/dns/records/${encodeURIComponent(normalized)}`);
      setRecords(data?.records ?? data ?? []);
      setMessage("DNS records loaded from Spaceship.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Spaceship could not load DNS records.");
    } finally { setLoading(false); }
  }

  async function saveDns() {
    const normalized = domain.trim().toLowerCase();
    setLoading(true); setError(""); setMessage("");
    try {
      await callSpaceship("PUT", `/v1/dns/records/${encodeURIComponent(normalized)}`, { records });
      setMessage("DNS records saved to Spaceship.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Spaceship could not save DNS records.");
    } finally { setLoading(false); }
  }

  function addRecord() { setRecords((current) => [...current, { type: "A", name: "@", value: "", ttl: 3600 }]); }
  function updateRecord(index: number, patch: Partial<DnsRecord>) { setRecords((current) => current.map((record, i) => i === index ? { ...record, ...patch } : record)); }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Globe2 className="h-5 w-5 text-primary" /> Spaceship domain management</CardTitle>
        <p className="text-sm text-muted-foreground">Manage a domain registered in Spaceship, load its DNS records, add records, and save changes directly through the Spaceship API.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="example.com" aria-label="Spaceship domain" />
          <Button type="button" onClick={loadDns} disabled={loading || !domain.trim()}><Link2 className="mr-2 h-4 w-4" />Load DNS</Button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground"><span>Supported:</span>{supportedTlds.map((tld) => <span key={tld} className="rounded-full border border-border px-2 py-1">{tld}</span>)}</div>
        {records.length > 0 && <div className="space-y-3 rounded-lg border border-border p-4">
          {records.map((record, index) => <div key={`${index}-${record.type}`} className="grid grid-cols-1 gap-2 md:grid-cols-[100px_1fr_1fr_100px_40px]">
            <div><Label className="text-xs">Type</Label><Input value={record.type} onChange={(event) => updateRecord(index, { type: event.target.value.toUpperCase() })} /></div>
            <div><Label className="text-xs">Name</Label><Input value={record.name} onChange={(event) => updateRecord(index, { name: event.target.value })} /></div>
            <div><Label className="text-xs">Value</Label><Input value={record.value} onChange={(event) => updateRecord(index, { value: event.target.value })} /></div>
            <div><Label className="text-xs">TTL</Label><Input type="number" value={record.ttl} onChange={(event) => updateRecord(index, { ttl: Number(event.target.value) || 3600 })} /></div>
            <Button type="button" variant="ghost" size="icon" className="mt-5" onClick={() => setRecords((current) => current.filter((_, i) => i !== index))} aria-label="Remove DNS record"><Trash2 className="h-4 w-4" /></Button>
          </div>)}
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={addRecord}><Plus className="mr-2 h-4 w-4" />Add record</Button><Button type="button" onClick={saveDns} disabled={loading}><Save className="mr-2 h-4 w-4" />Save DNS</Button></div>
        </div>}
        {records.length === 0 && domain && <Button type="button" variant="outline" onClick={addRecord}><Plus className="mr-2 h-4 w-4" />Add DNS record</Button>}
        {message && <p className="text-sm text-primary">{message}</p>}
        {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><strong>Spaceship request failed:</strong> {error}</div>}
      </CardContent>
    </Card>
  );
}
