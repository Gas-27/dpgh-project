import { Link, useLocation } from "react-router-dom";
import { isJustBuyHost, shouldNoIndex } from "@/config/seoRoutes";
import { GUIDES } from "@/data/seo/guides.mjs";

const SERVICE_LINKS = [
  { to: "/packages", label: "Cheap data bundles in Ghana" },
  { to: "/subscription", label: "Netflix, ChatGPT & Canva Pro in Ghana" },
  { to: "/services", label: "Buy ECG electricity, DStv & GOtv online" },
  { to: "/social-boost", label: "TikTok & Instagram growth services" },
  { to: "/bulk-sms", label: "Bulk SMS Ghana" },
  { to: "/afa-bundles", label: "AFA registration & bundles" },
  { to: "/products", label: "Marketplace Ghana" },
  { to: "/become-agent", label: "Become a data agent" },
  { to: "/gamehub", label: "GameHub: play & win data" },
];

export default function SeoFooter() {
  const { pathname, search } = useLocation();
  if (!isJustBuyHost() || shouldNoIndex(pathname, search)) return null;

  return (
    <footer className="border-t border-border bg-background px-4 py-10 text-foreground">
      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
        <nav aria-label="Services">
          <h2 className="mb-3 text-base font-semibold">JustBuy GH services</h2>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {SERVICE_LINKS.map((link) => (
              <li key={link.to}><Link to={link.to} className="hover:text-foreground hover:underline">{link.label}</Link></li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Guides">
          <h2 className="mb-3 text-base font-semibold">
            <Link to="/guides" className="hover:underline">Guides</Link>
          </h2>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {GUIDES.map((guide: any) => (
              <li key={guide.slug}><Link to={`/guides/${guide.slug}`} className="hover:text-foreground hover:underline">{guide.h1}</Link></li>
            ))}
          </ul>
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-5xl text-xs text-muted-foreground">
        JustBuy GH - cheap data, airtime, subscriptions and bill payments in Ghana. Dial *365*778# to buy data without internet.
      </p>
    </footer>
  );
}
