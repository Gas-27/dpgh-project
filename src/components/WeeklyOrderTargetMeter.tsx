import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Award, Flame, Loader2, Sparkles } from "lucide-react";

type StoreType = "agent" | "subagent" | "subsubagent";

function getWeekStart() {
  const date = new Date();
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

export default function WeeklyOrderTargetMeter({ storeId, storeType }: { storeId?: string; storeType: StoreType }) {
  const { toast } = useToast();
  const [target, setTarget] = useState(2000);
  const [orderCount, setOrderCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const weekStart = useMemo(getWeekStart, []);

  async function load() {
    if (!storeId) return;
    setLoading(true);
    const start = `${weekStart}T00:00:00.000Z`;
    const [{ data: settings }, { data: approvedRequest }, { count }] = await Promise.all([
      supabase.from("weekly_order_target_settings").select("weekly_order_target").eq("id", true).maybeSingle(),
      supabase.from("price_reduction_requests").select("week_start, personalized_target_orders").eq("requester_store_id", storeId).eq("requester_type", storeType).eq("status", "approved").not("personalized_target_orders", "is", null).order("reviewed_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq(storeType === "agent" ? "agent_store_id" : storeType === "subagent" ? "subagent_store_id" : "sub_subagent_store_id", storeId).gte("created_at", start),
    ]);
    const globalTarget = Math.max(1, Number(settings?.weekly_order_target ?? 2000));
    const requestWeek = approvedRequest?.week_start ? new Date(`${approvedRequest.week_start}T00:00:00.000Z`) : null;
    const currentWeek = new Date(`${weekStart}T00:00:00.000Z`);
    const isNextWeek = requestWeek && currentWeek.getTime() - requestWeek.getTime() === 7 * 86400000;
    const personalizedTarget = isNextWeek ? Number(approvedRequest?.personalized_target_orders ?? 0) : 0;
    setTarget(Math.max(1, personalizedTarget || globalTarget));
    setOrderCount(count ?? 0);
    const { data: requests } = await supabase.from("price_reduction_requests").select("request_type").eq("requester_store_id", storeId).eq("requester_type", storeType).eq("week_start", weekStart);
    setRequested(Object.fromEntries((requests ?? []).map((request) => [request.request_type, true])));
    setLoading(false);
  }

  useEffect(() => { void load(); }, [storeId, storeType, weekStart]);

  async function requestReduction(requestType: "price_reduction" | "huge_price_reduction") {
    if (!storeId || orderCount < target) {
      toast({ title: "Weekly target not reached", description: `Complete ${target.toLocaleString()} orders this week before requesting this benefit.`, variant: "destructive" });
      return;
    }
    setRequesting(requestType);
    const { error } = await supabase.from("price_reduction_requests").insert({ requester_store_id: storeId, requester_type: storeType, request_type: requestType, week_start: weekStart, order_count: orderCount, target_orders: target });
    if (error && error.code !== "23505") toast({ title: "Request could not be sent", description: error.message, variant: "destructive" });
    else { setRequested((current) => ({ ...current, [requestType]: true })); toast({ title: "Request sent", description: "Admin will review your weekly performance and respond." }); }
    setRequesting(null);
  }

  const progress = Math.min(100, (orderCount / target) * 100);
  const reached = orderCount >= target;
  return <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/10">
    <CardHeader className="pb-3"><div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-primary" /> Weekly growth target</CardTitle><p className="mt-1 text-sm text-muted-foreground">Your progress resets every Monday. An approved reduction request makes your next weekly target 3× higher.</p></div><Badge variant={reached ? "default" : "secondary"}>{reached ? "Target reached" : `${orderCount.toLocaleString()} / ${target.toLocaleString()}`}</Badge></div></CardHeader>
    <CardContent className="space-y-4">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><div className="flex items-end justify-between gap-3"><div><p className="text-3xl font-bold text-primary">{orderCount.toLocaleString()}</p><p className="text-xs text-muted-foreground">orders this week</p></div><Award className="h-10 w-10 text-primary/60" /></div><Progress value={progress} className="h-3" /><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => requestReduction("price_reduction")} disabled={!reached || Boolean(requested.price_reduction) || Boolean(requesting)}>{requesting === "price_reduction" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{requested.price_reduction ? "Request sent" : "Request price reduction"}</Button></div>{!reached && <p className="text-xs text-muted-foreground">The request buttons unlock at {target.toLocaleString()} weekly orders.</p>}</>}</CardContent>
  </Card>;
}
