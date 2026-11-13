import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DOMAINS } from "@/config/domains";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  clearPendingSubagentLogin,
  getSubagentDashboardPath,
  readPendingSubagentLogin,
  type PendingSubagentLogin,
} from "@/lib/subagentRegistration";

const SIGN_IN_INTERVAL_MS = 3000;
const SIGN_IN_TIMEOUT_MS = 2 * 60 * 1000;
const STORE_INTERVAL_MS = 2000;
const STORE_TIMEOUT_MS = 30 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Phase = "working" | "fallback";

export default function SubagentPaymentComplete() {
  const [phase, setPhase] = useState<Phase>("working");
  const [hasCredentials, setHasCredentials] = useState(false);
  const runIdRef = useRef(0);

  const run = useCallback(async (credentials: PendingSubagentLogin) => {
    const runId = ++runIdRef.current;
    const isStale = () => runIdRef.current !== runId;

    setPhase("working");

    // The webhook creates the account a few seconds after payment, so early
    // "Invalid login credentials" failures are expected while we keep polling.
    let userId: string | null = null;
    const signInDeadline = Date.now() + SIGN_IN_TIMEOUT_MS;
    while (!isStale() && Date.now() < signInDeadline) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email.trim(),
        password: credentials.password,
      });
      if (!error && data.user) {
        userId = data.user.id;
        break;
      }
      await sleep(SIGN_IN_INTERVAL_MS);
    }
    if (isStale()) return;
    if (!userId) {
      setPhase("fallback");
      return;
    }

    let storeReady = false;
    const storeDeadline = Date.now() + STORE_TIMEOUT_MS;
    while (!isStale() && Date.now() < storeDeadline) {
      const { data } = await supabase
        .from("subagent_stores")
        .select("id")
        .eq("user_id", userId)
        .limit(1);
      if (data && data.length > 0) {
        storeReady = true;
        break;
      }
      await sleep(STORE_INTERVAL_MS);
    }
    if (isStale()) return;
    if (!storeReady) {
      setPhase("fallback");
      return;
    }

    clearPendingSubagentLogin();
    window.location.href = getSubagentDashboardPath();
  }, []);

  useEffect(() => {
    const credentials = readPendingSubagentLogin();
    if (!credentials) {
      setHasCredentials(false);
      setPhase("fallback");
      return;
    }
    setHasCredentials(true);
    void run(credentials);
    return () => {
      runIdRef.current += 1;
    };
  }, [run]);

  const handleTryAgain = () => {
    const credentials = readPendingSubagentLogin();
    if (!credentials) {
      setHasCredentials(false);
      return;
    }
    void run(credentials);
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border bg-card/50">
        <CardContent className="p-8 flex flex-col items-center text-center gap-4">
          {phase === "working" ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
              <h1 className="text-xl font-semibold text-foreground text-balance">
                Payment received, setting up your account…
              </h1>
              <p className="text-sm text-muted-foreground text-pretty" role="status">
                This usually takes a few seconds. Please keep this page open and
                you will be taken to your dashboard automatically.
              </p>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-10 w-10 text-primary" aria-hidden="true" />
              <h1 className="text-xl font-semibold text-foreground text-balance">
                Payment received
              </h1>
              <p className="text-sm text-muted-foreground text-pretty">
                Payment received. Your account is being set up — sign in with the
                email and password you chose.
              </p>
              <div className="flex w-full flex-col gap-2">
                <Button
                  className="w-full"
                  onClick={() => {
                    window.location.href = DOMAINS.getSubagentLoginUrl();
                  }}
                >
                  Go to sub-agent login
                </Button>
                {hasCredentials && (
                  <Button variant="outline" className="w-full" onClick={handleTryAgain}>
                    Try again
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
