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
  return <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-3 px-0 sm:gap-4">
    {sections.map(({ id, label, description, icon: Icon, tone }) => {
      const isAgent = id === "agent";
      return <button key={id} type="button" onClick={() => isAgent ? onBecomeAgent?.() : onSelect(id)} className={`group storefront-section-${tone} flex min-h-[74px] w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:brightness-110 hover:shadow-lg sm:min-h-[92px] sm:px-3.5 sm:py-3 ${active === id ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}>
        <span className="flex min-w-0 items-center gap-2.5 sm:gap-3"><span className="storefront-section-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12"><Icon className="h-6 w-6 sm:h-7 sm:w-7" /></span><span className="min-w-0"><span className="block truncate text-sm font-bold leading-tight tracking-tight sm:text-base">{label}</span><span className="mt-1 block max-w-[120px] text-[10px] leading-[1.2] text-slate-200/80 sm:max-w-[150px] sm:text-xs">{description}</span></span></span><ArrowRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-1 sm:h-5 sm:w-5" />
      </button>;
    })}
  </div>;
}

export type { SectionId };
