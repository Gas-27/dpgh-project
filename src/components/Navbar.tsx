import { Zap, Menu, X, LayoutDashboard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAdmin, isAgent, signOut, getDashboardRoute, loading } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
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
          {loading ? (
            <Button variant="ghost" size="sm" disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading
            </Button>
          ) : user ? (
            <>
              <Button variant="hero" size="sm" asChild>
                <Link to={getDashboardRoute()}>
                  <LayoutDashboard className="h-4 w-4 mr-1" />
                  {isAdmin ? "Admin Dashboard" : isAgent ? "Agent Dashboard" : "Dashboard"}
                </Link>
              </Button>
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

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background px-6 py-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <Link to="/packages" className="block text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>Packages</Link>
          <Link to="/#services" className="block text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>Services</Link>
          <Link to="/#agent" className="block text-sm text-muted-foreground" onClick={() => setMobileOpen(false)}>Become an Agent</Link>
          <div className="flex gap-3 pt-2">
            {loading ? (
              <Button variant="ghost" size="sm" className="flex-1" disabled>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading
              </Button>
            ) : user ? (
              <>
                <Button variant="hero" size="sm" className="flex-1" asChild>
                  <Link to={getDashboardRoute()} onClick={() => setMobileOpen(false)}>
                    <LayoutDashboard className="h-4 w-4 mr-1" /> Dashboard
                  </Link>
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { void signOut(); setMobileOpen(false); }}>Sign Out</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="flex-1" asChild>
                  <Link to="/login" onClick={() => setMobileOpen(false)}>Log In</Link>
                </Button>
                <Button variant="hero" size="sm" className="flex-1" asChild>
                  <Link to="/signup" onClick={() => setMobileOpen(false)}>Sign Up</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
