import { ArrowRight, Box, BriefcaseBusiness, Layers3, MessageCircle, UserRoundPlus, Wifi, Zap } from "lucide-react";

const sections = [
  { id: "data", label: "Data", description: "Buy data bundles instantly", icon: Wifi },
  { id: "afa", label: "AFA Registration", description: "Become an AFA member & enjoy benefits", icon: UserRoundPlus },
  { id: "instant", label: "Instant Data", description: "Fast & reliable top-ups", icon: Zap },
  { id: "services", label: "Services", description: "More services for you", icon: BriefcaseBusiness },
  { id: "bulk", label: "Bulk Orders", description: "Order in bulk & save more", icon: Layers3 },
  { id: "sms", label: "Bulk SMS", description: "Send messages in mass easily.", icon: MessageCircle },
  { id: "products", label: "Products", description: "Explore our products", icon: Box },
  { id: "agent", label: "Become an Agent", description: "Earn with us today", icon: UserRoundPlus },
] as const;

type SectionId = (typeof sections)[number]["id"];

export default function StorefrontSectionCards({ active, onSelect, onBecomeAgent, hiddenIds = [] }: { active?: string; onSelect: (id: SectionId) => void; onBecomeAgent?: () => void; hiddenIds?: SectionId[] }) {
  const visibleSections = sections.filter(({ id }) => !hiddenIds.includes(id));

  return (
    <div className="mx-auto w-full max-w-[700px] px-0">
      <div className="relative aspect-[700/618] w-full overflow-hidden rounded-[14px] bg-[#10204d] bg-cover bg-center bg-no-repeat shadow-[0_12px_30px_rgba(5,8,35,0.35)]" style={{ backgroundImage: "url(https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-tNtwT7RbsxArhGUNJXat8FqNqW9mw9.png)" }}>
        <div className="grid h-full grid-cols-2 grid-rows-4 gap-[1.4%] p-[1.1%]">
          {visibleSections.map(({ id, label, description, icon: Icon }) => {
            const isAgent = id === "agent";
            const handleClick = () => {
              if (isAgent) {
                onBecomeAgent?.();
                return;
              }
              onSelect(id);
              window.setTimeout(() => document.getElementById("storefront-section-content")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
            };

            return (
              <button
                key={id}
                type="button"
                onClick={handleClick}
                aria-label={`${label}: ${description}`}
                aria-pressed={active === id}
                className={`group relative flex min-h-0 items-center rounded-[12px] border border-transparent bg-transparent p-2 text-left transition hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active === id ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
              >
                <span className="sr-only">{label}: {description}</span>
                <span aria-hidden="true" className="absolute inset-0 rounded-[12px] bg-primary/0 transition group-hover:bg-primary/10" />
                <Icon aria-hidden="true" className="sr-only" />
                <ArrowRight aria-hidden="true" className="sr-only" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export type { SectionId };

