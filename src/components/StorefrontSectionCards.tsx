
import { useEffect, useState } from "react";
import { Box, BriefcaseBusiness, Gamepad2, Layers3, MessageCircle, Package, UserRoundPlus, Wifi, Zap } from "lucide-react";
import { fetchTabControls, isTabUnavailable, type TabControls } from "@/lib/tabControls";
import TabMaintenanceOverlay from "@/components/TabMaintenanceOverlay";

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
  const [tabControls, setTabControls] = useState<TabControls>({});
  const [blockedSection, setBlockedSection] = useState<SectionId | null>(null);
  useEffect(() => {
    let mounted = true;
    fetchTabControls().then((controls) => { if (mounted) setTabControls(controls); });
    return () => { mounted = false; };
  }, []);
  const visibleSections = sections.filter(({ id }) => !hiddenIds.includes(id));

  return (
    <div className="relative left-1/2 w-screen -translate-x-1/2 sm:static sm:mx-auto sm:w-full sm:translate-x-0">
      <div className="storefront-reference-grid mx-auto w-full max-w-[720px]">
        {visibleSections.map(({ id, label, description }, index) => {
          const isAgent = id === "agent";
          const unavailable = isTabUnavailable(tabControls[id]);
          const handleClick = () => {
            if (unavailable) { setBlockedSection(id); return; }
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
              aria-disabled={unavailable}
              title={unavailable ? (tabControls[id]?.message || "This service is temporarily under maintenance.") : description}
              style={{
                left: index % 2 === 0 ? "3.7%" : "50.5%",
                top: `${2 + Math.floor(index / 2) * 19.05}%`,
              }}
              className={`storefront-reference-hotspot ${active === id ? "is-active" : ""}`}
            >
              <span className="sr-only">{label}: {description}</span>
            </button>
          );
        })}
      </div>
      {blockedSection && tabControls[blockedSection] && <TabMaintenanceOverlay label={sections.find((section) => section.id === blockedSection)?.label ?? "Service"} {...tabControls[blockedSection]} />}
    </div>
  );
}

export type { SectionId };
