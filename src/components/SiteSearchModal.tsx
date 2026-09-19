import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, ArrowRight, FileText, ShoppingBag, Users, BookOpen, Info } from "lucide-react";

interface SearchEntry {
  title: string;
  description: string;
  path: string;
  category: "bundle" | "guide" | "agent" | "blog" | "info";
  keywords: string[];
}

const ALL_PAGES: SearchEntry[] = [
  // Bundles
  { title: "Buy Data Bundles", description: "All MTN, Telecel, and AirtelTigo data packages", path: "/packages", category: "bundle", keywords: ["buy data", "packages", "bundles", "internet"] },
  { title: "MTN Data Bundles", description: "MTN Ghana data bundle plans and prices", path: "/mtn-data-bundles", category: "bundle", keywords: ["mtn", "mtn data", "mtn bundle", "mtn internet"] },
  { title: "Telecel Data Bundles", description: "Telecel Ghana data bundle plans and prices", path: "/telecel-data-bundles", category: "bundle", keywords: ["telecel", "vodafone", "telecel data", "telecel bundle"] },
  { title: "AirtelTigo Data Bundles", description: "AirtelTigo Ghana data bundle plans and prices", path: "/airteltigo-data-bundles", category: "bundle", keywords: ["airteltigo", "airtel", "tigo", "airteltigo data"] },
  { title: "Cheap Data Bundles Ghana", description: "The cheapest data bundle deals in Ghana", path: "/cheap-data-bundles-ghana", category: "bundle", keywords: ["cheap data", "affordable", "cheap bundles", "lowest price"] },
  { title: "Internet Bundles Ghana", description: "Compare internet bundles across all networks", path: "/internet-bundles-ghana", category: "bundle", keywords: ["internet", "internet bundle", "mobile internet", "wifi"] },
  { title: "Buy Data Online Ghana", description: "How to buy data bundles online in Ghana", path: "/buy-data-online-ghana", category: "bundle", keywords: ["buy data online", "online data", "purchase data"] },
  { title: "Data Bundle Prices Ghana", description: "Current data bundle prices for all networks", path: "/data-bundle-prices-ghana", category: "bundle", keywords: ["price", "pricing", "cost", "how much", "ghs"] },
  { title: "Wholesale Data Bundles", description: "Bulk data at reseller prices", path: "/wholesale-data-bundles-ghana", category: "bundle", keywords: ["wholesale", "bulk", "reseller price", "agent price"] },
  { title: "Streaming Data Bundles", description: "Best data for Netflix, YouTube, TikTok", path: "/streaming-data-bundles-ghana", category: "bundle", keywords: ["netflix", "youtube", "tiktok", "streaming", "video"] },
  { title: "Student Data Bundles", description: "Affordable data plans for students", path: "/student-data-bundles-ghana", category: "bundle", keywords: ["student", "school", "university", "campus"] },
  { title: "Airtime Top-Up Ghana", description: "Top up airtime for any network", path: "/airtime-top-up-ghana", category: "bundle", keywords: ["airtime", "credit", "top up", "recharge"] },
  { title: "MTN AFA Bundle Ghana", description: "MTN AFA registration and special bundle rates", path: "/afa-bundle-ghana", category: "bundle", keywords: ["afa", "mtn afa", "affordable", "afa bundle"] },
  { title: "Premium Subscription", description: "Ghana's cheapest subscription data plan", path: "/premium-subscription", category: "bundle", keywords: ["subscription", "premium", "monthly", "plan"] },
  // Agent
  { title: "Become an Agent", description: "Join the DataPlug reseller network", path: "/become-agent", category: "agent", keywords: ["agent", "reseller", "earn money", "join"] },
  { title: "Data Reseller Agent Ghana", description: "Full guide to the agent programme", path: "/data-reseller-agent-ghana", category: "agent", keywords: ["reseller", "agent programme", "data business"] },
  { title: "Become a Sub-Agent", description: "Join under an existing agent", path: "/become-sub-agent", category: "agent", keywords: ["sub-agent", "subagent", "join agent"] },
  { title: "Data Agent Business Ghana", description: "3-tier agent business model explained", path: "/data-agent-business-ghana", category: "agent", keywords: ["business", "agent tier", "income", "commission"] },
  { title: "Data Reseller API", description: "API for developers to buy data programmatically", path: "/data-api-ghana", category: "agent", keywords: ["api", "developer", "integrate", "automate"] },
  // Blog
  { title: "DataPlug Blog", description: "Tips, guides, and news about data bundles in Ghana", path: "/blog", category: "blog", keywords: ["blog", "articles", "tips", "guides"] },
  { title: "Cheapest Data Bundles Ghana 2026", description: "Which network has the cheapest data in 2026?", path: "/blog/cheapest-data-bundles-ghana-2026", category: "blog", keywords: ["cheapest 2026", "best deal 2026"] },
  { title: "How to Buy Cheap Data Bundles", description: "Step-by-step guide to saving on data", path: "/blog/how-to-buy-cheap-data-bundles-ghana", category: "blog", keywords: ["how to buy", "save data", "tutorial"] },
  { title: "How to Start a Data Reseller Business", description: "Beginner guide to data reselling in Ghana", path: "/blog/how-to-start-data-reseller-business-ghana", category: "blog", keywords: ["start business", "reseller business", "side hustle"] },
  { title: "Best Data for Students Ghana", description: "Top data plans for students in 2026", path: "/blog/best-data-bundles-for-students-ghana", category: "blog", keywords: ["student data", "school data", "best for students"] },
  // Info
  { title: "About DataPlug", description: "Who we are, our mission, and our network", path: "/about", category: "info", keywords: ["about", "who are you", "company", "mission"] },
  { title: "Contact Us", description: "WhatsApp and email support", path: "/contact", category: "info", keywords: ["contact", "support", "help", "whatsapp"] },
  { title: "Privacy Policy", description: "How we collect and protect your data", path: "/privacy-policy", category: "info", keywords: ["privacy", "data protection", "gdpr"] },
  { title: "Terms of Service", description: "Platform usage terms and conditions", path: "/terms", category: "info", keywords: ["terms", "conditions", "legal"] },
  { title: "Refund Policy", description: "When and how refunds are issued", path: "/refund-policy", category: "info", keywords: ["refund", "return", "money back"] },
];

