import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isRevokedApiKey } from "@/lib/apiKeyAccount";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plug } from "lucide-react";

export const DEFAULT_API_WEEKLY_TARGET = 14000;

function getWeekStartIso() {
  const date = new Date();
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  date.setHours(0, 0, 0, 0);
  return `${date.toISOString().slice(0, 10)}T00:00:00.000Z`;
}

const EXCLUDED_STATUSES = "(failed,refunded)";

/**
 * Weekly target for API orders only. Appears once the user has an active API
 * key and has placed at least one order through it. Dashboard, wallet and
 * storefront orders are never counted.
 */
export default function ApiWeeklyTargetMeter({ identityId, minOrders = 0 }: { identityId?: string | null; minOrders?: number }) {
  const { toast } = useToast();
  const [state, setState] = useState<{ visible: boolean; weekly: number; total: number; target: number }>({
    visible: false,
    weekly: 0,
    total: 0,
    target: DEFAULT_API_WEEKLY_TARGET,
  });
  const [loading, setLoading] = useState(true);
  const [requested, setRequested] = useState(false);
  const [requesting, setRequesting] = useState(false);

  async function requestReduction() {
    setRequesting(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc("request_api_price_reduction");
    setRequesting(false);
    if (error) {
      toast({ title: "Could not send request", description: error.message, variant: "destructive" });
      return;
    }
    setRequested(true);
    toast({ title: "Request sent", description: "Admin has received your price reduction request." });
  }

  useEffect(() => {
    if (!identityId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function load() {
      // Generated Supabase types predate the api_users / api_user columns used here.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data: apiUser } = await db
        .from("api_users")
        .select("id, api_key")
        .eq("identity_id", identityId)
        .maybeSingle();

      if (!apiUser || !apiUser.api_key || isRevokedApiKey(apiUser.api_key)) {
        if (!cancelled) {
          setState((current) => ({ ...current, visible: false }));
          setLoading(false);
        }
        return;
      }

      const [{ count: totalCount }, { count: weeklyCount }, { data: settings }, { data: existingRequest }] = await Promise.all([
        db
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("api_user", apiUser.id)
          .not("order_status", "in", EXCLUDED_STATUSES),
        db
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("api_user", apiUser.id)
          .not("order_status", "in", EXCLUDED_STATUSES)
          .gte("created_at", getWeekStartIso()),
        db.from("weekly_order_target_settings").select("api_weekly_order_target").eq("id", true).maybeSingle(),
        db
          .from("api_price_reduction_requests")
          .select("id")
          .eq("identity_id", identityId)
          .eq("week_start", getWeekStartIso().slice(0, 10))
          .maybeSingle(),
      ]);

      if (cancelled) return;
      setRequested(Boolean(existingRequest));
      const configuredTarget = Number((settings as { api_weekly_order_target?: number } | null)?.api_weekly_order_target);
      setState({
        visible: (totalCount ?? 0) > minOrders,
        weekly: weeklyCount ?? 0,
        total: totalCount ?? 0,
        target: Number.isFinite(configuredTarget) && configuredTarget > 0 ? configuredTarget : DEFAULT_API_WEEKLY_TARGET,
      });
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [identityId, minOrders]);

  if (loading) return null;
  if (!state.visible) return null;

  const reached = state.weekly >= state.target;
  const progress = Math.min(100, (state.weekly / state.target) * 100);

  return (
    <Card className="overflow-hidden border-cyan-500/30 bg-cyan-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-cyan-400" /> API weekly target
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Counts only orders placed through your API key. Progress resets every Monday.
            </p>
          </div>
          <Badge variant={reached ? "default" : "secondary"}>
            {reached ? "Target reached" : `${state.weekly.toLocaleString()} / ${state.target.toLocaleString()}`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-bold text-cyan-400">{state.weekly.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">API orders this week</p>
          </div>
          <p className="text-xs text-muted-foreground">{state.total.toLocaleString()} API orders all time</p>
        </div>
        <Progress value={progress} className="h-3" />
        {!reached && (
          <p className="text-xs text-muted-foreground">
            {(state.target - state.weekly).toLocaleString()} more API orders to reach this week&apos;s target.
          </p>
        )}
        <Button
          type="button"
          className="w-full sm:w-auto"
          disabled={!reached || requested || requesting}
          onClick={requestReduction}
        >
          {requesting ? "Sending..." : requested ? "Request sent this week" : "Request price reduction"}
        </Button>
        {!reached && (
          <p className="text-xs text-muted-foreground">This button unlocks once you reach the weekly target.</p>
        )}
      </CardContent>
    </Card>
  );
}
