import { lazy, Suspense } from "react";
import { useParams, BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthGuard from "@/components/AuthGuard";
import { AuthProvider } from "@/hooks/useAuth";
import { DOMAINS } from "@/config/domains";
import { useEffect } from "react";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import NotificationPrompt from "@/components/NotificationPrompt";

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
const SubagentDashboard = lazy(() => import("./pages/SubagentDashboard"));
const SubagentLogin = lazy(() => import("./pages/SubagentLogin"));
const SubSubagentLogin = lazy(() => import("./pages/SubSubagentLogin"));
const SubagentStorefront = lazy(() => import("./pages/SubagentStorefront"));
const SubSubagentStorefront = lazy(() => import("./pages/SubSubagentStorefront"));
const SubagentRegistration = lazy(() => import("./pages/SubagentRegistration"));
const SubagentApprovalPayment = lazy(() => import("./pages/SubagentApprovalPayment"));
const VerifySubagentPayment = lazy(() => import("./pages/VerifySubagentPayment"));
const SubSubagentDashboard = lazy(() => import("./pages/SubSubagentDashboard"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // Data is fresh for 2 minutes
      gcTime: 1000 * 60 * 10, // Cache for 10 minutes
      refetchOnWindowFocus: false, // Don't refetch on window focus
      retry: 1, // Only retry once on failure
    },
  },
});

const RouteLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-muted-foreground text-sm">Loading...</p>
    </div>
  </div>
);

// Quick redirect from old /store/:storeName to the subdomain
const RedirectToStoreSubdomain = () => {
  const { storeName } = useParams<{ storeName: string }>();
  useEffect(() => {
    if (storeName) {
      window.location.href = DOMAINS.getAgentStoreUrl(storeName);
    }
  }, [storeName]);
  return <RouteLoader />;
};

// Quick redirect from old /agent/:storeName to the subdomain
const RedirectToAgentSubdomain = () => {
  const { storeName } = useParams<{ storeName: string }>();
  useEffect(() => {
    if (storeName) {
      window.location.href = DOMAINS.getAgentStoreUrl(storeName);
    }
  }, [storeName]);
  return <RouteLoader />;
};

const App = () => {
  // Determine if we are on a subdomain of datastores.shop or agentsstore.shop
  const hostname = window.location.hostname;
  const isAgentSubdomain = hostname.endsWith(`.${DOMAINS.AGENT_STORE}`) && hostname !== DOMAINS.AGENT_STORE;
  const isSubagentDomain = hostname === DOMAINS.SUBAGENT_STORE || 
                           hostname === `www.${DOMAINS.SUBAGENT_STORE}` ||
                           hostname.endsWith(`.${DOMAINS.SUBAGENT_STORE}`);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <PWAInstallPrompt />
        <NotificationPrompt />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<RouteLoader />}>
              {isSubagentDomain ? (
                // agentsstore.shop - Subagent domain with separate routing
                <Routes>
                  {/* Specific routes BEFORE catch-all routes */}
                  <Route path="/" element={<SubagentLogin />} />
                  <Route path="/login" element={<SubagentLogin />} />
                  <Route path="/sub-subagent-login" element={<SubSubagentLogin />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route
                    path="/dashboard"
                    element={
                      <AuthGuard requiredRole="subagent">
                        <SubagentDashboard />
                      </AuthGuard>
                    }
                  />
                  <Route
                    path="/sub-subagent-dashboard"
                    element={
                      <AuthGuard>
                        <SubSubagentDashboard />
                      </AuthGuard>
                    }
                  />
                  {/* Catch-all routes for storefronts */}
                  <Route path="/:subagentStoreName/store/:subSubagentStoreName" element={<SubSubagentStorefront />} />
                  <Route path="/:storeName" element={<SubagentStorefront />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              ) : isAgentSubdomain ? (
                // 🎯 On any agent subdomain, show the agent storefront
                <AgentStorefront />
              ) : (
                // 🌐 On the main datastores.shop domain, use normal routes
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
                  <Route path="/agent-registration-callback" element={<AgentRegistrationCallback />} />
                  <Route path="/subagent-registration/:agentStoreId" element={<SubagentRegistration />} />
                  <Route path="/sub-subagent-registration/:subagentStoreId" element={<SubagentRegistration />} />
                  <Route path="/subagent-approval-payment" element={<SubagentApprovalPayment />} />
                  <Route path="/verify-subagent-payment" element={<VerifySubagentPayment />} />
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
                  <Route
                    path="/user-dashboard"
                    element={
                      <AuthGuard>
                        <UserDashboard />
                      </AuthGuard>
                    }
                  />
                  <Route
                    path="/subagent-dashboard"
                    element={
                      <AuthGuard requiredRole="subagent">
                        <SubagentDashboard />
                      </AuthGuard>
                    }
                  />
                  <Route
                    path="/agent-dashboard"
                    element={
                      <AuthGuard requiredRole="subagent">
                        <SubagentDashboard />
                      </AuthGuard>
                    }
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <AuthGuard requiredRole="subagent">
                        <SubagentDashboard />
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
