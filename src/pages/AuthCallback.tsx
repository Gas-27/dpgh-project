import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const routeByRole = async (userId: string, navigate: ReturnType<typeof useNavigate>) => {
  const { data: rolesData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  const roles = (rolesData ?? []).map((r: { role: string }) => r.role);

  if (roles.includes("admin")) {
    navigate("/only-admin/log.in", { replace: true });
  } else if (roles.includes("agent")) {
    navigate("/agent", { replace: true });
  } else if (roles.includes("subagent")) {
    navigate("/subagent-dashboard", { replace: true });
  } else {
    // customer or brand-new Google user
    navigate("/user-dashboard", { replace: true });
  }
};

/**
 * Dedicated OAuth callback page for Google sign-in.
 *
 * Why this exists: Supabase performs a PKCE exchange after Google redirects
 * back. The exchange is async — calling getSession() immediately after mount
 * can race against it. Instead we:
 *   1. Call exchangeCodeForSession() to explicitly finish the PKCE flow using
 *      the `code` query param Google appended to the URL.
 *   2. Fall back to listening for onAuthStateChange('SIGNED_IN') in case the
 *      client already handled the exchange in the background.
 *   3. Fall back to getSession() for implicit-flow tokens in the hash fragment.
 */
const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let settled = false;

    const redirect = (userId: string) => {
      if (settled) return;
      settled = true;
      routeByRole(userId, navigate);
    };

    // 1. Listen for the SIGNED_IN event — Supabase fires this automatically
    //    once it finishes exchanging the code/token from the URL.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
          redirect(session.user.id);
        }
      }
    );

    // 2. Explicitly exchange the PKCE code that Google put in the URL.
    //    This resolves the bad_oauth_state error caused by the implicit
    //    getSession() call racing against the async code exchange.
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (!error && data.session) {
          redirect(data.session.user.id);
        } else if (error) {
          // Exchange failed — go back to login
          if (!settled) {
            settled = true;
            navigate("/login", { replace: true });
          }
        }
      });
    } else {
      // 3. No code param — may be an implicit hash-based token or the client
      //    already exchanged it. Just read the current session.
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          redirect(session.user.id);
        } else if (!code) {
          // Nothing to work with — route to login after a short wait in case
          // the onAuthStateChange listener fires.
          setTimeout(() => {
            if (!settled) {
              settled = true;
              navigate("/login", { replace: true });
            }
          }, 3000);
        }
      });
    }

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm">Signing you in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
