import { Link, useParams } from "react-router-dom"
import { ExternalLink } from "lucide-react"
import BlogArticleLayout from "@/components/BlogArticleLayout"
import { editorialTopics } from "@/data/ghana-editorial-library"

export default function EditorialArticle() {
  const { slug } = useParams<{ slug: string }>()
  const topic = editorialTopics.find((item) => item.slug === `/blog/${slug}`)
  if (!topic || topic.status !== "published") return <BlogArticleLayout title="Article not found" description="This article is not available." canonicalPath={`/blog/${slug || ""}`} category="Editorial" datePublished="2026-08-15" readTime="1 min read" headline="Article not found"><p>This article is not published yet. Return to the <Link to="/blog">Ghana data guides</Link>.</p></BlogArticleLayout>
  const related = editorialTopics.filter((item) => item.cluster === topic.cluster && item.id !== topic.id && item.status === "published").slice(0, 4)
  return <BlogArticleLayout title={topic.metaTitle} description={topic.metaDescription} canonicalPath={topic.slug} category={topic.cluster} datePublished={topic.publicationDate || "2026-08-15"} updatedAt={topic.updatedAt || undefined} lastVerifiedAt={topic.lastVerifiedAt || undefined} readTime="8–12 min read" headline={topic.title} coverImage={topic.coverImage} coverAlt={topic.coverAlt} relatedPosts={related.map((item) => ({ to: item.slug, title: item.title }))}>
    <p className="lead">{topic.body.directAnswer}</p>
    {topic.body.sections.map((section) => <section key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</section>)}
    <section><h2>Questions Ghanaian readers ask</h2>{topic.body.faqs.map((faq) => <div key={faq.question}><h3>{faq.question}</h3><p>{faq.answer}</p></div>)}</section>
    <section><h2>Search terms covered naturally</h2><p className="text-sm text-muted-foreground">This guide covers practical questions about {topic.body.searchPhrases.slice(0, 6).join(", ")} without treating search phrases as a substitute for useful information.</p></section>
    <section><h2>Sources and freshness note</h2><p>Prices, package names, USSD codes, coverage, promotions, payment options and subscription terms can change. Verify volatile details with the official provider before paying or changing a service.</p><div className="flex flex-wrap gap-3">{topic.officialSources.map((source) => <a key={source} className="inline-flex items-center gap-1 text-primary font-medium" href={source} target="_blank" rel="noreferrer">Official source <ExternalLink className="h-3 w-3" /></a>)}</div></section>
  </BlogArticleLayout>
}
