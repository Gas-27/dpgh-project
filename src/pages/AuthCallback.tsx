import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * Handles the OAuth callback from Supabase (e.g. Google sign-in).
 * Supabase exchanges the code/token in the URL, establishes a session,
 * then we look up the user's role and redirect to the correct dashboard.
 */
const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handle = async () => {
      // Give Supabase a moment to process the hash/code in the URL
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        navigate("/login", { replace: true });
        return;
      }

      const userId = session.user.id;

      // Look up role exactly like Login.tsx does
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
      } else if (roles.includes("customer")) {
        navigate("/user-dashboard", { replace: true });
      } else {
        // No role assigned yet — new Google user, send to user dashboard
        // (role will be assigned when they first land there)
        navigate("/user-dashboard", { replace: true });
      }
    };

    handle();
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
