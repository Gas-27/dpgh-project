import { Button } from "@/components/ui/button";
import NetworkSubTabs from "@/components/NetworkSubTabs";
import { getNetworkFamily, type SpecialNetworkKey } from "@/lib/networkConfig";

export const NETWORK_TAB_OPTIONS = [
  { key: "mtn", label: "MTN" },
  { key: "mtn_express", label: "MTN Express" },
  { key: "airteltigo", label: "AirtelTigo" },
  { key: "telecel", label: "Telecel" },
] as const;

export type NetworkTabKey = (typeof NETWORK_TAB_OPTIONS)[number]["key"] | SpecialNetworkKey;

type PackageLike = { network?: string | null; active?: boolean | null };
type Props = {
  value: NetworkTabKey;
  onChange: (value: NetworkTabKey) => void;
  className?: string;
  /** When provided, MTN and Telecel show "Bundles / Special" sub-tabs if the special network has active packages. */
  packages?: PackageLike[];
};

const isYellow = (key: string) => key === "mtn" || key === "mtn_express";
const activeColors = (key: string) => ({
  backgroundColor: isYellow(key) ? "#fbbf24" : key === "airteltigo" ? "#3b82f6" : "#ef4444",
  borderColor: isYellow(key) ? "#fbbf24" : key === "airteltigo" ? "#3b82f6" : "#ef4444",
  color: isYellow(key) ? "#000" : "#fff",
});

export default function NetworkTabs({ value, onChange, className = "", packages }: Props) {
  const family = getNetworkFamily(value);

  return (
    <div className="w-full">
      <div className={`network-tabs flex w-full items-center justify-center gap-1 overflow-hidden ${className}`} role="tablist" aria-label="Mobile network">
        {NETWORK_TAB_OPTIONS.map((network) => {
          const selected = family === network.key;
          return (
            <Button
              key={network.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(network.key)}
              className={`network-tab h-10 min-w-0 flex-1 whitespace-nowrap rounded-full border px-1 text-[10px] font-bold shadow-none transition-colors sm:h-11 sm:flex-none sm:px-5 sm:text-base ${selected ? `network-tab-active network-tab-${network.key}` : "network-tab-inactive"}`}
              style={selected ? activeColors(network.key) : undefined}
            >
              {network.label}
            </Button>
          );
        })}
      </div>
      {packages && <NetworkSubTabs value={value} onChange={(next) => onChange(next as NetworkTabKey)} packages={packages} className="mb-4 mt-2" />}
    </div>
  );
}
