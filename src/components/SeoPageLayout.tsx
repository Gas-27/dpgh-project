import { Link } from "react-router-dom";
import { ChevronRight, Home, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

interface SeoPageLayoutProps {
  /** Page <title> value — used for JSON-LD WebPage name */
  title: string;
  /** Canonical slug, e.g. "/mtn-data-bundles" */
  canonicalPath: string;
  /** Breadcrumb trail: [Home, Category, This page] */
  breadcrumbs: BreadcrumbItem[];
  /** Hero headline */
  headline: string;
  /** Hero sub-headline */
  subheadline: string;
  /** JSON-LD: network colour accent class e.g. "text-yellow-400" */
  accentClass?: string;
  /** FAQ items for the FAQ section + JSON-LD FAQPage schema */
  faqs: FaqItem[];
  /** Optional JSON-LD structured data objects to inject as <script> tags */
  schemas?: object[];
  /** Page body content rendered between the hero and the FAQ section */
  children: React.ReactNode;
}

/** Builds a JSON-LD FAQPage schema from the faqs array */
function buildFaqSchema(faqs: FaqItem[], canonicalPath: string) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer,
      },
    })),
    "url": `https://dataplug.store${canonicalPath}`,
  };
}

/** Builds a JSON-LD BreadcrumbList schema */
function buildBreadcrumbSchema(breadcrumbs: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": crumb.label,
      ...(crumb.href
        ? { "item": `https://dataplug.store${crumb.href}` }
        : {}),
    })),
  };
}

export default function SeoPageLayout({
  title,
  canonicalPath,
  breadcrumbs,
  headline,
  subheadline,
  accentClass = "text-primary",
  faqs,
  schemas = [],
  children,
}: SeoPageLayoutProps) {
  const allSchemas = [
    buildBreadcrumbSchema(breadcrumbs),
    buildFaqSchema(faqs, canonicalPath),
    ...schemas,
  ];

  return (
    <>
      {/* Structured data */}
      {allSchemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      <div className="min-h-screen flex flex-col">
        <Navbar />

        <main id="main-content" className="flex-1">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="border-b border-border bg-secondary/30 py-3"
          >
            <div className="container max-w-5xl mx-auto px-4">
              <ol
                className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
                role="list"
              >
                <li role="listitem" className="flex items-center gap-1">
                  <Link
                    to="/"
                    className="flex items-center gap-1 hover:text-primary transition-colors"
                    aria-label="Home"
                  >
                    <Home className="h-3 w-3" />
                    <span>Home</span>
                  </Link>
                </li>
                {breadcrumbs.slice(1).map((crumb, index) => (
                  <li key={index} role="listitem" className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                    {crumb.href ? (
                      <Link
                        to={crumb.href}
                        className="hover:text-primary transition-colors"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-foreground font-medium">{crumb.label}</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          {/* Hero */}
          <header className="py-12 md:py-16 border-b border-border">
            <div className="container max-w-5xl mx-auto px-4 text-center">
              <h1
                className={`font-display text-3xl md:text-5xl font-bold text-balance mb-4 ${accentClass}`}
              >
                {headline}
              </h1>
              <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto text-pretty leading-relaxed">
                {subheadline}
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="hero" size="lg" asChild>
                  <Link to="/packages">
                    Buy Data Bundles Now
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link to="/signup">Create Free Account</Link>
                </Button>
              </div>
            </div>
          </header>

          {/* Page body — rendered by each individual page */}
          <div className="container max-w-5xl mx-auto px-4 py-12 space-y-16">
            {children}
          </div>

          {/* FAQ Section */}
          {faqs.length > 0 && (
            <section
              aria-labelledby="faq-heading"
              className="border-t border-border bg-secondary/20 py-12"
            >
              <div className="container max-w-5xl mx-auto px-4">
                <h2
                  id="faq-heading"
                  className="font-display text-2xl md:text-3xl font-bold text-center mb-8 text-foreground"
                >
                  Frequently Asked Questions
                </h2>
                <Accordion type="single" collapsible className="space-y-2">
                  {faqs.map((faq, index) => (
                    <AccordionItem
                      key={index}
                      value={`faq-${index}`}
                      className="glass rounded-xl border-border px-4"
                    >
                      <AccordionTrigger className="text-left font-medium text-foreground hover:text-primary hover:no-underline py-4">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </section>
          )}

          {/* Bottom CTA Strip */}
          <section
            aria-labelledby="cta-strip-heading"
            className="border-t border-border bg-primary/5 py-12"
          >
            <div className="container max-w-5xl mx-auto px-4 text-center">
              <h2
                id="cta-strip-heading"
                className="font-display text-2xl md:text-3xl font-bold text-foreground mb-3"
              >
                Ready to Buy Data Bundles in Ghana?
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto mb-6">
                Join thousands of Ghanaians who trust DataPlug for fast, affordable
                MTN, Telecel, and AirtelTigo data bundles delivered instantly.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="hero" size="lg" asChild>
                  <Link to="/packages">
                    Browse Data Packages
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link to="/become-agent">Become a DataPlug Agent</Link>
                </Button>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
}
