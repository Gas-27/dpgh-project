import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useSeoMeta } from "@/hooks/useSeoMeta";
import { ChevronRight, Home, Calendar, Clock, ArrowRight } from "lucide-react";

interface RelatedPost {
  to: string;
  title: string;
}

interface BlogArticleLayoutProps {
  title: string;
  description: string;
  canonicalPath: string;
  category: string;
  datePublished: string;
  updatedAt?: string;
  lastVerifiedAt?: string;
  readTime: string;
  headline: string;
  coverImage?: string;
  coverAlt?: string;
  children: React.ReactNode;
  relatedPosts?: RelatedPost[];
}

export default function BlogArticleLayout({
  title,
  description,
  canonicalPath,
  category,
  datePublished,
  updatedAt,
  lastVerifiedAt,
  readTime,
  headline,
  coverImage,
  coverAlt,
  children,
  relatedPosts = [],
}: BlogArticleLayoutProps) {
  useSeoMeta({ title, description, canonicalPath, ogType: "article", ogImage: coverImage ? `https://dataplug.store${coverImage}` : undefined });

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": headline,
    "description": description,
    "datePublished": datePublished,
    ...(updatedAt ? { "dateModified": updatedAt } : {}),
    ...(coverImage ? { "image": `https://dataplug.store${coverImage}` } : {}),
    "author": { "@type": "Organization", "name": "DataPlug Ghana" },
    "publisher": { "@type": "Organization", "name": "DataPlug Ghana", "url": "https://dataplug.store" },
    "url": `https://dataplug.store${canonicalPath}`,
    "mainEntityOfPage": { "@type": "WebPage", "@id": `https://dataplug.store${canonicalPath}` },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://dataplug.store" },
      { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://dataplug.store/blog" },
      { "@type": "ListItem", "position": 3, "name": title },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
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
                  <ChevronRight className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                  <Link to="/blog" className="hover:text-primary transition-colors">Blog</Link>
                </li>
                <li role="listitem" className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                  <span className="text-foreground font-medium truncate max-w-[200px]">{title}</span>
                </li>
              </ol>
            </div>
          </nav>

          {/* Header */}
          <header className="border-b border-border py-10 md:py-14">
            <div className="container max-w-3xl mx-auto px-4">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">{category}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" aria-hidden="true" />
                  {new Date(datePublished).toLocaleDateString("en-GH", { year: "numeric", month: "long", day: "numeric" })}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {readTime}
                </span>
              </div>
              <h1 className="font-display text-2xl md:text-4xl font-bold text-foreground text-balance leading-tight">{headline}</h1>
              {coverImage && <figure className="mt-8 overflow-hidden rounded-xl border border-border bg-secondary/20"><img src={coverImage} alt={coverAlt || headline} width="1280" height="720" loading="eager" className="aspect-video w-full object-cover" /><figcaption className="px-3 py-2 text-xs text-muted-foreground">Topic image for this Ghana-focused guide.</figcaption></figure>}
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground"><span>Published {new Date(datePublished).toLocaleDateString("en-GH")}</span>{updatedAt && <span>Updated {new Date(updatedAt).toLocaleDateString("en-GH")}</span>}{lastVerifiedAt && <span>Last verified {new Date(lastVerifiedAt).toLocaleDateString("en-GH")}</span>}</div>
            </div>
          </header>

          {/* Article body */}
          <article
            className="container max-w-3xl mx-auto px-4 py-10 prose-sm sm:prose max-w-none
              prose-headings:font-display prose-headings:text-foreground
              prose-p:text-muted-foreground prose-p:leading-relaxed
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-li:text-muted-foreground prose-strong:text-foreground
              prose-table:text-sm prose-th:text-foreground prose-td:text-muted-foreground"
          >
            {children}
          </article>

          {/* Related posts */}
          {relatedPosts.length > 0 && (
            <section className="border-t border-border bg-secondary/20 py-10">
              <div className="container max-w-3xl mx-auto px-4">
                <h2 className="font-display text-lg font-bold text-foreground mb-4">Related Articles</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {relatedPosts.map(({ to, title: t }) => (
                    <Link key={to} to={to} className="flex items-center gap-2 glass rounded-lg border border-border p-3 hover:border-primary/40 transition-colors group text-sm text-foreground font-medium group-hover:text-primary">
                      <ArrowRight className="h-4 w-4 text-primary flex-shrink-0" aria-hidden="true" />
                      {t}
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* CTA */}
          <section className="border-t border-border bg-primary/5 py-10">
            <div className="container max-w-3xl mx-auto px-4 text-center space-y-4">
              <h2 className="font-display text-xl font-bold text-foreground">Ready to Buy Data Bundles in Ghana?</h2>
              <p className="text-muted-foreground text-sm">Fast, cheap data for MTN, Telecel, and AirtelTigo — delivered instantly.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/packages" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                  Browse Packages <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link to="/signup" className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary/60 transition-colors">
                  Create Free Account
                </Link>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}
