import LegalPageLayout from "@/components/LegalPageLayout";

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout
      title="Privacy Policy — DataPlug Ghana"
      description="Read DataPlug Ghana's privacy policy to understand how we collect, use, and protect your personal data when you use our data bundle purchasing platform."
      canonicalPath="/privacy-policy"
      lastUpdated="2026-08-01"
      label="Privacy Policy"
    >
      <h2>1. Introduction</h2>
      <p>
        DataPlug Ghana (&quot;DataPlug&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the website dataplug.store. This Privacy Policy explains how we collect, use, store, and protect your personal information when you use our platform to purchase data bundles or join our agent programme.
      </p>
      <p>
        By using DataPlug, you agree to the collection and use of information in accordance with this policy.
      </p>

      <h2>2. Information We Collect</h2>
      <p>We collect the following types of information:</p>
      <ul>
        <li><strong>Account information:</strong> Name, email address, and phone number when you create an account.</li>
        <li><strong>Transaction data:</strong> Phone numbers you send bundles to, bundle types purchased, payment amounts, and transaction dates.</li>
        <li><strong>Payment information:</strong> Payments are processed by Paystack. DataPlug does not store your card numbers or Mobile Money PINs.</li>
        <li><strong>Usage data:</strong> Pages visited, features used, and device/browser information collected automatically for platform improvement.</li>
      </ul>

      <h2>3. How We Use Your Information</h2>
      <ul>
        <li>To process your data bundle orders and deliver purchases to the specified phone number.</li>
        <li>To manage your account, wallet, and order history.</li>
        <li>To send order confirmation and support messages via email or WhatsApp.</li>
        <li>To detect and prevent fraud, unauthorised access, and other misuse.</li>
        <li>To improve our platform and user experience based on aggregated usage data.</li>
      </ul>

      <h2>4. Data Sharing</h2>
      <p>We do not sell your personal data. We share data only with:</p>
      <ul>
        <li><strong>Paystack:</strong> For secure payment processing.</li>
        <li><strong>Network operators (MTN, Telecel, AirtelTigo):</strong> To deliver purchased data bundles to recipient numbers.</li>
        <li><strong>Service providers:</strong> Hosting and infrastructure providers operating under data processing agreements.</li>
        <li><strong>Legal authorities:</strong> When required by Ghanaian law or court order.</li>
      </ul>

      <h2>5. Data Retention</h2>
      <p>
        We retain your account information and transaction history for as long as your account is active or as required to comply with our legal obligations. You may request deletion of your account and associated data by contacting us at dataplugstore@gmail.com.
      </p>

      <h2>6. Security</h2>
      <p>
        We use industry-standard security practices including HTTPS encryption, secure database storage, and role-based access controls to protect your data. Payment transactions are processed exclusively through Paystack&apos;s PCI-DSS compliant infrastructure.
      </p>

      <h2>7. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Access the personal information we hold about you</li>
        <li>Correct inaccurate information in your account</li>
        <li>Request deletion of your account and personal data</li>
        <li>Opt out of marketing communications</li>
      </ul>
      <p>To exercise these rights, contact us at <a href="mailto:dataplugstore@gmail.com">dataplugstore@gmail.com</a>.</p>

      <h2>8. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify registered users of material changes via email. Continued use of DataPlug after changes are posted constitutes acceptance of the updated policy.
      </p>

      <h2>9. Contact</h2>
      <p>
        For privacy-related questions, contact us at <a href="mailto:dataplugstore@gmail.com">dataplugstore@gmail.com</a>.
      </p>
    </LegalPageLayout>
  );
}
