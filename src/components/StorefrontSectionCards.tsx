import { ArrowRight, Box, BriefcaseBusiness, Layers3, MessageCircle, UserRoundPlus, Wifi, Zap } from "lucide-react";

const sections = [
  { id: "data", label: "Data", description: "Buy data bundles instantly", icon: Wifi, tone: "cyan" },
  { id: "afa", label: "AFA Bundles", description: "Get exclusive AFA bundles", icon: Box, tone: "violet" },
  { id: "instant", label: "Instant Data", description: "Fast & reliable top-ups", icon: Zap, tone: "green" },
  { id: "services", label: "Services", description: "More services for you", icon: BriefcaseBusiness, tone: "amber" },
  { id: "bulk", label: "Bulk Orders", description: "Order in bulk & save more", icon: Layers3, tone: "pink" },
  { id: "sms", label: "SMS", description: "Send SMS instantly", icon: MessageCircle, tone: "blue" },
  { id: "products", label: "Products", description: "Explore our products", icon: Box, tone: "violet" },
  { id: "agent", label: "Become an Agent", description: "Earn with us today", icon: UserRoundPlus, tone: "teal" },
] as const;

type SectionId = (typeof sections)[number]["id"];

export default function StorefrontSectionCards({ active, onSelect, onBecomeAgent }: { active?: string; onSelect: (id: SectionId) => void; onBecomeAgent?: () => void }) {
  return <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 sm:grid-cols-2">
    {sections.map(({ id, label, description, icon: Icon, tone }) => {
      const isAgent = id === "agent";
      return <button key={id} type="button" onClick={() => isAgent ? onBecomeAgent?.() : onSelect(id)} className={`group flex min-h-32 items-center justify-between rounded-3xl border p-6 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${active === id ? "ring-2 ring-primary" : ""} storefront-section-${tone}`}>
        <span className="flex items-center gap-5"><span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/90 text-primary-foreground"><Icon className="h-10 w-10" /></span><span><span className="block text-2xl font-bold tracking-tight">{label}</span><span className="mt-1 block text-lg text-muted-foreground">{description}</span></span></span><ArrowRight className="h-8 w-8 shrink-0 text-primary transition group-hover:translate-x-1" />
      </button>;
    })}
  </div>;
}

export type { SectionId };
