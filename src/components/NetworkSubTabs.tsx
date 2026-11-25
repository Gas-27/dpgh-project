import { Button } from "@/components/ui/button";
import { getActiveSpecialNetworks, getNetworkFamily } from "@/lib/networkConfig";

type PackageLike = { network?: string | null; active?: boolean | null };

type Props = {
  /** Current network key, e.g. "mtn", "mtn_special", "mashup", "telecel", "telecel_special". */
  value: string;
  onChange: (value: string) => void;
  packages: PackageLike[];
  className?: string;
};

type SubTabOption = {
  key: string;
  label: string;
  /** Network key that must have active packages for this option to show. Omit for the always-on bundles option. */
  requires?: string;
  active: { backgroundColor: string; borderColor: string; color: string };
};

const YELLOW = { backgroundColor: "#fbbf24", borderColor: "#fbbf24", color: "#000" };
const RED = { backgroundColor: "#ef4444", borderColor: "#ef4444", color: "#fff" };
const ORANGE = { backgroundColor: "#f97316", borderColor: "#f97316", color: "#fff" };

const SUB_TABS: Record<string, SubTabOption[]> = {
  mtn: [
    { key: "mtn", label: "MTN Bundles", active: YELLOW },
    { key: "mtn_special", label: "MTN Special", requires: "mtn_special", active: YELLOW },
  ],
  mtn_express: [
    { key: "mtn_express", label: "MTN Express Bundles", active: YELLOW },
    { key: "mtn_express_special", label: "MTN Special", requires: "mtn_special", active: YELLOW },
  ],
  telecel: [
    { key: "telecel", label: "Telecel Bundles", active: RED },
    { key: "telecel_special", label: "Telecel Special", requires: "telecel_special", active: RED },
  ],
};

/**
 * "Bundles / Special / MashUp" sub-tabs shown under the MTN and Telecel tabs.
 * Renders nothing unless at least one special network has an active package.
 */
export default function NetworkSubTabs({ value, onChange, packages, className = "" }: Props) {
  const family = getNetworkFamily(value);
  const config = SUB_TABS[family];
  if (!config) return null;

  const activeSpecials: string[] = getActiveSpecialNetworks(packages);
  const options = config.filter((option) => !option.requires || activeSpecials.includes(option.requires));
  if (options.length < 2) return null;

  const currentKey = value === "mtn_mashup" ? "mashup" : value;

  return (
    <div className={`flex w-full items-center justify-center gap-2 ${className}`} role="tablist" aria-label={options.map((o) => o.label).join(", ")}>
      {options.map((option) => {
        const selected = currentKey === option.key;
        return (
          <Button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.key)}
            className={`network-subtab h-8 flex-1 whitespace-nowrap rounded-full border px-3 text-xs font-bold shadow-none transition-colors sm:flex-none sm:px-5 sm:text-sm ${selected ? "network-subtab-active" : "network-tab-inactive"}`}
            style={selected ? option.active : undefined}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
