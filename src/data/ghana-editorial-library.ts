export type EditorialCluster =
  | "MTN Data"
  | "Telecel Data"
  | "AT / AirtelTigo"
  | "General Data Bundles"
  | "Data Usage"
  | "Internet & Telecom Education"
  | "Digital Subscriptions"
  | "Comparisons"

export type EditorialStatus = "planned" | "review" | "published"
export type EditorialIntent = "informational" | "commercial" | "comparison"

export interface EditorialTopic {
  id: string
  title: string
  primaryKeyword: string
  secondaryKeywords: string[]
  searchIntent: string
  cluster: EditorialCluster
  searcherProblem: string
  uniqueAngle: string
  slug: string
  parentPage: string
  relatedArticleIds: string[]
  recommendedInternalLinks: string[]
  contentType: EditorialIntent
  priority: "high" | "medium" | "low"
  suggestedUpdateFrequency: string
  sourceRequirements: string[]
  officialSources: string[]
  lastVerifiedAt: string | null
  metaTitle: string
  metaDescription: string
  coverImage: string
  coverAlt: string
  coverPrompt: string
  publicationDate: string | null
  updatedAt: string | null
  status: EditorialStatus
}

const coverByCluster: Record<EditorialCluster, { image: string; alt: string; prompt: string }> = {
  "MTN Data": { image: "/images/blog-mtn-data.png", alt: "Ghanaian smartphone user checking mobile data", prompt: "Ghana MTN mobile data editorial cover" },
  "Telecel Data": { image: "/images/blog-telecel-data.png", alt: "Ghanaian commuter using mobile internet", prompt: "Ghana Telecel mobile internet editorial cover" },
  "AT / AirtelTigo": { image: "/images/blog-at-history.png", alt: "Mobile phone technology changing in Ghana", prompt: "Ghana AT AirtelTigo telecom history editorial cover" },
  "General Data Bundles": { image: "/images/blog-general-data.png", alt: "Phone and mobile data planning tools in Ghana", prompt: "Ghana data bundle planning editorial cover" },
  "Data Usage": { image: "/images/blog-data-usage.png", alt: "Mobile data usage viewed on a smartphone", prompt: "Ghana mobile data usage editorial cover" },
  "Internet & Telecom Education": { image: "/images/blog-telecom-education.png", alt: "Mobile tower and smartphone connectivity in Ghana", prompt: "Ghana internet education editorial cover" },
  "Digital Subscriptions": { image: "/images/blog-subscriptions.png", alt: "Digital subscription services used on a Ghanaian smartphone", prompt: "Ghana digital subscriptions editorial cover" },
  Comparisons: { image: "/images/blog-comparisons.png", alt: "Comparing mobile network connectivity in Ghana", prompt: "Ghana network comparison editorial cover" },
}

