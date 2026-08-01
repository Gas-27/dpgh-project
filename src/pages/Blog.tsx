import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowRight, BookOpen, Calendar } from "lucide-react";

const posts = [
  {
    slug: "/blog/cheapest-data-bundles-ghana-2026",
    title: "Cheapest Data Bundles in Ghana 2026 — Full Comparison",
    excerpt: "We compare every MTN, Telecel, and AirtelTigo data bundle available in Ghana to find the absolute cheapest options for every budget and usage type.",
    date: "2026-07-01",
    category: "Data Bundles",
    readTime: "8 min read",
  },
  {
    slug: "/blog/how-to-buy-cheap-data-bundles-ghana",
    title: "How to Buy Cheap Data Bundles in Ghana — Step-by-Step",
    excerpt: "A complete guide to buying affordable data bundles online in Ghana — which platforms offer the best prices, how to pay safely, and tips to save even more.",
    date: "2026-07-08",
    category: "Guides",
    readTime: "6 min read",
  },
  {
    slug: "/blog/how-to-start-data-reseller-business-ghana",
    title: "How to Start a Data Reseller Business in Ghana in 2026",
    excerpt: "Everything you need to know to launch a profitable data bundle reseller business in Ghana — from choosing a platform to building your customer base.",
    date: "2026-07-15",
    category: "Business",
    readTime: "10 min read",
  },
  {
    slug: "/blog/best-data-bundles-for-students-ghana",
    title: "Best Data Bundles for Students in Ghana 2026",
    excerpt: "University and SHS students share tight budgets and heavy data needs. We rank the best and most affordable student data bundles across all networks in Ghana.",
    date: "2026-07-20",
    category: "Students",
    readTime: "7 min read",
  },
  {
    slug: "/blog/how-much-data-does-netflix-youtube-tiktok-use",
    title: "How Much Data Does Netflix, YouTube & TikTok Use in Ghana?",
    excerpt: "Streaming apps are the biggest data consumers in Ghana. We break down exactly how much data Netflix, YouTube, TikTok, and other apps use — and the best bundles for each.",
    date: "2026-07-25",
    category: "Streaming",
    readTime: "5 min read",
  },
];

export default function Blog() {
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "DataPlug Ghana — Data & Digital Services Blog",
    "description": "Guides, tips, and comparisons on data bundles, digital services, agent businesses, and more for Ghana.",
    "url": "https://dataplug.store/blog",
    "publisher": { "@type": "Organization", "name": "DataPlug Ghana", "url": "https://dataplug.store" },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main id="main-content" className="flex-1">
          {/* Hero */}
          <header className="border-b border-border py-12 md:py-16">
            <div className="container max-w-4xl mx-auto px-4 text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-4">
                <BookOpen className="h-3 w-3" aria-hidden="true" />
                DataPlug Knowledge Center
              </div>
              <h1 className="font-display text-3xl md:text-5xl font-bold text-balance text-foreground mb-4">
                Data Bundle Guides & Tips for Ghana
              </h1>
              <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto leading-relaxed">
                Honest comparisons, practical guides, and money-saving tips about data bundles, airtime,
                digital businesses, and internet in Ghana.
              </p>
            </div>
          </header>

          {/* Articles */}
          <section className="container max-w-4xl mx-auto px-4 py-12" aria-label="Blog articles">
            <div className="grid gap-6">
              {posts.map((post) => (
                <article key={post.slug} className="glass rounded-xl border border-border overflow-hidden hover:border-primary/40 transition-colors group">
                  <Link to={post.slug} className="block p-6 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {post.category}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" aria-hidden="true" />
                        {new Date(post.date).toLocaleDateString("en-GH", { year: "numeric", month: "long", day: "numeric" })}
                      </span>
                      <span className="text-xs text-muted-foreground">{post.readTime}</span>
                    </div>
                    <h2 className="font-display text-lg md:text-xl font-bold text-foreground group-hover:text-primary transition-colors text-balance">
                      {post.title}
                    </h2>
                    <p className="text-muted-foreground text-sm leading-relaxed">{post.excerpt}</p>
                    <div className="flex items-center gap-1 text-sm font-medium text-primary">
                      Read article <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="border-t border-border bg-primary/5 py-10">
            <div className="container max-w-4xl mx-auto px-4 text-center space-y-4">
              <h2 className="font-display text-xl font-bold text-foreground">Ready to Buy Data Bundles in Ghana?</h2>
              <p className="text-muted-foreground text-sm">Join 72,000+ Ghanaians who trust DataPlug for fast, cheap data bundles.</p>
              <Link to="/packages" className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                Browse Packages <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}
