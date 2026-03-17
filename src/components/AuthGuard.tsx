import { Navigate } from "react-router-dom";
import { useAuth, type AppRole } from "@/hooks/useAuth";

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole?: AppRole;
}

const AuthGuard = ({ children, requiredRole }: AuthGuardProps) => {
  const { user, loading, hasRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-display text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole && !hasRole(requiredRole)) return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default AuthGuard;