const CATEGORY_ICON = {
  bundle: ShoppingBag,
  guide: FileText,
  agent: Users,
  blog: BookOpen,
  info: Info,
};

const CATEGORY_LABEL = {
  bundle: "Data Bundles",
  guide: "Guides",
  agent: "Agent Programme",
  blog: "Blog",
  info: "Info",
};

function score(entry: SearchEntry, q: string): number {
  const lower = q.toLowerCase().trim();
  if (!lower) return 0;
  const titleLower = entry.title.toLowerCase();
  const descLower = entry.description.toLowerCase();
  if (titleLower === lower) return 100;
  if (titleLower.startsWith(lower)) return 80;
  if (titleLower.includes(lower)) return 60;
  if (descLower.includes(lower)) return 40;
  if (entry.keywords.some((k) => k.includes(lower))) return 30;
  return 0;
}

interface SiteSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SiteSearchModal({ isOpen, onClose }: SiteSearchModalProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const results = query.trim().length > 0
    ? ALL_PAGES.map((p) => ({ ...p, _score: score(p, query) }))
        .filter((p) => p._score > 0)
        .sort((a, b) => b._score - a._score)
        .slice(0, 8)
    : ALL_PAGES.filter((p) => p.category === "bundle").slice(0, 6);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
    }
  }, [isOpen]);

  // Keyboard trap
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && results[activeIndex]) {
        navigate(results[activeIndex].path);
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, activeIndex, results, navigate, onClose]);

  const handleSelect = useCallback((path: string) => {
    navigate(path);
    onClose();
  }, [navigate, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Site search"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl glass rounded-2xl border border-border shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            placeholder="Search data bundles, guides, blog..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            aria-label="Search DataPlug"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2" role="listbox" aria-label="Search results">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground text-center">No results for &quot;{query}&quot;</p>
          ) : (
            results.map((entry, i) => {
              const Icon = CATEGORY_ICON[entry.category];
              return (
                <button
                  key={entry.path}
                  role="option"
                  aria-selected={i === activeIndex}
                  onClick={() => handleSelect(entry.path)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === activeIndex ? "bg-primary/10" : "hover:bg-secondary/40"
                  }`}
                >
                  <div className="flex-shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md bg-secondary/60">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{entry.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{entry.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="hidden sm:block text-xs text-muted-foreground/60">{CATEGORY_LABEL[entry.category]}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-4 py-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span><kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">↑↓</kbd> navigate</span>
          <span><kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">Enter</kbd> open</span>
          <span><kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px]">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
