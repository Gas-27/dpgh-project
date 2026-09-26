import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminDomainRenewalsPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase.from("domain_renewal_history").select("id,domain,amount,status,failure_reason,store_kind,created_at").order("created_at", { ascending: false }).limit(100);
      if (active) { setRows(data ?? []); setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, []);

  return <Card>
    <CardHeader>
      <CardTitle>Domain Renewal History</CardTitle>
      <p className="text-sm text-muted-foreground">Automatic wallet deductions, failed renewals, and the reason each renewal was disabled.</p>
    </CardHeader>
    <CardContent>
      {loading ? <p className="text-sm text-muted-foreground">Loading renewal history...</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">No renewal attempts yet.</p> : <div className="space-y-2">{rows.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{row.domain}</p><p className="text-xs text-muted-foreground">{row.store_kind} · {new Date(row.created_at).toLocaleString()}</p>{row.failure_reason && <p className="text-xs text-destructive">{row.failure_reason}</p>}</div><div className="flex items-center gap-3"><span className="text-sm">GHS {Number(row.amount).toFixed(2)}</span><Badge variant={row.status === "succeeded" ? "default" : "destructive"}>{row.status}</Badge></div></div>)}</div>}
    </CardContent>
  </Card>;
}

