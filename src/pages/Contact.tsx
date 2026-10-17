import LegalPageLayout from "@/components/LegalPageLayout";
import { MessageCircle, Mail, Clock } from "lucide-react";

const channels = [
  {
    icon: MessageCircle,
    title: "WhatsApp Support",
    desc: "The fastest way to get help. Message us on WhatsApp and a real person will respond.",
    action: { label: "Chat on WhatsApp", href: "https://wa.me/233000000000" },
  },
  {
    icon: Mail,
    title: "Email Support",
    desc: "For order enquiries, refund requests, agent registration, and business partnerships.",
    action: { label: "dataplugstore@gmail.com", href: "mailto:dataplugstore@gmail.com" },
  },
  {
    icon: Clock,
    title: "Support Hours",
    desc: "Our platform is available 24/7. Human support agents are available Monday–Saturday, 7am–10pm Ghana time (GMT).",
    action: null,
  },
];

export default function Contact() {
  return (
    <LegalPageLayout
      title="Contact DataPlug Ghana — WhatsApp & Email Support"
      description="Contact DataPlug Ghana for help with data bundle orders, refunds, agent registration, or business enquiries. WhatsApp and email support available."
      canonicalPath="/contact"
      lastUpdated="2026-08-01"
      label="Contact Us"
    >
      <h2>Contact DataPlug Ghana</h2>
      <p>
        Whether you have a question about an order, want to become an agent, or need technical help, our support team is ready to assist. Choose the contact method that works best for you below.
      </p>

      <div className="not-prose grid gap-4 sm:grid-cols-3 my-8">
        {channels.map(({ icon: Icon, title, desc, action }) => (
          <div key={title} className="glass rounded-xl border border-border p-5 space-y-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <h3 className="font-display font-bold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
            {action && (
              <a
                href={action.href}
                target={action.href.startsWith("http") ? "_blank" : undefined}
                rel={action.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                {action.label}
              </a>
            )}
          </div>
        ))}
      </div>

      <h2>What to Include in Your Message</h2>
      <p>To help us resolve your issue quickly, please include the following when you contact us:</p>
      <ul>
        <li>Your registered email address or phone number</li>
        <li>The order ID or transaction reference (found in your dashboard or payment receipt)</li>
        <li>The recipient number the bundle was sent to</li>
        <li>A brief description of the issue</li>
      </ul>

      <h2>Agent Registration Enquiries</h2>
      <p>
        If you want to join the DataPlug agent network to earn income from data reselling, email us at <a href="mailto:dataplugstore@gmail.com">dataplugstore@gmail.com</a> with the subject line "Agent Registration" or message us on WhatsApp. We will walk you through the process within 24 hours.
      </p>

      <h2>API & Business Enquiries</h2>
      <p>
        For bulk purchasing agreements, Data Bundle API access, or white-label solutions, email us at <a href="mailto:dataplugstore@gmail.com">dataplugstore@gmail.com</a> with the subject line "Business Enquiry".
      </p>
    </LegalPageLayout>
  );
}
