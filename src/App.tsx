import { lazy, Suspense } from "react";
import { useParams, BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthGuard from "@/components/AuthGuard";
import { AuthProvider } from "@/hooks/useAuth";
import { useEffect } from "react";

const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Packages = lazy(() => import("./pages/Packages"));
const AgentOnboarding = lazy(() => import("./pages/AgentOnboarding"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AgentDashboard = lazy(() => import("./pages/AgentDashboard"));
const AgentStorefront = lazy(() => import("./pages/AgentStorefront"));
const AgentRegistrationCallback = lazy(() => import("./pages/AgentRegistrationCallback"));

const queryClient = new QueryClient();

const RouteLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-pulse text-primary font-display text-xl">Loading...</div>
  </div>
);

// Quick redirect from old /store/:storeName to the subdomain
const RedirectToStoreSubdomain = () => {
  const { storeName } = useParams<{ storeName: string }>();
  useEffect(() => {
    if (storeName) {
      window.location.href = `https://${storeName}.datastores.shop`;
    }
  }, [storeName]);
  return <RouteLoader />;
};

// Quick redirect from old /agent/:storeName to the subdomain
const RedirectToAgentSubdomain = () => {
  const { storeName } = useParams<{ storeName: string }>();
  useEffect(() => {
    if (storeName) {
      window.location.href = `https://${storeName}.datastores.shop`;
    }
  }, [storeName]);
  return <RouteLoader />;
};

const App = () => {
  // Determine if we are on a subdomain of datastores.shop
  const hostname = window.location.hostname;
  const isSubdomain = hostname.endsWith(".datastores.shop") && hostname !== "datastores.shop";

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<RouteLoader />}>
              {isSubdomain ? (
                // 🎯 On any subdomain, ALWAYS show the agent storefront
                <AgentStorefront />
              ) : (
                // 🌐 On the main domain, use normal routes
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/packages" element={<Packages />} />
                  <Route path="/agent-onboarding" element={<AgentOnboarding />} />
                  <Route path="/pending-approval" element={<PendingApproval />} />
                  {/* Old paths – redirect to subdomain */}
                  <Route path="/agent/:storeName" element={<RedirectToAgentSubdomain />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/store/:storeName" element={<RedirectToStoreSubdomain />} />
                  <Route path="/agent-registration-callback" element={<AgentRegistrationCallback />} />
                  <Route
                    path="/admin"
                    element={
                      <AuthGuard requiredRole="admin">
                        <AdminDashboard />
                      </AuthGuard>
                    }
                  />
                  <Route
                    path="/agent"
                    element={
                      <AuthGuard requiredRole="agent">
                        <AgentDashboard />
                      </AuthGuard>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              )}
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;