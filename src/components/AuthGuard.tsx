import { Navigate } from "react-router-dom";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
}

const AuthGuard = ({ children, requiredRole }: AuthGuardProps) => {
  const { user, loading, hasRole, isAdmin } = useAuth();
  const [agentApproved, setAgentApproved] = useState<boolean | null>(null);
  const [hasAgentStore, setHasAgentStore] = useState<boolean | null>(null);
  const [checkingApproval, setCheckingApproval] = useState(false);

  // Check for admin impersonation - stored in localStorage
  const isImpersonatingSubagent = typeof window !== 'undefined' && !!localStorage.getItem("admin_impersonate_subagent");
  const isImpersonatingAgent = typeof window !== 'undefined' && !!localStorage.getItem("admin_impersonate_agent");
  const isImpersonating = isImpersonatingSubagent || isImpersonatingAgent;

  // If impersonating, allow access immediately (admin set the localStorage before navigating)
  // This check happens BEFORE loading check to prevent any redirects
  if (isImpersonating) {
    // Still need to wait for auth to load to render the dashboard properly
    if (loading) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="animate-pulse text-primary font-display text-xl">Loading...</div>
        </div>
      );
    }
    return <>{children}</>;
  }

  useEffect(() => {
    // Check approval for agent role - even if user doesn't have agent role yet
    if (requiredRole === "agent" && user && !isAdmin && !isImpersonating) {
      setCheckingApproval(true);
      supabase
        .from("agent_stores")
        .select("approved")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setHasAgentStore(true);
            setAgentApproved(data.approved ?? false);
          } else {
            setHasAgentStore(false);
            setAgentApproved(null);
          }
          setCheckingApproval(false);
        });
    }
  }, [user, requiredRole, isAdmin, isImpersonating]);

  // Show loading while auth is being determined
  if (loading || checkingApproval) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-display text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  
  // For agent route: check store approval BEFORE role check
  if (requiredRole === "agent" && !isAdmin) {
    // User has an agent store but it's not approved yet - redirect to pay
    if (hasAgentStore && agentApproved === false) {
      return <Navigate to="/pending-approval" replace />;
    }
    // User has no agent store and no agent role - redirect to onboarding
    if (!hasAgentStore && !hasRole("agent")) {
      return <Navigate to="/agent-onboarding" replace />;
    }
  }

  // For non-agent routes: standard role check
  if (requiredRole && requiredRole !== "agent") {
    if (!hasRole(requiredRole) && !isAdmin) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default AuthGuard;
