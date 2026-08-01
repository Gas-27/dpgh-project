import { Link } from "react-router-dom";
import { Zap } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="about" className="border-t border-border py-12" aria-label="Site footer">
      <div className="container grid gap-8 sm:grid-cols-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" aria-hidden="true" />
            <span className="font-display text-sm font-bold">
              DataPlug <span className="text-primary">Ghana</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Ghana&apos;s trusted platform for instant, affordable MTN, Telecel and AirtelTigo data bundles. Buy data online 24/7.
          </p>
        </div>

        <nav aria-label="Quick links">
          <h4 className="font-display text-sm font-semibold mb-3">Quick Links</h4>
          <ul className="space-y-2 text-xs text-muted-foreground list-none">
            <li><Link to="/#services" className="hover:text-foreground transition-colors">Buy Data Bundles</Link></li>
            <li><Link to="/packages" className="hover:text-foreground transition-colors">Data Bundle Packages</Link></li>
            <li><Link to="/#agent" className="hover:text-foreground transition-colors">Become a Data Reseller</Link></li>
            <li><Link to="/signup" className="hover:text-foreground transition-colors">Agent Registration</Link></li>
          </ul>
        </nav>

        <div className="space-y-3">
          <h4 className="font-display text-sm font-semibold">Contact &amp; Support</h4>
          <ul className="space-y-2 text-xs text-muted-foreground list-none">
            <li>
              <a
                href="https://wa.me/233000000000"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
                aria-label="Contact DataPlug on WhatsApp"
              >
                WhatsApp Support
              </a>
            </li>
            <li>
              <a
                href="mailto:dataplugstore@gmail.com"
                className="hover:text-foreground transition-colors"
                aria-label="Email DataPlug support"
              >
                dataplugstore@gmail.com
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="container mt-8 pt-6 border-t border-border text-center text-xs text-muted-foreground">
        <p>© {currentYear} DataPlug Ghana. All rights reserved. | Buy MTN, Telecel &amp; AirtelTigo Data Bundles Online in Ghana.</p>
      </div>
    </footer>
  );
};

export default Footer;
