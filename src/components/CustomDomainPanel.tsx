import { useState } from "react";
import { Globe2, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const supportedTlds = [".com", ".net", ".org", ".co", ".io", ".app", ".shop", ".site", ".online", ".website", ".cheap"];

export default function CustomDomainPanel() {
  const [domain, setDomain] = useState("");
  const [savedDomain, setSavedDomain] = useState("");

  function connectDomain() {
    const normalized = domain.trim().toLowerCase();
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(normalized)) return;
    setSavedDomain(normalized);
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Globe2 className="h-5 w-5 text-primary" /> Custom domain</CardTitle>
        <p className="text-sm text-muted-foreground">Connect a domain you own to this storefront. Your domain registrar must point it to the storefront address shown after saving.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="shop.example.com" aria-label="Custom domain" />
          <Button type="button" onClick={connectDomain} disabled={!domain.trim()}><Link2 className="mr-2 h-4 w-4" />Connect domain</Button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>Supported extensions:</span>{supportedTlds.map((tld) => <span key={tld} className="rounded-full border border-border px-2 py-1">{tld}</span>)}
        </div>
        {savedDomain && <p className="text-sm text-primary">Domain saved: {savedDomain}. DNS connection instructions will appear here once verified.</p>}
      </CardContent>
    </Card>
  );
}
