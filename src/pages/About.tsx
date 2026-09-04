import LegalPageLayout from "@/components/LegalPageLayout";
import { Link } from "react-router-dom";

export default function About() {
  return (
    <LegalPageLayout
      title="About DataPlug Ghana"
      description="DataPlug Ghana is the country's trusted online platform for buying MTN, Telecel, and AirtelTigo data bundles instantly at the lowest prices. Learn about our mission, team, and network."
      canonicalPath="/about"
      lastUpdated="2026-08-01"
      label="About DataPlug"
    >
      <h2>Who We Are</h2>
      <p>
        DataPlug Ghana is an online data bundle store built to make buying mobile internet in Ghana faster, cheaper, and more convenient. We serve individual customers, families, students, and a growing network of data reseller agents across the country.
      </p>
      <p>
        Our platform is available 24 hours a day, 7 days a week. Whether you need a quick 100MB bundle or a monthly 20GB plan for your household, DataPlug delivers data to any MTN, Telecel, or AirtelTigo number in Ghana within seconds of payment.
      </p>

      <h2>Our Mission</h2>
      <p>
        Our mission is to make affordable mobile internet accessible to every Ghanaian. We do this by sourcing data bundles at wholesale rates and passing the savings on to our customers — keeping prices consistently lower than buying direct from the network.
      </p>

      <h2>What We Offer</h2>
      <ul>
        <li>Data bundles for MTN Ghana, Telecel Ghana, and AirtelTigo Ghana</li>
        <li>Airtime top-up for all three major Ghanaian networks</li>
        <li>MTN AFA registration and AFA bundle purchasing</li>
        <li>A three-tier data reseller agent programme for Ghanaians who want to earn income from data reselling</li>
        <li>A developer-friendly Data Bundle API for businesses and developers who want to integrate data purchasing into their own apps</li>
      </ul>

      <h2>The DataPlug Agent Network</h2>
      <p>
        Thousands of Ghanaians have joined the DataPlug agent network to build sustainable income streams from data reselling. Our three-tier model — Agents, Sub-Agents, and Sub-Sub-Agents — means that every member of the network earns a fair margin on every sale. <Link to="/data-reseller-agent-ghana">Learn more about becoming an agent</Link>.
      </p>

      <h2>Why Ghanaians Trust DataPlug</h2>
      <ul>
        <li>Over 72,000 customers served since launch</li>
        <li>Instant delivery — data reaches the recipient number within seconds</li>
        <li>Payments processed by Paystack, Ghana&apos;s leading and most trusted payment gateway</li>
        <li>WhatsApp customer support available for every order</li>
        <li>Transparent pricing — no hidden fees or surprise charges</li>
      </ul>

      <h2>Contact Us</h2>
      <p>
        Have a question or need help with an order? Visit our <Link to="/contact">contact page</Link> or reach us on WhatsApp.
        For business enquiries including API access and bulk agent registration, email us at <a href="mailto:dataplugstore@gmail.com">dataplugstore@gmail.com</a>.
      </p>
    </LegalPageLayout>
  );
}
