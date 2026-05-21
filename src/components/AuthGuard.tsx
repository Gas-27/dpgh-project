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
  const [checkingApproval, setCheckingApproval] = useState(false);

  useEffect(() => {
    // Only check approval for agent role
    if (requiredRole === "agent" && user && !isAdmin) {
      setCheckingApproval(true);
      supabase
        .from("agent_stores")
        .select("approved")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          setAgentApproved(data?.approved ?? false);
          setCheckingApproval(false);
        });
    }
  }, [user, requiredRole, isAdmin]);

  if (loading || checkingApproval) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-display text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  
  // Admins can access any role-gated page
  if (requiredRole && !hasRole(requiredRole) && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Redirect unpaid agents to pending approval page
  if (requiredRole === "agent" && agentApproved === false && !isAdmin) {
    return <Navigate to="/pending-approval" replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;
