import { Link } from "react-router-dom";
import SeoPageLayout from "@/components/SeoPageLayout";
import { Wifi, Play, Youtube, Music2, Zap, TrendingDown } from "lucide-react";

const streamingPlans = [
  { name: "Netflix Streaming Pack", data: "5GB", validity: "7 days", price: "GHS 15", note: "Ideal for 4–6 hours of HD Netflix" },
  { name: "YouTube Data Pack", data: "3GB", validity: "7 days", price: "GHS 10", note: "Stream 10+ hours of YouTube at 480p" },
  { name: "TikTok Burst Pack", data: "2GB", validity: "3 days", price: "GHS 7", note: "Scroll and post TikTok videos non-stop" },
  { name: "Social Media Bundle", data: "10GB", validity: "30 days", price: "GHS 30", note: "WhatsApp, Facebook, Instagram and more" },
];

const usageData = [
  { platform: "Netflix HD", perHour: "3 GB", perDay: "~18 GB", icon: Play, color: "text-red-400" },
  { platform: "Netflix SD", perHour: "0.7 GB", perDay: "~5 GB", icon: Play, color: "text-red-300" },
  { platform: "YouTube 1080p", perHour: "2.5 GB", perDay: "~15 GB", icon: Youtube, color: "text-red-500" },
  { platform: "YouTube 480p", perHour: "0.3 GB", perDay: "~3.5 GB", icon: Youtube, color: "text-red-400" },
  { platform: "TikTok", perHour: "0.84 GB", perDay: "~5 GB", icon: Music2, color: "text-pink-400" },
  { platform: "WhatsApp Video", perHour: "0.25 GB", perDay: "~2 GB", icon: Wifi, color: "text-green-400" },
];

const faqs = [
  {
    question: "How much data does Netflix use per hour in Ghana?",
    answer: "Netflix uses approximately 0.7 GB per hour in standard definition (SD), 3 GB per hour in HD (720p/1080p), and up to 7 GB per hour in Ultra HD (4K). For most Ghanaian mobile connections, HD streaming is common and uses about 3 GB/hour.",
  },
  {
    question: "What is the best data bundle for Netflix in Ghana?",
    answer: "For Netflix, we recommend at least a 5 GB bundle for a week of casual viewing, or a 20 GB monthly bundle if you stream daily. DataPlug's MTN and Telecel bundles offer great value for streaming — buy them online at dataplug.store.",
  },
  {
    question: "How much data does YouTube use?",
    answer: "YouTube uses roughly 0.3 GB per hour at 480p, 1 GB per hour at 720p, and 2.5 GB per hour at 1080p. Watching at 480p is a great way to reduce data usage on mobile without sacrificing too much quality.",
  },
  {
    question: "How much data does TikTok use per hour?",
    answer: "TikTok uses approximately 840 MB (0.84 GB) per hour of scrolling and viewing. Creating and uploading videos uses more data. A 2 GB bundle will give you roughly 2.5 hours of TikTok viewing.",
  },
  {
    question: "Which network has the best data bundles for streaming in Ghana?",
    answer: "MTN Ghana generally offers the widest coverage and the most streaming-friendly bundle options. Telecel and AirtelTigo also offer competitive bundles. DataPlug provides affordable bundles from all three networks — compare and buy at /packages.",
  },
  {
    question: "Can I buy a data bundle specifically for Netflix in Ghana?",
    answer: "Yes. DataPlug offers a range of bundles suited for streaming Netflix in Ghana. Our 5 GB, 10 GB, and 20 GB packages across MTN and Telecel are popular for Netflix and YouTube streaming. Visit /packages to see live pricing.",
  },
  {
    question: "How can I save data while streaming in Ghana?",
    answer: "Switch your streaming quality to SD or 480p instead of HD. Download videos over Wi-Fi when available. Use YouTube's offline download feature. Set Netflix to download at lower quality. These tips can reduce your data consumption by up to 70%.",
  },
];

const productSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Netflix & YouTube Data Bundles Ghana",
  "description": "Affordable MTN, Telecel and AirtelTigo data bundles for Netflix, YouTube and TikTok streaming in Ghana.",
  "brand": { "@type": "Brand", "name": "DataPlug Ghana" },
  "offers": {
    "@type": "AggregateOffer",
    "priceCurrency": "GHS",
    "lowPrice": "7",
    "highPrice": "30",
    "offerCount": "20+",
    "availability": "https://schema.org/InStock",
    "seller": { "@type": "Organization", "name": "DataPlug Ghana" },
  },
};

