import { Zap, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          <span className="font-display text-lg font-bold text-foreground">
            DATA PLUG <span className="text-primary">GH</span>
          </span>
        </div>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          <a href="#services" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Services</a>
          <a href="#agent" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Become an Agent</a>
          <a href="#about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About</a>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" size="sm">Log In</Button>
          <Button variant="hero" size="sm">Sign Up</Button>
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background px-6 py-4 space-y-4">
          <a href="#services" className="block text-sm text-muted-foreground">Services</a>
          <a href="#agent" className="block text-sm text-muted-foreground">Become an Agent</a>
          <a href="#about" className="block text-sm text-muted-foreground">About</a>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" size="sm" className="flex-1">Log In</Button>
            <Button variant="hero" size="sm" className="flex-1">Sign Up</Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
