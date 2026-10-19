import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, KeyRound, Loader2, RefreshCw } from "lucide-react";

// Generated Supabase types predate the private_share_* RPCs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type MyAssignment = {
  assignment_id: string;
  service_name: string;
  status: string;
  entitlement_starts_at: string | null;
  entitlement_expires_at: string | null;
  customer_note: string | null;
};

type CodeState =
  | { phase: "idle" }
  | { phase: "waiting"; requestId: string; expiresAt: string }
  | { phase: "ready"; code: string; expiresAt: string }
  | { phase: "expired" };

const POLL_MS = 4000;
const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString() : "-");

function secondsLeft(iso: string) {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

function Countdown({ until }: { until: string }) {
  const [left, setLeft] = useState(() => secondsLeft(until));
  useEffect(() => {
    setLeft(secondsLeft(until));
    const t = setInterval(() => setLeft(secondsLeft(until)), 1000);
    return () => clearInterval(t);
  }, [until]);
  const m = Math.floor(left / 60);
  const s = String(left % 60).padStart(2, "0");
  return <span className="tabular-nums">{m}:{s}</span>;
}

function CodeCard({ assignment }: { assignment: MyAssignment }) {
  const { toast } = useToast();
  const [state, setState] = useState<CodeState>({ phase: "idle" });
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const poll = useCallback(async (requestId: string) => {
    const { data, error } = await db.rpc("private_share_customer_poll_code", { p_request_id: requestId });
    if (error) {
      stopPolling();
      setState({ phase: "idle" });
      toast({ title: "Could not check for your code", description: error.message, variant: "destructive" });
      return;
    }
    if (data?.status === "ready") {
      stopPolling();
      setState({ phase: "ready", code: data.code, expiresAt: data.expires_at });
    } else if (data?.status === "waiting") {
      setState({ phase: "waiting", requestId, expiresAt: data.expires_at });
    } else {
      stopPolling();
      setState({ phase: "expired" });
    }
  }, [stopPolling, toast]);

  const requestCode = async () => {
    setBusy(true);
    stopPolling();
    try {
      const { data, error } = await db.rpc("private_share_customer_request_code", { p_assignment_id: assignment.assignment_id });
      if (error) {
        toast({ title: "Could not request a code", description: error.message, variant: "destructive" });
        return;
      }
      setState({ phase: "waiting", requestId: data.request_id, expiresAt: data.expires_at });
      await poll(data.request_id);
      pollRef.current = setInterval(() => poll(data.request_id), POLL_MS);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({ title: "Code copied" });
    } catch {
      toast({ title: "Copy failed", description: "Select the code and copy it manually.", variant: "destructive" });
    }
  };

  const active = assignment.status === "active";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{assignment.service_name}</CardTitle>
          <Badge variant={active ? "default" : "secondary"}>{assignment.status.replace(/_/g, " ")}</Badge>
        </div>
        <CardDescription>
          {assignment.entitlement_expires_at ? `Access until ${fmtDate(assignment.entitlement_expires_at)}` : "Waiting to be set up"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {assignment.customer_note && (
          <p className="rounded-md bg-muted p-3 text-sm text-pretty">{assignment.customer_note}</p>
        )}

        {active && state.phase === "idle" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-pretty">
              Start signing in first so the service sends its code, then press the button. Your code appears here as soon as it arrives.
            </p>
            <Button onClick={requestCode} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Get my login code
            </Button>
          </div>
        )}

        {state.phase === "waiting" && (
          <div className="flex items-center gap-3 rounded-md border p-3" role="status" aria-live="polite">
            <Loader2 className="h-5 w-5 animate-spin" />
            <div className="text-sm">
              <p className="font-medium">Waiting for the code to arrive...</p>
              <p className="text-muted-foreground">Checking automatically. Request times out in <Countdown until={state.expiresAt} />.</p>
            </div>
          </div>
        )}

        {state.phase === "ready" && (
          <div className="space-y-3 rounded-md border p-4" role="status" aria-live="polite">
            <p className="text-sm text-muted-foreground">Your login code</p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-3xl font-semibold tracking-widest">{state.code}</span>
              <Button variant="outline" size="sm" onClick={() => copy(state.code)}>
                <Copy className="mr-2 h-4 w-4" />Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Expires in <Countdown until={state.expiresAt} />. Enter it on the sign-in page now.</p>
            <Button variant="ghost" size="sm" onClick={() => setState({ phase: "idle" })}>
              <RefreshCw className="mr-2 h-4 w-4" />Need a new code
            </Button>
          </div>
        )}

        {state.phase === "expired" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-pretty">No code arrived in time. Start the sign-in again and request a new code.</p>
            <Button variant="outline" onClick={() => setState({ phase: "idle" })}>Try again</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PrivateShareMySubscriptions() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MyAssignment[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await db.rpc("private_share_my_assignments");
    if (error) toast({ title: "Could not load your private subscriptions", description: error.message, variant: "destructive" });
    setItems(data ?? []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex items-center justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">My private subscriptions</h2>
          <p className="text-sm text-muted-foreground">Get your sign-in verification code here when the service asks for one.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-2 h-4 w-4" />Refresh
        </Button>
      </div>
      {items.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">
          You have no private-share subscriptions yet. Once you buy one and it is confirmed, it will appear here.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((a) => <CodeCard key={a.assignment_id} assignment={a} />)}
        </div>
      )}
    </div>
  );
}
