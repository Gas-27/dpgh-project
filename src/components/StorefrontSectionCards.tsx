
import { useEffect, useState } from "react";
import { Box, BriefcaseBusiness, Gamepad2, Layers3, MessageCircle, Package, UserRoundPlus, Wifi, Zap } from "lucide-react";
import { fetchTabControls, isTabUnavailable, type TabControls } from "@/lib/tabControls";

const sections = [
  { id: "data", label: "Cheap Data", description: "Buy affordable data packages", icon: Wifi },
  { id: "gamehub", label: "GameHub", description: "Play, enjoy and win rewards", icon: Gamepad2 },
  { id: "subscription", label: "Subscription", description: "Netflix, ChatGPT, Canva & more", icon: Package },
  { id: "instant", label: "Airtime & Data", description: "Buy airtime and regular data bundles directly", icon: Zap },
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
          const aliases: Record<string, string[]> = {
            instant: ["instant", "vouchers", "data-airtime", "airtime"],
            data: ["data", "cheap-data", "cheap_data"],
            packages: ["packages", "package"],
            services: ["services", "service"],
            products: ["products", "product"],
          };
          const control = [id, ...(aliases[id] ?? [])].map((key) => tabControls[key]).find(Boolean);
          const unavailable = isTabUnavailable(control);
          const handleClick = () => {
            // Select the normal tab first so its real page remains visible beneath the modal.
            if (isAgent) {
              onBecomeAgent?.();
            } else {
              onSelect(id);
              window.setTimeout(() => document.getElementById("storefront-section-content")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
            }
            if (unavailable || isAgent) return;
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
                left: index % 2 === 0 ? "2.1%" : "50.8%",
                top: `${[2.5, 19.8, 38.3, 55.3, 72.6][Math.floor(index / 2)]}%`,
              }}
              className={`storefront-reference-hotspot ${active === id ? "is-active" : ""}`}
            >
              <span className="sr-only">{label}: {description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type { SectionId };
