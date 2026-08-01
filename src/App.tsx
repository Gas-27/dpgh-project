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
import ChatBot from "@/components/ChatBot";

// Wraps React.lazy so that a stale-deploy chunk failure (old bundle requesting
// chunk filenames that no longer exist -> server returns index.html with a
// text/html MIME type -> "Failed to fetch dynamically imported module") triggers
// a single automatic page reload instead of showing a blank screen. This removes
// the need for the user to manually refresh after a new deployment.
const lazyWithReload = (importer: () => Promise<{ default: React.ComponentType<any> }>) =>
  lazy(async () => {
    try {
      return await importer();
    } catch (error) {
      const key = "chunk_reload_at";
      const last = Number(sessionStorage.getItem(key) || 0);
      // Only reload once per 10s window to avoid infinite reload loops
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
        // Return a never-resolving placeholder while the reload happens
        return await new Promise<{ default: React.ComponentType<any> }>(() => {});
      }
      throw error;
    }
  });

const ResetPassword = lazyWithReload(() => import("./pages/ResetPassword"));
const AuthCallback = lazyWithReload(() => import("./pages/AuthCallback"));
const Index = lazyWithReload(() => import("./pages/Index"));
const NotFound = lazyWithReload(() => import("./pages/NotFound"));
const Login = lazyWithReload(() => import("./pages/Login"));
const AdminLogin = lazyWithReload(() => import("./pages/AdminLogin"));
const Signup = lazyWithReload(() => import("./pages/Signup"));
const Packages = lazyWithReload(() => import("./pages/Packages"));
const AgentOnboarding = lazyWithReload(() => import("./pages/AgentOnboarding"));
const PendingApproval = lazyWithReload(() => import("./pages/PendingApproval"));
const AdminDashboard = lazyWithReload(() => import("./pages/AdminDashboard"));
const AgentDashboard = lazyWithReload(() => import("./pages/AgentDashboard"));
const AgentStorefront = lazyWithReload(() => import("./pages/AgentStorefront"));
const BecomeAgent = lazyWithReload(() => import("./pages/BecomeAgent"));
const AgentRegistrationCallback = lazyWithReload(() => import("./pages/AgentRegistrationCallback"));
const SubagentDashboard = lazyWithReload(() => import("./pages/SubagentDashboard"));
const SubagentLogin = lazyWithReload(() => import("./pages/SubagentLogin"));
const SubSubagentLogin = lazyWithReload(() => import("./pages/SubSubagentLogin"));
const SubagentStorefront = lazyWithReload(() => import("./pages/SubagentStorefront"));
const SubSubagentStorefront = lazyWithReload(() => import("./pages/SubSubagentStorefront"));
const SubagentRegistration = lazyWithReload(() => import("./pages/SubagentRegistration"));
const SubagentApprovalPayment = lazyWithReload(() => import("./pages/SubagentApprovalPayment"));
const VerifySubagentPayment = lazyWithReload(() => import("./pages/VerifySubagentPayment"));
const SubSubagentDashboard = lazyWithReload(() => import("./pages/SubSubagentDashboard"));
const UserDashboard = lazyWithReload(() => import("./pages/UserDashboard"));
const SubAdminDashboard = lazyWithReload(() => import("./pages/SubAdminDashboard"));
const SubAdminLogin = lazyWithReload(() => import("./pages/SubAdminLogin"));

