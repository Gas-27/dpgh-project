import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { IMPERSONATING_FLAG, type ImpersonateKind } from "@/lib/adminImpersonate";

const DASHBOARD_ROUTES: Record<ImpersonateKind, string> = {
  agent: "/agent",
  subagent: "/dashboard",
  sub_subagent: "/sub-subagent-dashboard",
};

const STALE_LOCAL_KEYS = [
  "admin_impersonate_agent",
  "admin_impersonate_subagent",
  "admin_impersonate_sub_subagent",
  "admin_impersonate_store_id",
  "admin_impersonate_store",
  "admin_impersonate_return",
  "admin_impersonate_subsubagent",
  "admin_impersonate_subsubagent_store",
];

const ROLE_WAIT_MS = 5000;

const Impersonate = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const startedRef = useRef(false);
  const [verified, setVerified] = useState(false);
  const [failed, setFailed] = useState(false);

  const tokenHash = params.get("token_hash");
  const kind = params.get("kind") as ImpersonateKind | null;
  const route = kind ? DASHBOARD_ROUTES[kind] : undefined;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!tokenHash || !route) {
      setFailed(true);
      return;
    }

    const run = async () => {
      STALE_LOCAL_KEYS.forEach((key) => localStorage.removeItem(key));
      sessionStorage.removeItem(IMPERSONATING_FLAG);

      await supabase.auth.signOut({ scope: "local" });
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });

      if (error) {
        setFailed(true);
        return;
      }

      sessionStorage.setItem(IMPERSONATING_FLAG, "1");
      setVerified(true);
    };

    void run();
  }, [tokenHash, route]);

  // The auth provider loads roles asynchronously after sign-in. Wait for them
  // so the route guard on the dashboard does not bounce to the login page.
  useEffect(() => {
    if (!verified || !route) return;

    if (user && roles.length > 0) {
      navigate(route, { replace: true });
      return;
    }

    const timer = window.setTimeout(() => navigate(route, { replace: true }), ROLE_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [verified, user, roles, route, navigate]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 text-center">
        {failed ? (
          <>
            <ShieldAlert className="h-8 w-8 text-destructive" aria-hidden="true" />
            <p className="text-lg font-semibold text-foreground">Impersonation link expired or invalid</p>
            <p className="text-sm text-muted-foreground">Go back to the admin dashboard and try again.</p>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <p className="text-lg font-semibold text-foreground">Signing in as store…</p>
          </>
        )}
      </div>
    </main>
  );
};

export default Impersonate;
