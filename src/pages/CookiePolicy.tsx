import LegalPageLayout from "@/components/LegalPageLayout";

export default function CookiePolicy() {
  return (
    <LegalPageLayout
      title="Cookie Policy — DataPlug Ghana"
      description="DataPlug Ghana's cookie policy explains what cookies we use, why we use them, and how you can control them on the dataplug.store platform."
      canonicalPath="/cookie-policy"
      lastUpdated="2026-08-01"
      label="Cookie Policy"
    >
      <h2>What Are Cookies?</h2>
      <p>
        Cookies are small text files stored in your browser when you visit a website. They help websites remember your preferences, keep you logged in, and understand how users interact with pages.
      </p>

      <h2>Cookies We Use</h2>

      <h3>Essential Cookies</h3>
      <p>These cookies are required for the Platform to function. They cannot be disabled.</p>
      <ul>
        <li><strong>Authentication session:</strong> Keeps you logged in to your DataPlug account during a browsing session.</li>
        <li><strong>Cart / order state:</strong> Remembers your current bundle selection during checkout.</li>
      </ul>

      <h3>Analytics Cookies</h3>
      <p>These cookies help us understand how visitors use the Platform so we can improve it. They collect anonymised, aggregated data.</p>
      <ul>
        <li>Page view counts and navigation paths</li>
        <li>Device type and browser information</li>
        <li>Time spent on pages</li>
      </ul>

      <h3>Payment Provider Cookies</h3>
      <p>
        When you proceed to checkout, Paystack may set cookies for fraud prevention and payment session management. These are governed by <a href="https://paystack.com/privacy" target="_blank" rel="noopener noreferrer">Paystack&apos;s Privacy Policy</a>.
      </p>

      <h2>Third-Party Cookies</h2>
      <p>
        DataPlug does not use third-party advertising or tracking cookies. We do not share your browsing behaviour with advertisers.
      </p>

      <h2>Managing Cookies</h2>
      <p>
        You can control and delete cookies through your browser settings. Note that disabling essential cookies will prevent you from logging in to your DataPlug account and completing purchases.
      </p>
      <ul>
        <li><strong>Chrome:</strong> Settings &gt; Privacy and security &gt; Cookies and other site data</li>
        <li><strong>Firefox:</strong> Settings &gt; Privacy &amp; Security &gt; Cookies and Site Data</li>
        <li><strong>Safari:</strong> Preferences &gt; Privacy &gt; Manage Website Data</li>
      </ul>

      <h2>Changes to This Policy</h2>
      <p>
        We may update this Cookie Policy from time to time. The &quot;Last updated&quot; date at the top of this page will reflect any changes.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about our use of cookies? Contact us at <a href="mailto:dataplugstore@gmail.com">dataplugstore@gmail.com</a>.
      </p>
    </LegalPageLayout>
  );
}