const topicSets: Array<{ cluster: EditorialCluster; titles: string[] }> = [
  { cluster: "MTN Data", titles: [
    "MTN Data Bundles in Ghana: How to Compare Current Options", "How to Check MTN Data Balance in Ghana", "How to Buy an MTN Data Bundle Safely", "MTN Daily Data Bundles: When a Short Validity Plan Makes Sense", "MTN Weekly Data Bundles for Ghanaian Users", "MTN Monthly Data Bundles: Choosing by Usage Pattern", "How MTN Data Expiry Affects Unused Data", "What to Check When MTN Data Is Not Working", "MTN Internet Settings on Android in Ghana", "MTN Internet Settings on iPhone in Ghana", "How to Monitor MTN Data Usage on Android", "How to Monitor MTN Data Usage on iPhone", "Using MTN Hotspot Without Losing Data Quickly", "MTN Data Sharing: Questions to Verify Before You Transfer", "MTN Data for Ghanaian Students: A Planning Guide", "MTN Data for Remote Work in Ghana", "MTN Data for YouTube: Match Quality to Your Bundle", "MTN Data for TikTok and Short-Video Use", "MTN Data for WhatsApp Calls and Media", "MTN Data for Netflix: What Changes Consumption", "MTN Data for Mobile Gaming in Ghana", "How Background Apps Consume MTN Data", "MTN Data-Saving Settings That Are Safe to Test", "MTN Bundle Terms: How to Read the Official Offer", "How to Verify an MTN Data Promotion Before Paying", "MTN Data Roaming Questions for Ghanaians", "MTN Network Speed Tests: What the Result Means", "MTN Data and Mobile Money: Safer Purchase Practices", "MTN Large Data Bundles: Who Actually Needs Them", "MTN Data Troubleshooting Checklist for Ghana" ] },
  { cluster: "Telecel Data", titles: [
    "Telecel Data Bundles in Ghana: How to Compare Current Options", "How to Check Telecel Data Balance in Ghana", "How to Buy a Telecel Data Bundle Safely", "Telecel Daily Data Bundles: Questions to Ask First", "Telecel Weekly Data Bundles for Ghanaian Users", "Telecel Monthly Data Bundles: Choosing by Usage Pattern", "How Telecel Data Expiry Works", "What to Check When Telecel Data Is Not Working", "Telecel Internet Settings on Android in Ghana", "Telecel Internet Settings on iPhone in Ghana", "How to Monitor Telecel Data Usage", "Using Telecel Hotspot Without Wasting Data", "Telecel Data Sharing: What to Confirm in the Current Terms", "Telecel Data for Students and Campus Life", "Telecel Data for Remote Work and Video Meetings", "Telecel Data for YouTube and Video Quality", "Telecel Data for Social Media Users", "Telecel Data for WhatsApp Calls and Media", "Telecel Data for Streaming Services", "Telecel Data for Mobile Gaming", "Why Telecel Data May Feel Slow", "Telecel Network Troubleshooting Before Contacting Support", "How to Verify a Telecel Promotion", "Telecel Data Roaming Questions", "Telecel Data-Saving Settings to Review" ] },
  { cluster: "AT / AirtelTigo", titles: [
    "AT Data Services in Ghana: What Users Should Verify Today", "AirtelTigo Data Bundles: Understanding Historical References", "How to Check Whether an AirtelTigo Guide Is Outdated", "AT Mobile Internet Settings: Use Official Instructions", "AT Data Balance Questions and Verification Steps", "What AT Users Should Check When Data Stops Working", "AT Data Expiry and Bundle Terms", "AT Data for Students in Ghana", "AT Data for Social Media Usage", "AT Data for Streaming: Quality and Consumption", "AT Hotspot Usage: Practical Data Controls", "AirtelTigo to AT: A Ghana Telecom Brand Timeline", "How Network Rebranding Can Affect Search Results", "How to Find Current AT Customer Support Information", "AT Data Promotions: How to Avoid Outdated Claims", "AT Mobile Money and Data Purchase Safety", "AT Data Roaming: What to Verify Before Travel", "AT Internet Speed Testing in Ghana", "AT Data-Saving Settings for Android", "AT Data-Saving Settings for iPhone" ] },
  { cluster: "General Data Bundles", titles: [
    "Best Data Bundles in Ghana: A Criteria-Based Guide", "Cheapest Data Bundles in Ghana: How to Compare Without Guessing", "How to Choose a Data Bundle in Ghana", "How Much Mobile Data Do You Need Each Month?", "Best Data Planning Approach for Students in Ghana", "Choosing Data for Ghanaian Workers and Small Businesses", "Data Bundles for Streaming: A Practical Selection Method", "Data Bundles for Mobile Gaming in Ghana", "Data Bundles for Social Media Users", "Data Bundles for YouTube Viewing", "Data Bundles for TikTok Viewing", "Data Bundles for WhatsApp Users", "Data Bundles for Netflix Viewing", "Daily vs Weekly vs Monthly Data Bundles", "How to Save Mobile Data on Android", "How to Save Mobile Data on iPhone", "Why Mobile Data Finishes Quickly", "How to Reduce Mobile Data Consumption", "How to Budget for Mobile Data in Ghana", "How to Buy Data for Another Ghanaian Number", "Mobile Data Purchase Safety Checklist", "How to Read Data Bundle Expiry Terms", "What to Do When a Data Purchase Is Delayed", "How to Compare Data by Validity Instead of Headline Size", "Data Bundle Questions for Dual-SIM Phones", "How to Plan Data for a Ghanaian Household", "Mobile Data for Online Classes in Ghana", "Mobile Data for Job Searching and Applications", "Mobile Data for Small Online Sellers", "Mobile Data for WhatsApp Business", "How to Choose a Backup Data Network", "Data Bundle and Wi-Fi Budgeting Together", "How to Track Data Spending with Mobile Money", "What Makes a Data Bundle Good Value?", "How to Verify a Data Bundle Before Checkout" ] },
  { cluster: "Data Usage", titles: [
    "How Much Data Does YouTube Use?", "How Much Data Does Netflix Use?", "How Much Data Does TikTok Use?", "How Much Data Does Instagram Use?", "How Much Data Does Facebook Use?", "How Much Data Does WhatsApp Use?", "How Much Data Does Spotify Use?", "How Much Data Does Zoom Use?", "How Much Data Does Google Meet Use?", "How Much Data Does Snapchat Use?", "How Much Data Does Online Gaming Use?", "How Much Data Does Video Calling Use?", "How Much Data Does Music Streaming Use?", "How Much Data Does HD Video Use?", "How Much Data Does 4K Video Use?", "How Long Does 1GB Last for Ghanaian Users?", "How Long Does 5GB Last for Streaming and Work?", "How Long Does 10GB Last for a Household?", "Why Video Quality Changes Data Consumption", "How Autoplay Increases Mobile Data Use", "How App Updates Use Mobile Data", "How Cloud Backups Use Mobile Data", "How Maps and Location Services Use Data", "How Video Calls Affect a Student Data Budget", "How to Measure Your Own App Data Usage" ] },
  { cluster: "Internet & Telecom Education", titles: [
    "What Is a Data Bundle?", "What Is Mobile Internet?", "What Is 4G?", "What Is 5G?", "4G vs 5G in Ghana: What Users Should Compare", "What Affects Mobile Internet Speed?", "Why Is Mobile Data Slow?", "Why Does Mobile Internet Disconnect?", "Why Does Data Finish Quickly?", "What Is a Mobile Hotspot?", "What Is Tethering?", "How Does Roaming Work?", "What Is an APN?", "How to Configure Mobile Internet", "How to Test Internet Speed in Ghana", "Download Speed vs Upload Speed", "Mbps vs MB/s Explained", "GB vs MB Explained", "How Much Is 1GB of Data?", "How Long Does 1GB Last?", "How Long Does 5GB Last?", "How Long Does 10GB Last?", "What Is Network Congestion?", "Latency vs Speed for Ghanaian Gamers", "Why Signal Bars Do Not Equal Internet Speed" ] },
  { cluster: "Digital Subscriptions", titles: [
    "Netflix in Ghana: Subscription Decisions to Review", "Spotify in Ghana: Plans, Payments, and Data Use", "YouTube Premium in Ghana: What to Verify Before Subscribing", "Showmax in Ghana: How to Compare a Streaming Plan", "Google One in Ghana: Cloud Storage Use Cases", "iCloud+ in Ghana: Storage and Payment Considerations", "Microsoft 365 in Ghana: Who Needs a Subscription?", "Canva Subscriptions for Ghanaian Creators", "Cloud Storage Subscriptions in Ghana", "Streaming Subscriptions in Ghana: A Comparison Framework", "How Digital Subscriptions Work", "How to Pay for Digital Subscriptions from Ghana", "How to Cancel a Digital Subscription", "How to Find and Manage Recurring Payments", "Subscription Renewal Safety Checklist", "How Streaming Subscriptions Affect Data Budgets", "How to Choose Between Monthly and Annual Billing", "What to Check When a Subscription Payment Fails", "Digital Subscription Sharing: Read the Official Terms", "How to Avoid Fraudulent Subscription Offers", "How to Verify an Official Subscription Website", "Subscription Refund Questions for Ghanaian Users", "Digital Services and Mobile Money Payment Safety", "Managing Subscriptions Across Android and iPhone", "A Ghanaian Household Guide to Digital Subscription Costs" ] },
  { cluster: "Comparisons", titles: [
    "MTN vs Telecel for Internet: Which Criteria Matter?", "MTN vs AT for Data: How to Compare Carefully", "Telecel vs AT for Data: A Verification-First Guide", "Best Network for Students in Ghana: Compare Your Locations", "Best Network for Streaming: Test Before You Commit", "Best Network for Gaming: Latency Matters", "Best Network for Heavy Data Users", "Daily vs Weekly vs Monthly Bundles Compared", "4G vs 5G in Ghana", "Mobile Data vs Wi-Fi in Ghana", "Prepaid vs Subscription Internet Options", "MTN vs Telecel Hotspot Use", "Network Coverage vs Network Speed", "Bundle Size vs Bundle Validity", "Price per GB: Why It Is Not the Only Metric", "How to Run Your Own Network Comparison Test" ] },
]

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
}

