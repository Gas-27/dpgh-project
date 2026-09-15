import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Bell, Check, Loader2, X } from "lucide-react";

type RequestRow = { id: string; requester_type: string; requester_store_id: string; requester_store_name?: string | null; topup_reference?: string | null; request_type: string; order_count: number; target_orders: number; personalized_target_orders?: number | null; status: string; created_at: string };

export default function PriceReductionRequestsAdmin() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("price_reduction_requests").select("*").order("created_at", { ascending: false });
    if (!error) setRequests((data || []) as RequestRow[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const pending = requests.filter((request) => request.status === "pending");
  async function review(request: RequestRow, status: "approved" | "rejected") {
    setBusy(request.id);
    const personalized = status === "approved" ? Math.ceil(Number(request.target_orders) * 2.5) : null;
    const { error } = await supabase.from("price_reduction_requests").update({ status, personalized_target_orders: personalized, reviewed_at: new Date().toISOString() }).eq("id", request.id);
    setBusy(null);
    if (error) toast({ title: "Could not update request", description: error.message, variant: "destructive" });
    else { toast({ title: status === "approved" ? "Reduction approved" : "Request rejected", description: status === "approved" ? `This store's next target is ${personalized?.toLocaleString()} orders.` : undefined }); await load(); }
  }
  return <Card className="border-red-500/30"><CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-red-500" /> Price reduction requests {pending.length > 0 && <Badge className="bg-red-600 text-white">{pending.length}</Badge>}</CardTitle><p className="text-sm text-muted-foreground">Approve a request to give that store a personalized 2.5× weekly target for the next cycle.</p></CardHeader><CardContent className="space-y-3">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : requests.length === 0 ? <p className="text-sm text-muted-foreground">No price reduction requests yet.</p> : requests.map((request) => <div key={request.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between"><div><p className="font-semibold">{request.requester_store_name || "Store request"}</p><p className="text-sm text-muted-foreground">Top-up reference: <span className="font-medium text-foreground">{request.topup_reference || "Not available"}</span></p><p className="text-sm text-muted-foreground">{request.request_type === "huge_price_reduction" ? "Huge price reduction" : "Price reduction"} · {request.order_count.toLocaleString()} / {request.target_orders.toLocaleString()} weekly orders</p><p className="text-xs text-muted-foreground">{new Date(request.created_at).toLocaleString()}</p></div><div className="flex items-center gap-2">{request.status === "pending" ? <><Button size="sm" onClick={() => review(request, "approved")} disabled={busy === request.id}><Check className="mr-1 h-4 w-4" />Approve</Button><Button size="sm" variant="outline" onClick={() => review(request, "rejected")} disabled={busy === request.id}><X className="mr-1 h-4 w-4" />Reject</Button></> : <Badge variant="outline">{request.status}</Badge>}</div></div>)}</CardContent></Card>;
}
