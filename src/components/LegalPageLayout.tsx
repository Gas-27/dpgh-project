import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSeoMeta } from "@/hooks/useSeoMeta";

interface LegalPageLayoutProps {
  title: string;
  description: string;
  canonicalPath: string;
  /** Date last updated, ISO format e.g. "2026-08-01" */
  lastUpdated: string;
  /** Short label for breadcrumb, e.g. "Privacy Policy" */
  label: string;
  children: React.ReactNode;
}

export default function LegalPageLayout({
  title,
  description,
  canonicalPath,
  lastUpdated,
  label,
  children,
}: LegalPageLayoutProps) {
  useSeoMeta({ title, description, canonicalPath });

  const formatted = new Date(lastUpdated).toLocaleDateString("en-GH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main id="main-content" className="flex-1">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="border-b border-border bg-secondary/30 py-3">
          <div className="container max-w-3xl mx-auto px-4">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground" role="list">
              <li role="listitem" className="flex items-center gap-1">
                <Link to="/" className="flex items-center gap-1 hover:text-primary transition-colors" aria-label="Home">
                  <Home className="h-3 w-3" />
                  <span>Home</span>
                </Link>
              </li>
              <li role="listitem" className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
                <span className="text-foreground font-medium">{label}</span>
              </li>
            </ol>
          </div>
        </nav>

        {/* Header */}
        <header className="border-b border-border py-10">
          <div className="container max-w-3xl mx-auto px-4">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">{title}</h1>
            <p className="text-xs text-muted-foreground">Last updated: {formatted}</p>
          </div>
        </header>

        {/* Content */}
        <article
          className="container max-w-3xl mx-auto px-4 py-10
            prose-sm sm:prose max-w-none
            prose-headings:font-display prose-headings:text-foreground
            prose-p:text-muted-foreground prose-p:leading-relaxed
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-li:text-muted-foreground prose-strong:text-foreground"
        >
          {children}
        </article>

        {/* Legal nav strip */}
        <nav
          aria-label="Other legal pages"
          className="border-t border-border bg-secondary/20 py-6"
        >
          <div className="container max-w-3xl mx-auto px-4">
            <p className="text-xs text-muted-foreground mb-3">Other legal pages:</p>
            <div className="flex flex-wrap gap-3">
              {[
                { to: "/privacy-policy", label: "Privacy Policy" },
                { to: "/terms", label: "Terms of Service" },
                { to: "/refund-policy", label: "Refund Policy" },
                { to: "/cookie-policy", label: "Cookie Policy" },
                { to: "/about", label: "About DataPlug" },
                { to: "/contact", label: "Contact Us" },
              ]
                .filter((p) => p.to !== canonicalPath)
                .map(({ to, label: l }) => (
                  <Link
                    key={to}
                    to={to}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                  >
                    {l}
                  </Link>
                ))}
            </div>
          </div>
        </nav>
      </main>
      <Footer />
    </div>
  );
}
