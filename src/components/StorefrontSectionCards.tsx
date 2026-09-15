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
    <div className="relative left-1/2 w-screen -translate-x-1/2 sm:static sm:mx-auto sm:w-full sm:translate-x-0">
      <div className="storefront-tabs-shell mx-auto w-full max-w-[720px] rounded-[22px] p-3 shadow-[0_18px_45px_rgba(6,3,28,0.42)] sm:p-4">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          {visibleSections.map(({ id, label, description, icon: Icon }, index) => {
            const isAgent = id === "agent";
            const palettes = [
              "from-[#123f7b] via-[#14549b] to-[#18366a]", "from-[#43117e] via-[#a900cf] to-[#2b116f]",
              "from-[#8f164f] via-[#df2c83] to-[#7f164d]", "from-[#126b61] via-[#4ab98d] to-[#12675f]",
              "from-[#8e183d] via-[#dd193e] to-[#71152f]", "from-[#93601a] via-[#cf8c24] to-[#735016]",
              "from-[#7952ab] via-[#b98bea] to-[#7750a9]", "from-[#31127a] via-[#6f2acd] to-[#301375]",
              "from-[#73127e] via-[#cf00c7] to-[#8e0aa9]", "from-[#10516d] via-[#2d8d9d] to-[#174a70]",
            ];
            const handleClick = () => {
              if (isAgent) {
                onBecomeAgent?.();
                return;
              }
              onSelect(id);
              window.setTimeout(() => document.getElementById("storefront-section-content")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
            };

            return (
              <button key={id} type="button" onClick={handleClick} aria-label={`${label}: ${description}`} aria-pressed={active === id} className={`storefront-section-card group relative min-h-[104px] overflow-hidden rounded-[18px] border border-white/25 bg-gradient-to-br ${palettes[index % palettes.length]} p-3 text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_7px_16px_rgba(0,0,0,0.28)] transition duration-200 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 sm:min-h-[118px] sm:p-4 ${active === id ? "ring-2 ring-cyan-300 ring-offset-2 ring-offset-[#160b3d]" : ""}`}>
                <span aria-hidden="true" className="pointer-events-none absolute -right-8 -bottom-10 size-24 rounded-full bg-white/10 blur-xl" />
                <span aria-hidden="true" className="relative flex h-full min-w-0 items-center gap-2.5 sm:gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white shadow-[inset_0_1px_8px_rgba(255,255,255,0.25)] sm:size-14"><Icon aria-hidden="true" className="size-6 sm:size-7" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold leading-tight tracking-tight sm:text-lg">{label}</span><span className="mt-1 block line-clamp-3 text-[10px] font-semibold leading-[1.2] text-white/90 sm:text-xs">{description}</span></span>
                  <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-white/80 transition-transform group-hover:translate-x-1 sm:size-6" />
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
