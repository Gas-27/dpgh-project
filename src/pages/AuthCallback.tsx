import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let settled = false;

    const routeUser = async (userId: string) => {
      if (settled) return;
      settled = true;

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
        navigate("/user-dashboard", { replace: true });
      }
    };

    // With detectSessionInUrl:true, Supabase automatically reads the
    // access_token from the URL hash and fires SIGNED_IN. We just listen.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          routeUser(session.user.id);
        }
      }
    );

    // Also check if a session already exists (fast redirect case where
    // the client processed the token before our listener was registered).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        routeUser(session.user.id);
      }
    });

    // Fallback: nothing resolved in 6 seconds → back to login
    const fallback = setTimeout(() => {
      if (!settled) {
        settled = true;
        navigate("/login", { replace: true });
      }
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(fallback);
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