function buildTopic(cluster: EditorialCluster, title: string, index: number): EditorialTopic {
  const id = `${cluster.toLowerCase().replace(/[^a-z]+/g, "-")}-${index + 1}`
  const slug = slugify(title)
  const cover = coverByCluster[cluster]
  const timeSensitive = /mtn|telecel|at |airtel|price|bundle|subscription|roaming|promotion|4g|5g/i.test(title)
  const intent: EditorialIntent = /compare|vs |best network|cheapest|choose|options/i.test(title) ? "comparison" : /buy|subscription|pricing|bundle/i.test(title) ? "commercial" : "informational"
  return {
    id, title, primaryKeyword: `${title.toLowerCase()} ghana`, secondaryKeywords: [cluster.toLowerCase(), "Ghana mobile internet", "DataPlug Ghana"], searchIntent: `Answer the specific question: ${title}`, cluster,
    searcherProblem: `A Ghanaian reader needs a clear, current answer about ${title.toLowerCase()}.`, uniqueAngle: `Ghana-specific guidance with verification notes, practical steps, and no invented package claims.`, slug: `/blog/${slug}`, parentPage: `/blog/${slugify(cluster)}`,
    relatedArticleIds: [], recommendedInternalLinks: ["/packages", "/blog", `/blog/${slugify(cluster)}`], contentType: intent, priority: index < 8 ? "high" : index < 18 ? "medium" : "low", suggestedUpdateFrequency: timeSensitive ? "30-90 days or when official terms change" : "6-12 months",
    sourceRequirements: timeSensitive ? ["Official operator or service pricing/terms page", "NCA Ghana where relevant"] : ["Official technical documentation where relevant"], officialSources: [], lastVerifiedAt: null,
    metaTitle: `${title} | DataPlug Ghana`, metaDescription: `${title}. Ghana-focused guidance, practical checks, official-source notes, and current-information disclaimers.`,     coverImage: cover.image, coverAlt: cover.alt, coverPrompt: cover.prompt, publicationDate: index < 5 ? "2026-08-15" : null, updatedAt: index < 5 ? "2026-08-15" : null, status: index < 5 ? "published" : "planned",
  }
}

export const editorialTopics: EditorialTopic[] = topicSets.flatMap(({ cluster, titles }) => titles.map((title, index) => buildTopic(cluster, title, index)))

export const publishedEditorialTopics = editorialTopics.filter((topic) => topic.status === "published")
export const highPriorityTopics = editorialTopics.filter((topic) => topic.priority === "high")

export const editorialAudit = {
  generatedAt: "2026-08-15",
  totalTopics: editorialTopics.length,
  duplicateIntentReview: "Applied distinct titles and intent statements; run editorial review before publication.",
  volatileDataPolicy: "Prices, codes, coverage, promotions, policies, and availability require official-source verification before publishing.",
  coverPolicy: "Every article record has a topic-specific cover image path and descriptive alt text. Published pages must not omit a cover.",
}
