import { Link } from "react-router-dom";
import { Zap } from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="about" className="border-t border-border py-12" aria-label="Site footer">
      <div className="container grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3 sm:col-span-2 lg:col-span-1">
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
            <li><Link to="/packages" className="hover:text-foreground transition-colors">Buy Data Bundles</Link></li>
            <li><Link to="/buy-data-online-ghana" className="hover:text-foreground transition-colors">Buy Data Online Ghana</Link></li>
            <li><Link to="/data-bundle-prices-ghana" className="hover:text-foreground transition-colors">Data Bundle Prices Ghana</Link></li>
            <li><Link to="/internet-bundles-ghana" className="hover:text-foreground transition-colors">Internet Bundles Ghana</Link></li>
            <li><Link to="/wholesale-data-bundles-ghana" className="hover:text-foreground transition-colors">Wholesale Data Bundles</Link></li>
            <li><Link to="/afa-bundle-ghana" className="hover:text-foreground transition-colors">MTN AFA Bundle Ghana</Link></li>
          </ul>
        </nav>

        <nav aria-label="Data bundle guides">
          <h4 className="font-display text-sm font-semibold mb-3">Data Bundle Guides</h4>
          <ul className="space-y-2 text-xs text-muted-foreground list-none">
            <li><Link to="/mtn-data-bundles" className="hover:text-foreground transition-colors">MTN Data Bundles Ghana</Link></li>
            <li><Link to="/telecel-data-bundles" className="hover:text-foreground transition-colors">Telecel Data Bundles Ghana</Link></li>
            <li><Link to="/airteltigo-data-bundles" className="hover:text-foreground transition-colors">AirtelTigo Data Bundles Ghana</Link></li>
            <li><Link to="/cheap-data-bundles-ghana" className="hover:text-foreground transition-colors">Cheap Data Bundles Ghana</Link></li>
            <li><Link to="/streaming-data-bundles-ghana" className="hover:text-foreground transition-colors">Streaming Data Bundles</Link></li>
            <li><Link to="/student-data-bundles-ghana" className="hover:text-foreground transition-colors">Student Data Bundles</Link></li>
            <li><Link to="/premium-subscription" className="hover:text-primary transition-colors font-medium text-primary/80">Premium Subscription</Link></li>
            <li><Link to="/blog" className="hover:text-foreground transition-colors">DataPlug Blog</Link></li>
          </ul>
        </nav>

        <nav aria-label="Agent programme">
          <h4 className="font-display text-sm font-semibold mb-3">Agent Programme</h4>
          <ul className="space-y-2 text-xs text-muted-foreground list-none">
            <li><Link to="/become-agent" className="hover:text-foreground transition-colors">Become an Agent</Link></li>
            <li><Link to="/become-sub-agent" className="hover:text-foreground transition-colors">Become a Sub-Agent</Link></li>
            <li><Link to="/data-reseller-agent-ghana" className="hover:text-foreground transition-colors">Data Reseller Programme</Link></li>
            <li><Link to="/data-agent-business-ghana" className="hover:text-foreground transition-colors">Data Agent Business Ghana</Link></li>
            <li><Link to="/data-api-ghana" className="hover:text-foreground transition-colors">Data Bundle API</Link></li>
          </ul>
        </nav>
      </div>

      <div className="container mt-8 pt-6 border-t border-border">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mb-4 text-xs text-muted-foreground">
          <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
          <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          <a href="https://wa.me/233000000000" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">WhatsApp</a>
          <a href="mailto:dataplugstore@gmail.com" className="hover:text-foreground transition-colors">Email</a>
          <Link to="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <Link to="/refund-policy" className="hover:text-foreground transition-colors">Refund Policy</Link>
          <Link to="/cookie-policy" className="hover:text-foreground transition-colors">Cookie Policy</Link>
        </div>
        <p className="text-center text-xs text-muted-foreground">© {currentYear} DataPlug Ghana. All rights reserved. | Buy MTN, Telecel &amp; AirtelTigo Data Bundles Online in Ghana.</p>
      </div>
    </footer>
  );
};

export default Footer;
