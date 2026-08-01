import { Zap, Menu, X, LayoutDashboard, Loader2, Home, Search, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import PushNotificationSubscribe from "@/components/PushNotificationSubscribe";
import SiteSearchModal from "@/components/SiteSearchModal";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { user, isAdmin, isAgent, signOut, getDashboardRoute, loading } = useAuth();
  const navigate = useNavigate();

  // Get the correct dashboard route (with fallback)
  const dashboardRoute = getDashboardRoute() || "/user-dashboard";

  // Helper to get the button label based on role
  const getDashboardLabel = () => {
    if (isAgent) return "Agent Dashboard";
    return "My Dashboard";
  };

  // Handle dashboard click – navigate programmatically (optional, Link already works)
  const handleDashboardClick = () => {
    navigate(dashboardRoute);
  };

  return (
    <>
    <nav className="fixed top-0 left-0 right-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          <span className="font-display text-lg font-bold text-foreground">
            DATA PLUG <span className="text-primary">.STORE</span>
          </span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <Link to="/packages" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Packages</Link>
          <Link to="/#services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Services</Link>
          <Link to="/#agent" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Become an Agent</Link>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            aria-label="Search DataPlug"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Search</span>
            <kbd className="ml-1 hidden xl:inline-block rounded border border-border px-1 py-0.5 font-mono text-[10px] text-muted-foreground/60">/</kbd>
          </button>
          <PushNotificationSubscribe variant="icon" />
          {loading ? (
            <Button variant="ghost" size="sm" disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading
            </Button>
          ) : user ? (
            <>
              {!isAdmin && (
                <Button variant="hero" size="sm" asChild>
                  <Link to={dashboardRoute}>
                    <LayoutDashboard className="h-4 w-4 mr-1" />
                    {getDashboardLabel()}
                  </Link>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={signOut}>Sign Out</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Log In</Link>
              </Button>
              <Button variant="hero" size="sm" asChild>
                <Link to="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </div>

        <button type="button" className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
    </nav>

    {/* Mobile Menu Overlay - Outside Nav */}
    {mobileOpen && (
      <div className="md:hidden fixed inset-0 top-0 z-30 bg-slate-950 bg-opacity-98 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
        <div className="pt-20 px-6 py-8 space-y-8 pb-20">
          {/* Search */}
          <button
            type="button"
            onClick={() => { setMobileOpen(false); setSearchOpen(true); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary/40 border border-border text-slate-300 hover:text-white hover:border-primary/40 transition-all"
            aria-label="Search DataPlug"
          >
            <Search className="h-5 w-5" />
            <span className="font-medium">Search DataPlug</span>
          </button>

          {/* MENU Section */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 tracking-wider mb-4">MENU</h3>
            <div className="space-y-2">
              <Link 
                to="/" 
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-500 bg-opacity-20 border border-blue-400 border-opacity-30 text-white hover:bg-opacity-30 transition-all"
              >
                <Home className="h-5 w-5" />
                <span className="font-medium">Home</span>
              </Link>
              <Link 
                to="/packages" 
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
              >
                <Search className="h-5 w-5" />
                <span className="font-medium">Packages</span>
              </Link>
            </div>
          </div>

          {/* ACCOUNT Section */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 tracking-wider mb-4">ACCOUNT</h3>
            <div className="space-y-2">
              {loading ? (
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="font-medium">Loading</span>
                </div>
              ) : user ? (
                <>
                  <Link 
                    to={dashboardRoute}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
                  >
                    <LayoutDashboard className="h-5 w-5" />
                    <span className="font-medium">{getDashboardLabel()}</span>
                  </Link>
                  <button 
                    onClick={() => { void signOut(); setMobileOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:text-white hover:bg-red-500 hover:bg-opacity-20 transition-all"
                  >
                    <LogIn className="h-5 w-5" />
                    <span className="font-medium">Sign Out</span>
                  </button>
                </>
              ) : (
                <>
                  <Link 
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
                  >
                    <LogIn className="h-5 w-5" />
                    <span className="font-medium">Login</span>
                  </Link>
                  <Link 
                    to="/signup"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
                  >
                    <UserPlus className="h-5 w-5" />
                    <span className="font-medium">Sign Up</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
      <SiteSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
};

export default Navbar;
