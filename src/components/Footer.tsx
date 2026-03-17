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
            <a href="#services" className="block hover:text-foreground transition-colors">Services</a>
            <a href="#agent" className="block hover:text-foreground transition-colors">Agent Portal</a>
            <a href="#" className="block hover:text-foreground transition-colors">Contact Us</a>
          </div>
        </div>
        <div className="space-y-3">
          <h4 className="font-display text-sm font-semibold">Contact</h4>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>WhatsApp: +233 XX XXX XXXX</p>
            <p>Email: support@datapluggh.com</p>
          </div>
        </div>
      </div>
      <div className="container mt-8 pt-6 border-t border-border text-center text-xs text-muted-foreground">
        © 2026 Data Plug GH. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
