import { Link } from "react-router-dom";
import { Zap } from "lucide-react";

const Footer = () => {
  return (
    <footer id="about" className="border-t border-border py-12">
      <div className="container grid gap-8 sm:grid-cols-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-display text-sm font-bold">DATA PLUG <span className="text-primary">GH</span></span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Ghana's trusted platform for instant, affordable data bundles across all networks.
          </p>
        </div>
        <div className="space-y-3">
          <h4 className="font-display text-sm font-semibold">Quick Links</h4>
          <div className="space-y-2 text-xs text-muted-foreground">
            <Link to="/#services" className="block hover:text-foreground transition-colors">Services</Link>
            <Link to="/#agent" className="block hover:text-foreground transition-colors">Agent Portal</Link>
            <Link to="/packages" className="block hover:text-foreground transition-colors">Buy Data</Link>
          </div>
        </div>
        <div className="space-y-3">
          <h4 className="font-display text-sm font-semibold">Contact</h4>
          <div className="space-y-2 text-xs text-muted-foreground">
            <a href="https://wa.me/233200511211" target="_blank" rel="noopener noreferrer" className="block hover:text-foreground transition-colors">WhatsApp Support</a>
            <a href="mailto:support@datapluggh.com" className="block hover:text-foreground transition-colors">support@datapluggh.com</a>
          </div>
        </div>
      </div>
      <div className="container mt-8 pt-6 border-t border-border text-center text-xs text-muted-foreground">
        © 2026 Data Plug . All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
