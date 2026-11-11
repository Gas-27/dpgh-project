import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Target } from "lucide-react";

type PriceRequest = { id: string; requester_email: string | null; weekly_orders: number; target: number; week_start: string; created_at: string };

export default function WeeklyOrderTargetAdmin() {
  const { toast } = useToast();
  const [target, setTarget] = useState("2000");
  const [apiTarget, setApiTarget] = useState("14000");
  const [benefits, setBenefits] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { void supabase.from("weekly_order_target_settings").select("*").eq("id", true).maybeSingle().then(({ data }) => { if (data) { setTarget(String(data.weekly_order_target)); setApiTarget(String((data as { api_weekly_order_target?: number }).api_weekly_order_target ?? 14000)); setBenefits(data.benefits_description || ""); } }); }, []);
  async function save() {
    const weeklyOrderTarget = Math.max(1, Number(target) || 1);
    const apiWeeklyOrderTarget = Math.max(1, Math.floor(Number(apiTarget) || 1));
    setSaving(true);
    const { error } = await supabase.from("weekly_order_target_settings").upsert({ id: true, weekly_order_target: weeklyOrderTarget, api_weekly_order_target: apiWeeklyOrderTarget, benefits_description: benefits.trim(), updated_at: new Date().toISOString() });
    setSaving(false);
    toast(error ? { title: "Could not save target", description: error.message, variant: "destructive" } : { title: "Weekly targets saved", description: `Stores: ${weeklyOrderTarget.toLocaleString()} orders. API users: ${apiWeeklyOrderTarget.toLocaleString()} API orders each week.` });
  }
  const [requests, setRequests] = useState<PriceRequest[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  async function loadRequests() {
    const { data } = await db.from("api_price_reduction_requests").select("id, requester_email, weekly_orders, target, week_start, created_at").eq("status", "pending").order("created_at", { ascending: false });
    setRequests((data as PriceRequest[]) ?? []);
  }
  useEffect(() => { void loadRequests(); }, []);
  async function markHandled(id: string) {
    const { error } = await db.from("api_price_reduction_requests").update({ status: "handled" }).eq("id", id);
    if (error) { toast({ title: "Could not update request", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Request marked as handled" });
    void loadRequests();
  }
  return <Card className="border-primary/30"><CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Weekly price-reduction target</CardTitle><p className="text-sm text-muted-foreground">The meter resets automatically every Monday for each store.</p></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Orders required per week</Label><Input type="number" min="1" value={target} onChange={e => setTarget(e.target.value)} /></div><div className="space-y-2"><Label>API orders required per week (counts API orders only)</Label><Input type="number" min="1" value={apiTarget} onChange={e => setApiTarget(e.target.value)} /></div><div className="space-y-2"><Label>Benefit description</Label><Input value={benefits} onChange={e => setBenefits(e.target.value)} placeholder="e.g. lower data prices and priority support" /></div><Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save weekly target</Button><div className="space-y-2 border-t border-border pt-4"><h3 className="text-sm font-semibold">API price-reduction requests ({requests.length})</h3>{requests.length === 0 ? <p className="text-sm text-muted-foreground">No pending requests.</p> : <ul className="space-y-2">{requests.map(r => <li key={r.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate font-medium">{r.requester_email || "Unknown user"}</p><p className="text-xs text-muted-foreground">{r.weekly_orders.toLocaleString()} / {r.target.toLocaleString()} API orders · week of {r.week_start} · {new Date(r.created_at).toLocaleString()}</p></div><Button size="sm" variant="outline" onClick={() => markHandled(r.id)}>Mark handled</Button></li>)}</ul>}</div></CardContent></Card>;
}
