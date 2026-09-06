import { useState } from "react";
import { Search, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SpaceshipDomainSearch() {
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function searchDomain(event: React.FormEvent) {
    event.preventDefault();
    const normalized = domain.trim().toLowerCase();
    if (!normalized || !normalized.includes(".")) {
      setError("Enter a complete domain, such as example.com.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    const { data, error: invokeError } = await supabase.functions.invoke("spaceship-api", {
      body: { method: "GET", path: `/v1/domains/${encodeURIComponent(normalized)}/available` },
    });
    setLoading(false);
    if (invokeError) setError("We could not check this domain right now.");
    else setResult(data);
  }

  const available = result?.available ?? result?.isAvailable;

  return (
    <Card className="border-border/60 bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Search className="h-5 w-5 text-primary" /> Search for a domain</CardTitle>
        <p className="text-sm text-muted-foreground">Check availability across Spaceship-supported extensions.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={searchDomain} className="flex flex-col gap-2 sm:flex-row">
          <Input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="yourbrand.com" aria-label="Domain name" />
          <Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Check availability</Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {result && !error && (
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <span className="font-medium">{domain.trim().toLowerCase()}</span>
            <Badge variant={available ? "default" : "secondary"} className="gap-1">{available ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}{available ? "Available" : "Unavailable"}</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
