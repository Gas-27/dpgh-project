import SeoPageLayout from "@/components/SeoPageLayout";
import { Link } from "react-router-dom";

const pricingRows = [
  { size: "100MB", mtn: "GHS 0.50", telecel: "GHS 0.60", airteltigo: "GHS 0.55", validity: "1 day" },
  { size: "500MB", mtn: "GHS 2.00", telecel: "GHS 2.20", airteltigo: "GHS 2.10", validity: "1–3 days" },
  { size: "1GB", mtn: "GHS 3.50", telecel: "GHS 3.80", airteltigo: "GHS 3.60", validity: "1–7 days" },
  { size: "2GB", mtn: "GHS 6.00", telecel: "GHS 6.50", airteltigo: "GHS 6.20", validity: "7 days" },
  { size: "5GB", mtn: "GHS 13.00", telecel: "GHS 14.00", airteltigo: "GHS 13.50", validity: "7–30 days" },
  { size: "10GB", mtn: "GHS 23.00", telecel: "GHS 25.00", airteltigo: "GHS 24.00", validity: "30 days" },
  { size: "20GB", mtn: "GHS 42.00", telecel: "GHS 45.00", airteltigo: "GHS 43.00", validity: "30 days" },
];

const faqs = [
  {
    question: "How much do data bundles cost in Ghana in 2026?",
    answer: "Data bundle prices in Ghana range from about GHS 0.50 for 100MB daily bundles to GHS 42+ for 20GB monthly plans. MTN, Telecel, and AirtelTigo each have slightly different pricing. DataPlug typically offers below-retail prices especially for agent accounts.",
  },
  {
    question: "Which network has the cheapest data bundles in Ghana?",
    answer: "MTN Ghana generally offers the most competitive pricing across all bundle sizes in 2026, though Telecel occasionally runs promotional offers. DataPlug agents get below-retail prices on all three networks.",
  },
  {
    question: "How do DataPlug prices compare to buying direct from the network?",
    answer: "DataPlug retail prices are comparable to network-direct prices. Agent-registered users get wholesale rates that are typically 15–30% below standard retail, making DataPlug the cheapest way to buy data bundles in Ghana.",
  },
  {
    question: "Do data bundle prices change frequently in Ghana?",
    answer: "Network pricing changes periodically. DataPlug updates its prices in real time to reflect the latest network rates. The live prices on the packages page are always current.",
  },
  {
    question: "Why do agent prices cost less on DataPlug?",
    answer: "DataPlug operates a wholesale purchasing model with Ghana's network operators. Agents benefit from bulk-rate pricing that is passed on in full, unlike buying direct at retail rates.",
  },
];

export default function DataBundlePricesGhana() {
  return (
    <SeoPageLayout
      title="Data Bundle Prices in Ghana 2026 — MTN, Telecel & AirtelTigo"
      description="Compare current data bundle prices in Ghana for MTN, Telecel, and AirtelTigo. See all bundle sizes, validities, and prices in GHS. Buy at the cheapest rates on DataPlug."
      canonicalPath="/data-bundle-prices-ghana"
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Data Bundle Prices Ghana" },
      ]}
      headline="Data Bundle Prices in Ghana 2026 — Full Network Comparison"
      subheadline="Compare MTN, Telecel, and AirtelTigo data bundle prices in Ghana for 2026. From 100MB daily bundles to 20GB monthly plans — see all prices in GHS and buy at the lowest rate on DataPlug."
      faqs={faqs}
    >
      {/* Price table */}
      <section aria-labelledby="price-table-heading">
        <h2 id="price-table-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          Ghana Data Bundle Price Comparison 2026
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Prices shown are approximate standard retail rates in GHS. DataPlug agent prices are up to 30% lower.
          See live prices on the <Link to="/packages" className="text-primary hover:underline">packages page</Link>.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm" aria-label="Data bundle price comparison table">
            <thead className="bg-secondary/40">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-foreground">Bundle Size</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-yellow-400">MTN</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-red-400">Telecel</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-orange-400">AirtelTigo</th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-foreground">Validity</th>
              </tr>
            </thead>
            <tbody>
              {pricingRows.map(({ size, mtn, telecel, airteltigo, validity }, i) => (
                <tr key={size} className={i % 2 === 0 ? "bg-background" : "bg-secondary/20"}>
                  <td className="px-4 py-3 font-medium text-foreground">{size}</td>
                  <td className="px-4 py-3 text-muted-foreground">{mtn}</td>
                  <td className="px-4 py-3 text-muted-foreground">{telecel}</td>
                  <td className="px-4 py-3 text-muted-foreground">{airteltigo}</td>
                  <td className="px-4 py-3 text-muted-foreground">{validity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          * Prices are indicative and may vary. For exact current prices, visit the{" "}
          <Link to="/packages" className="text-primary hover:underline">live packages page</Link>.
        </p>
      </section>

      {/* Network comparison links */}
      <section aria-labelledby="compare-links-heading">
        <h2 id="compare-links-heading" className="font-display text-2xl font-bold text-foreground mb-4">
          Detailed Bundle Guides by Network
        </h2>
        <nav aria-label="Network bundle price guides" className="grid gap-3 sm:grid-cols-3">
          {[
            { to: "/mtn-data-bundles", label: "MTN Bundle Prices", color: "border-yellow-400/30 hover:border-yellow-400/60" },
            { to: "/telecel-data-bundles", label: "Telecel Bundle Prices", color: "border-red-400/30 hover:border-red-400/60" },
            { to: "/airteltigo-data-bundles", label: "AirtelTigo Bundle Prices", color: "border-orange-400/30 hover:border-orange-400/60" },
          ].map(({ to, label, color }) => (
            <Link key={to} to={to} className={`glass rounded-xl border p-4 text-sm font-semibold text-foreground text-center transition-colors ${color}`}>
              {label}
            </Link>
          ))}
        </nav>
      </section>
    </SeoPageLayout>
  );
}
