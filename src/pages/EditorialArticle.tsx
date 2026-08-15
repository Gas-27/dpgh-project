import { Link, useParams } from "react-router-dom"
import { Calendar, Clock, ExternalLink } from "lucide-react"
import BlogArticleLayout from "@/components/BlogArticleLayout"
import { editorialTopics } from "@/data/ghana-editorial-library"

export default function EditorialArticle() {
  const { slug } = useParams<{ slug: string }>()
  const topic = editorialTopics.find((item) => item.slug === `/blog/${slug}`)

  if (!topic || topic.status !== "published") {
    return <BlogArticleLayout title="Article not found" description="This article is not available." canonicalPath={`/blog/${slug || ""}`} category="Editorial" datePublished="2026-08-15" readTime="1 min read" headline="Article not found"><p>This article is not published yet. Return to the <Link to="/blog">Ghana data guides</Link>.</p></BlogArticleLayout>
  }

  const related = editorialTopics.filter((item) => item.cluster === topic.cluster && item.id !== topic.id && item.status === "published").slice(0, 4)
  return <BlogArticleLayout title={topic.metaTitle} description={topic.metaDescription} canonicalPath={topic.slug} category={topic.cluster} datePublished={topic.publicationDate || "2026-08-15"} updatedAt={topic.updatedAt || undefined} lastVerifiedAt={topic.lastVerifiedAt || undefined} readTime="Practical guide" headline={topic.title} coverImage={topic.coverImage} coverAlt={topic.coverAlt} relatedPosts={related.map((item) => ({ to: item.slug, title: item.title }))}>
    <p className="lead">This Ghana-focused guide answers a specific question about {topic.title.toLowerCase()} without guessing current prices, codes, network coverage, or service terms.</p>
    <h2>Quick answer</h2>
    <p>The right answer depends on your network, location, device settings, usage pattern, and the current terms published by the relevant provider. Use this page as a practical checklist, then confirm time-sensitive details from the official source before you buy or change a service.</p>
    <h2>What to check in Ghana</h2>
    <ul><li>Confirm the service name and current offer inside the operator&apos;s official channel.</li><li>Check validity, renewal, restrictions, and whether the offer applies to your number.</li><li>Compare your expected usage with the bundle size instead of choosing by headline price alone.</li><li>Keep your mobile money PIN and payment confirmation private.</li></ul>
    <h2>A practical way to decide</h2>
    <p>Start with the activity you actually need: messaging, browsing, video, meetings, study, work, or gaming. Track your phone&apos;s data usage for a normal week in Ghana, then choose a plan with enough validity for your routine. If the result changes by location or time of day, test before committing to a longer plan.</p>
    <h2>Information that can change</h2>
    <p>Prices, package names, USSD codes, coverage, promotions, payment options, and subscription terms can change. This article does not present unverified figures as facts. Check the provider or service&apos;s official website and support channel for the current position.</p>
    <h2>Sources and verification</h2>
    <p className="text-sm text-muted-foreground">Editorial status: published with a source-review workflow. Last verified: {topic.lastVerifiedAt || "Source review required before volatile claims are added"}.</p>
    <div className="flex flex-wrap gap-3"><Link className="text-primary font-medium" to="/packages">Browse available packages</Link><Link className="text-primary font-medium" to="/blog">Read more Ghana guides</Link>{topic.officialSources.map((source) => <a key={source} className="inline-flex items-center gap-1 text-primary font-medium" href={source} target="_blank" rel="noreferrer">Official source <ExternalLink className="h-3 w-3" /></a>)}</div>
  </BlogArticleLayout>
}
