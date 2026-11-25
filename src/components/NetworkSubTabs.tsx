import { Button } from "@/components/ui/button";
import { getActiveSpecialNetworks, getNetworkFamily } from "@/lib/networkConfig";

type PackageLike = { network?: string | null; active?: boolean | null };

type Props = {
  /** Current network key, e.g. "mtn", "mtn_special", "telecel", "telecel_special". */
  value: string;
  onChange: (value: string) => void;
  packages: PackageLike[];
  className?: string;
};

const SUB_TABS: Record<string, { parent: string; special: string; bundlesLabel: string; specialLabel: string; active: { backgroundColor: string; borderColor: string; color: string } }> = {
  mtn: {
    parent: "mtn",
    special: "mtn_special",
    bundlesLabel: "MTN Bundles",
    specialLabel: "MTN Special",
    active: { backgroundColor: "#fbbf24", borderColor: "#fbbf24", color: "#000" },
  },
  telecel: {
    parent: "telecel",
    special: "telecel_special",
    bundlesLabel: "Telecel Bundles",
    specialLabel: "Telecel Special",
    active: { backgroundColor: "#ef4444", borderColor: "#ef4444", color: "#fff" },
  },
};

/**
 * "Bundles / Special" sub-tabs shown under the MTN and Telecel tabs.
 * Renders nothing unless the special network has at least one active package.
 */
export default function NetworkSubTabs({ value, onChange, packages, className = "" }: Props) {
  const config = SUB_TABS[getNetworkFamily(value)];
  if (!config) return null;
  if (!getActiveSpecialNetworks(packages).includes(config.special as never)) return null;

  const options = [
    { key: config.parent, label: config.bundlesLabel },
    { key: config.special, label: config.specialLabel },
  ];

  return (
    <div className={`flex w-full items-center justify-center gap-2 ${className}`} role="tablist" aria-label={`${config.bundlesLabel} and ${config.specialLabel}`}>
      {options.map((option) => {
        const selected = value === option.key;
        return (
          <Button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.key)}
            className={`network-subtab h-8 flex-1 whitespace-nowrap rounded-full border px-3 text-xs font-bold shadow-none transition-colors sm:flex-none sm:px-5 sm:text-sm ${selected ? "network-subtab-active" : "network-tab-inactive"}`}
            style={selected ? config.active : undefined}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
