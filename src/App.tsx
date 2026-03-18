import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthGuard from "@/components/AuthGuard";
import { AuthProvider } from "@/hooks/useAuth";

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

const queryClient = new QueryClient();

const RouteLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-pulse text-primary font-display text-xl">Loading...</div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/packages" element={<Packages />} />
              <Route path="/agent-onboarding" element={<AgentOnboarding />} />
              <Route path="/pending-approval" element={<PendingApproval />} />
              <Route path="/store/:storeName" element={<AgentStorefront />} />
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
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