export default function StreamingDataBundles() {
  return (
    <SeoPageLayout
      title="Netflix, YouTube & TikTok Data Bundles Ghana 2026 | DataPlug"
      canonicalPath="/streaming-data-bundles-ghana"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Data Bundles", href: "/packages" },
        { label: "Streaming Data Bundles Ghana" },
      ]}
      headline="Best Data Bundles for Netflix, YouTube & TikTok in Ghana"
      subheadline="Stop buffering. Buy affordable streaming data bundles for MTN, Telecel and AirtelTigo — delivered instantly to your number so you can binge without interruption."
      accentClass="text-primary"
      faqs={faqs}
      schemas={[productSchema]}
    >
      {/* Data usage calculator table */}
      <section aria-labelledby="usage-heading">
        <h2 id="usage-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          How Much Data Does Streaming Use in Ghana?
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-6">
          Understanding your data consumption is the first step to choosing the right bundle.
          Below is a breakdown of how much data popular streaming apps use per hour on a Ghanaian mobile connection.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Platform</th>
                <th className="text-right px-4 py-3 font-semibold text-foreground">Per Hour</th>
                <th className="text-right px-4 py-3 font-semibold text-foreground">Per Day (6 hrs)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {usageData.map((row) => (
                <tr key={row.platform} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <row.icon className={`h-4 w-4 ${row.color}`} aria-hidden="true" />
                      <span className="text-foreground font-medium">{row.platform}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{row.perHour}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{row.perDay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recommended bundles */}
      <section aria-labelledby="streaming-plans-heading">
        <h2 id="streaming-plans-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          Recommended Streaming Data Bundles in Ghana
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-6">
          DataPlug offers the most affordable data bundles across all three Ghanaian networks. These bundles are perfect for
          streaming Netflix, YouTube, TikTok, and other platforms without burning through your wallet.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {streamingPlans.map((plan) => (
            <article key={plan.name} className="glass rounded-xl border border-border p-5 space-y-2">
              <div className="flex items-start justify-between">
                <h3 className="font-display text-base font-semibold text-foreground">{plan.name}</h3>
                <span className="text-primary font-bold text-sm">{plan.price}</span>
              </div>
              <p className="text-xs text-muted-foreground">{plan.data} &bull; {plan.validity}</p>
              <p className="text-xs text-muted-foreground">{plan.note}</p>
            </article>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          * Prices are approximate and may vary. Visit <Link to="/packages" className="text-primary hover:underline">/packages</Link> for live pricing.
        </p>
      </section>

      {/* Tips section */}
      <section aria-labelledby="tips-heading">
        <h2 id="tips-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          7 Tips to Save Data While Streaming in Ghana
        </h2>
        <ol className="space-y-3 list-decimal list-inside text-muted-foreground leading-relaxed">
          <li><span className="text-foreground font-medium">Lower your streaming quality.</span> Switch from HD to SD to use up to 75% less data per hour.</li>
          <li><span className="text-foreground font-medium">Use Wi-Fi for downloads.</span> Download episodes and videos over Wi-Fi to watch later offline.</li>
          <li><span className="text-foreground font-medium">Enable data saver mode.</span> Netflix, YouTube, and TikTok all have built-in data saver settings.</li>
          <li><span className="text-foreground font-medium">Close background apps.</span> Apps running in the background silently consume data.</li>
          <li><span className="text-foreground font-medium">Check your data balance regularly.</span> Use USSD codes or your network&apos;s app to monitor usage.</li>
          <li><span className="text-foreground font-medium">Buy the right bundle size.</span> Match your bundle to your actual daily usage to avoid over-buying.</li>
          <li><span className="text-foreground font-medium">Use DataPlug for the cheapest bundles.</span> Our wholesale-sourced bundles cost significantly less than buying direct from network operators.</li>
        </ol>
      </section>

      {/* Internal links */}
      <section aria-labelledby="related-heading" className="glass rounded-xl border border-border p-6">
        <h2 id="related-heading" className="font-display text-lg font-bold text-foreground mb-4">
          Related Data Bundle Guides
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { to: "/mtn-data-bundles", label: "MTN Data Bundles Ghana" },
            { to: "/telecel-data-bundles", label: "Telecel Data Bundles Ghana" },
            { to: "/airteltigo-data-bundles", label: "AirtelTigo Data Bundles Ghana" },
            { to: "/cheap-data-bundles-ghana", label: "Cheapest Data Bundles Ghana" },
            { to: "/student-data-bundles-ghana", label: "Student Data Bundles Ghana" },
            { to: "/packages", label: "Browse All Packages" },
          ].map(({ to, label }) => (
            <Link key={to} to={to} className="flex items-center gap-2 text-sm text-primary hover:underline">
              <Zap className="h-3 w-3" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      </section>
    </SeoPageLayout>
  );
}
