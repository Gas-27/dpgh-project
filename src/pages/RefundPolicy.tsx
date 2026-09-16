import LegalPageLayout from "@/components/LegalPageLayout";

export default function RefundPolicy() {
  return (
    <LegalPageLayout
      title="Refund Policy — DataPlug Ghana"
      description="DataPlug Ghana's refund policy for data bundle purchases. Learn when refunds are issued, how to request one, and typical resolution timelines."
      canonicalPath="/refund-policy"
      lastUpdated="2026-08-01"
      label="Refund Policy"
    >
      <h2>Overview</h2>
      <p>
        DataPlug Ghana is committed to ensuring every customer receives the data bundle they paid for. Because data bundles are delivered digitally and instantly, our refund policy is specifically designed to handle cases where delivery genuinely fails.
      </p>

      <h2>When Refunds Are Issued</h2>
      <p>A refund or re-delivery will be issued in the following situations:</p>
      <ul>
        <li><strong>Failed delivery:</strong> The data bundle was not received by the recipient number within 30 minutes of payment confirmation, and our support team cannot resolve it with a re-delivery.</li>
        <li><strong>Duplicate charge:</strong> You were charged more than once for the same order due to a payment processing error.</li>
        <li><strong>Wrong bundle delivered:</strong> You received a different bundle size or network than what you ordered, and the error was on our side.</li>
        <li><strong>System error:</strong> A confirmed platform or payment gateway error prevented your order from processing correctly.</li>
      </ul>

      <h2>When Refunds Are Not Issued</h2>
      <ul>
        <li>The correct bundle was delivered to the number you entered.</li>
        <li>You entered an incorrect phone number and the bundle was delivered to that number.</li>
        <li>You changed your mind after the bundle was delivered.</li>
        <li>The bundle expired due to non-use (this is governed by the network operator, not DataPlug).</li>
        <li>Delivery delay caused by the network operator&apos;s infrastructure, not DataPlug&apos;s system.</li>
      </ul>

      <h2>How to Request a Refund</h2>
      <ol>
        <li>Contact us via WhatsApp or email at <a href="mailto:dataplugstore@gmail.com">dataplugstore@gmail.com</a> within <strong>48 hours</strong> of the transaction.</li>
        <li>Provide your order ID or transaction reference, the recipient phone number, and a description of the issue.</li>
        <li>Our support team will investigate and respond within 24 hours.</li>
        <li>If a refund is approved, it will be credited to your DataPlug wallet or returned to your original payment method within 3–5 business days.</li>
      </ol>

      <h2>Refund Methods</h2>
      <ul>
        <li><strong>DataPlug Wallet Credit:</strong> Fastest method — available immediately upon approval for use on future purchases.</li>
        <li><strong>Mobile Money Reversal:</strong> Returned to your MoMo number within 3–5 business days.</li>
        <li><strong>Card Reversal:</strong> Returned to your card through Paystack within 5–10 business days.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        To initiate a refund request or for questions about this policy, contact us at <a href="mailto:dataplugstore@gmail.com">dataplugstore@gmail.com</a> or via WhatsApp.
      </p>
    </LegalPageLayout>
  );
}
