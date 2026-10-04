import LegalPageLayout from "@/components/LegalPageLayout";

export default function TermsOfService() {
  return (
    <LegalPageLayout
      title="Terms of Service — DataPlug Ghana"
      description="Read the DataPlug Ghana terms of service. These terms govern your use of the DataPlug platform for purchasing data bundles and joining the agent reseller programme."
      canonicalPath="/terms"
      lastUpdated="2026-08-01"
      label="Terms of Service"
    >
      <h2>1. Acceptance of Terms</h2>
      <p>
        By accessing or using dataplug.store (&quot;the Platform&quot;), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Platform.
      </p>

      <h2>2. Platform Description</h2>
      <p>
        DataPlug Ghana provides an online service for purchasing data bundles and airtime for MTN Ghana, Telecel Ghana, and AirtelTigo Ghana. We also operate a data reseller agent programme. The Platform is available to users in Ghana aged 18 and over.
      </p>

      <h2>3. Account Registration</h2>
      <ul>
        <li>You must provide accurate information when creating an account.</li>
        <li>You are responsible for maintaining the security of your account credentials.</li>
        <li>You must notify us immediately of any unauthorised access to your account.</li>
        <li>One account per person. Creating multiple accounts to abuse promotional rates is prohibited.</li>
      </ul>

      <h2>4. Purchases and Payments</h2>
      <ul>
        <li>All purchases are final once data has been delivered to the recipient number.</li>
        <li>Prices are shown in Ghana Cedis (GHS) and are inclusive of any applicable fees.</li>
        <li>Payments are processed by Paystack. DataPlug does not store card or Mobile Money credentials.</li>
        <li>You are responsible for ensuring the recipient phone number is correct before completing a purchase.</li>
      </ul>

      <h2>5. Refund Policy</h2>
      <p>
        Please refer to our <a href="/refund-policy">Refund Policy</a> for full details. In general, refunds are offered where data delivery has verifiably failed and the issue cannot be resolved by re-delivery.
      </p>

      <h2>6. Agent Programme</h2>
      <ul>
        <li>Agents must comply with all DataPlug policies and Ghanaian law when reselling data bundles.</li>
        <li>Agents are independent resellers and are not employees or representatives of DataPlug Ghana.</li>
        <li>DataPlug reserves the right to suspend or terminate agent accounts for fraudulent activity, abuse, or violation of these terms.</li>
        <li>Agent wallet balances are non-transferable and non-refundable except in cases of platform error.</li>
      </ul>

      <h2>7. Prohibited Activities</h2>
      <p>You may not use the Platform to:</p>
      <ul>
        <li>Engage in fraud, money laundering, or any unlawful activity.</li>
        <li>Attempt to exploit pricing errors or system vulnerabilities.</li>
        <li>Automate purchases without authorisation (the Data Bundle API is available for legitimate automated use).</li>
        <li>Resell data bundles in a manner that misrepresents DataPlug or our pricing.</li>
      </ul>

      <h2>8. Limitation of Liability</h2>
      <p>
        DataPlug Ghana is not liable for delivery delays caused by network operator outages, incorrect phone numbers provided by the purchaser, or force majeure events. Our liability is limited to the value of the transaction in dispute.
      </p>

      <h2>9. Changes to Terms</h2>
      <p>
        We may update these terms periodically. Continued use of the Platform after updates constitutes acceptance of the revised terms.
      </p>

      <h2>10. Governing Law</h2>
      <p>
        These Terms are governed by the laws of the Republic of Ghana. Any disputes shall be subject to the jurisdiction of the courts of Ghana.
      </p>

      <h2>11. Contact</h2>
      <p>
        For questions about these Terms, contact us at <a href="mailto:dataplugstore@gmail.com">dataplugstore@gmail.com</a>.
      </p>
    </LegalPageLayout>
  );
}