// SEO landing pages
const MtnDataBundles = lazyWithReload(() => import("./pages/seo/MtnDataBundles"));
const TelecelDataBundles = lazyWithReload(() => import("./pages/seo/TelecelDataBundles"));
const AirtelTigoDataBundles = lazyWithReload(() => import("./pages/seo/AirtelTigoDataBundles"));
const CheapDataBundlesGhana = lazyWithReload(() => import("./pages/seo/CheapDataBundlesGhana"));
const DataResellerAgent = lazyWithReload(() => import("./pages/seo/DataResellerAgent"));
const DataApiGhana = lazyWithReload(() => import("./pages/seo/DataApiGhana"));
const StreamingDataBundles = lazyWithReload(() => import("./pages/seo/StreamingDataBundles"));
const StudentDataBundles = lazyWithReload(() => import("./pages/seo/StudentDataBundles"));
const AirtimeTopUpGhana = lazyWithReload(() => import("./pages/seo/AirtimeTopUpGhana"));
const PremiumSubscriptionPage = lazyWithReload(() => import("./pages/seo/PremiumSubscription"));
const DataAgentBusiness = lazyWithReload(() => import("./pages/seo/DataAgentBusiness"));
const UssdDataServices = lazyWithReload(() => import("./pages/seo/UssdDataServices"));
const BeceResultsChecker = lazyWithReload(() => import("./pages/seo/BeceResultsChecker"));
const WassceResultsChecker = lazyWithReload(() => import("./pages/seo/WassceResultsChecker"));
const Blog = lazyWithReload(() => import("./pages/Blog"));
const BlogCheapestData2026 = lazyWithReload(() => import("./pages/blog/CheapestDataBundlesGhana2026"));
const BlogHowToBuyCheapData = lazyWithReload(() => import("./pages/blog/HowToBuyCheapDataBundlesGhana"));
const BlogDataResellerBusiness = lazyWithReload(() => import("./pages/blog/HowToStartDataResellerBusiness"));
const BlogStudentData = lazyWithReload(() => import("./pages/blog/BestDataBundlesStudentsGhana"));
const BlogStreamingData = lazyWithReload(() => import("./pages/blog/HowMuchDataStreamingUses"));
// SEO landing pages — Phase 3
const BuyDataOnlineGhana = lazyWithReload(() => import("./pages/seo/BuyDataOnlineGhana"));
const WholesaleDataBundlesGhana = lazyWithReload(() => import("./pages/seo/WholesaleDataBundlesGhana"));
const InternetBundlesGhana = lazyWithReload(() => import("./pages/seo/InternetBundlesGhana"));
const BecomeSubAgent = lazyWithReload(() => import("./pages/seo/BecomeSubAgent"));
const AfaBundleGhana = lazyWithReload(() => import("./pages/seo/AfaBundleGhana"));
const DataBundlePricesGhana = lazyWithReload(() => import("./pages/seo/DataBundlePricesGhana"));
// Trust & legal pages
const About = lazyWithReload(() => import("./pages/About"));
const Contact = lazyWithReload(() => import("./pages/Contact"));
const PrivacyPolicy = lazyWithReload(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazyWithReload(() => import("./pages/TermsOfService"));
const RefundPolicy = lazyWithReload(() => import("./pages/RefundPolicy"));
const CookiePolicy = lazyWithReload(() => import("./pages/CookiePolicy"));

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
                  <Route path="/auth/callback" element={<AuthCallback />} />
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
                <Routes>
                  <Route path="/become-agent" element={<BecomeAgent />} />
                  <Route path="*" element={<AgentStorefront />} />
                </Routes>
              ) : (
                // 🌐 On the main datastores.shop domain, use normal routes
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/only-admin/log.in" element={<AdminLogin />} />
                  <Route path="/packages" element={<Packages />} />
                  <Route path="/agent-onboarding" element={<AgentOnboarding />} />
                  <Route path="/pending-approval" element={<PendingApproval />} />
                  {/* Old paths – redirect to subdomain */}
                  <Route path="/agent/:storeName" element={<RedirectToAgentSubdomain />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/agent-registration-callback" element={<AgentRegistrationCallback />} />
                  <Route path="/subagent-registration/:agentStoreId" element={<SubagentRegistration />} />
                  <Route path="/sub-subagent-registration/:subagentStoreId" element={<SubagentRegistration />} />
                  <Route path="/subagent-approval-payment" element={<SubagentApprovalPayment />} />
                  <Route path="/verify-subagent-payment" element={<VerifySubagentPayment />} />
                  <Route path="/sub-admin-login" element={<SubAdminLogin />} />
                  <Route
                    path="/sub-admin"
                    element={
                      <AuthGuard requiredRole="sub_admin">
                        <SubAdminDashboard />
                      </AuthGuard>
                    }
                  />
                  <Route
                    path="/admin-only"
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
                  {/* SEO landing pages */}
                  <Route path="/mtn-data-bundles" element={<MtnDataBundles />} />
                  <Route path="/telecel-data-bundles" element={<TelecelDataBundles />} />
                  <Route path="/airteltigo-data-bundles" element={<AirtelTigoDataBundles />} />
                  <Route path="/cheap-data-bundles-ghana" element={<CheapDataBundlesGhana />} />
                  <Route path="/data-reseller-agent-ghana" element={<DataResellerAgent />} />
                  <Route path="/data-api-ghana" element={<DataApiGhana />} />
                  {/* SEO landing pages — Phase 2 */}
                  <Route path="/streaming-data-bundles-ghana" element={<StreamingDataBundles />} />
                  <Route path="/student-data-bundles-ghana" element={<StudentDataBundles />} />
                  <Route path="/airtime-top-up-ghana" element={<AirtimeTopUpGhana />} />
                  <Route path="/premium-subscription" element={<PremiumSubscriptionPage />} />
                  <Route path="/data-agent-business-ghana" element={<DataAgentBusiness />} />
                  <Route path="/ussd-data-services-ghana" element={<UssdDataServices />} />
                  <Route path="/bece-results-checker" element={<BeceResultsChecker />} />
                  <Route path="/wassce-results-checker" element={<WassceResultsChecker />} />
                  {/* Blog */}
                  <Route path="/blog" element={<Blog />} />
                  <Route path="/blog/cheapest-data-bundles-ghana-2026" element={<BlogCheapestData2026 />} />
                  <Route path="/blog/how-to-buy-cheap-data-bundles-ghana" element={<BlogHowToBuyCheapData />} />
                  <Route path="/blog/how-to-start-data-reseller-business-ghana" element={<BlogDataResellerBusiness />} />
                  <Route path="/blog/best-data-bundles-for-students-ghana" element={<BlogStudentData />} />
                  <Route path="/blog/how-much-data-does-streaming-use-ghana" element={<BlogStreamingData />} />
                  {/* SEO landing pages — Phase 3 */}
                  <Route path="/buy-data-online-ghana" element={<BuyDataOnlineGhana />} />
                  <Route path="/wholesale-data-bundles-ghana" element={<WholesaleDataBundlesGhana />} />
                  <Route path="/internet-bundles-ghana" element={<InternetBundlesGhana />} />
                  <Route path="/become-sub-agent" element={<BecomeSubAgent />} />
                  <Route path="/afa-bundle-ghana" element={<AfaBundleGhana />} />
                  <Route path="/data-bundle-prices-ghana" element={<DataBundlePricesGhana />} />
                  {/* Trust & legal pages */}
                  <Route path="/about" element={<About />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/refund-policy" element={<RefundPolicy />} />
                  <Route path="/cookie-policy" element={<CookiePolicy />} />
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
