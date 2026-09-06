import { useState } from "react";
import { Search, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const supportedTlds = [".com", ".net", ".org", ".co", ".io", ".app", ".shop", ".site", ".online", ".website", ".cheap"];

export default function SpaceshipDomainSearch() {
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function searchDomain(event: React.FormEvent) {
    event.preventDefault();
    const raw = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    const base = raw.split(".")[0];
    if (!/^[a-z0-9-]{1,63}$/.test(base)) {
      setError("Enter a domain name using letters, numbers, or hyphens.");
      return;
    }
    const requested = raw.includes(".") ? [raw] : supportedTlds.map((tld) => `${base}${tld}`);
    setLoading(true);
    setError("");
    setResult(null);
    const { data, error: invokeError } = await supabase.functions.invoke("spaceship-api", {
      body: {
        method: "POST",
        path: "/v1/domains/available",
        body: { domains: requested },
      },
    });
    setLoading(false);
    if (invokeError) {
      let detail = invokeError.message || "We could not check this domain right now.";
      try {
        const response = (invokeError as { context?: Response }).context;
        if (response) {
          const payload = await response.clone().json();
          detail = payload?.error || payload?.message || detail;
        }
      } catch {
        // Keep the SDK error when the function response is not JSON.
      }
      setError(detail.includes("credentials") ? "Domain search is temporarily unavailable. Please try again shortly." : detail);
      return;
    }

    const results = data?.domains ?? data?.items ?? [];
    if (!results.length) {
      setError("No domain options were returned. Try another name.");
      return;
    }
    setResult(results);
  }

  const results = Array.isArray(result) ? result : result ? [result] : [];
  const isAvailable = (item: any) => item?.result === "available" || item?.available === true || item?.isAvailable === true;

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-primary" /> Search for a domain</CardTitle>
        <p className="text-sm text-muted-foreground">Search available names across popular domain extensions.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">{supportedTlds.map((tld) => <button key={tld} type="button" className="rounded-full border border-border px-2 py-1 hover:border-primary hover:text-primary" onClick={() => setDomain((current) => current.replace(/\.[a-z]+$/i, "") + tld)}>{tld}</button>)}</div>
        <form onSubmit={searchDomain} className="flex flex-col gap-2 sm:flex-row">
          <Input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="yourbrand.com" aria-label="Domain name" />
          <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Check availability</Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {results.length > 0 && !error && (
          <div className="grid gap-2 sm:grid-cols-2">
            {results.map((item: any) => {
              const name = item.domain || item.name || "Domain";
              const available = isAvailable(item);
              return <div key={name} className="flex items-center justify-between rounded-lg border border-border p-3"><span className="font-medium">{name}</span><Badge variant={available ? "default" : "secondary"} className="gap-1">{available ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{available ? "Available" : "Unavailable"}</Badge></div>;
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
