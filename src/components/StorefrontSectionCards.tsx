import { ArrowRight, Box, BriefcaseBusiness, Gamepad2, Layers3, MessageCircle, Package, UserRoundPlus, Wifi, Zap } from "lucide-react";

const sections = [
  { id: "data", label: "Data", description: "Buy data bundles instantly", icon: Wifi },
  { id: "gamehub", label: "GameHub", description: "Play, enjoy and win rewards", icon: Gamepad2 },
  { id: "subscription", label: "Subscription", description: "Netflix, ChatGPT, Canva & more", icon: Package },
  { id: "instant", label: "Instant Data", description: "Buy all your normal MTN, Telecel and AirtelTigo bundles and airtime directly here for yourself or others", icon: Zap },
  { id: "bulk", label: "Bulk Orders", description: "Order in bulk & save more", icon: Layers3 },
  { id: "services", label: "Services", description: "Pay your ECG, DSTV, GOtv and StarTimes bills instantly", icon: BriefcaseBusiness },
  { id: "products", label: "Products", description: "Explore our products", icon: Box },
  { id: "afa", label: "AFA Registration", description: "Become an AFA member & enjoy benefits", icon: UserRoundPlus },
  { id: "sms", label: "Bulk SMS", description: "Send messages in mass easily.", icon: MessageCircle },
  { id: "agent", label: "Become an Agent", description: "Earn with us today", icon: UserRoundPlus },
] as const;

type SectionId = (typeof sections)[number]["id"];

export default function StorefrontSectionCards({ active, onSelect, onBecomeAgent, hiddenIds = [] }: { active?: string; onSelect: (id: SectionId) => void; onBecomeAgent?: () => void; hiddenIds?: SectionId[] }) {
  const visibleSections = sections.filter(({ id }) => !hiddenIds.includes(id));

  return (
    <div className="mx-auto w-full max-w-[700px] px-0">
      <div className="relative aspect-[347/303] w-full overflow-hidden rounded-[14px] bg-background shadow-[0_12px_30px_rgba(5,8,35,0.35)]" style={{ backgroundImage: "url(https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-tNtwT7RbsxArhGUNJXat8FqNqW9mw9.png)" }}>
        <div className="relative grid h-full grid-cols-2 grid-rows-5 gap-2 bg-background/15 p-2 sm:gap-2.5 sm:p-2.5">
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
                className={`group relative min-h-0 overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br p-2.5 text-left text-foreground shadow-md transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:p-3 ${id === "instant" ? "from-emerald-400/95 via-teal-500/90 to-cyan-700/95" : id === "services" ? "from-amber-400/95 via-orange-500/90 to-yellow-700/95" : id === "subscription" ? "from-pink-400/95 via-fuchsia-600/90 to-purple-800/95" : "from-primary/90 via-primary/70 to-accent/80"} ${active === id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
              >
                <span aria-hidden="true" className="absolute inset-0 bg-background/10 transition group-hover:bg-background/0" />
                <span className="relative flex min-w-0 items-center gap-2.5 sm:gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background/20 text-primary-foreground shadow-inner backdrop-blur-sm sm:size-12">
                    <Icon aria-hidden="true" className="size-5 sm:size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold leading-tight text-primary-foreground sm:text-base">{label}</span>
                    <span className="mt-1 block line-clamp-3 text-[10px] font-medium leading-[1.25] text-primary-foreground/90 sm:text-xs">{description}</span>
                  </span>
                  <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-primary-foreground/85 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export type { SectionId };

