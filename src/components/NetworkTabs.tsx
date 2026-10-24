import { Button } from "@/components/ui/button";

export const NETWORK_TAB_OPTIONS = [
  { key: "mtn", label: "MTN" },
  { key: "mtn_express", label: "MTN Express" },
  { key: "airteltigo", label: "AirtelTigo" },
  { key: "telecel", label: "Telecel" },
] as const;

export type NetworkTabKey = (typeof NETWORK_TAB_OPTIONS)[number]["key"];
export type TelecelPackageType = "cheap" | "special";

type Props = { value: NetworkTabKey; onChange: (value: NetworkTabKey) => void; className?: string; telecelPackageType?: TelecelPackageType; onTelecelPackageTypeChange?: (value: TelecelPackageType) => void };

export function TelecelSubTabs({ value, onChange, className = "" }: { value: TelecelPackageType; onChange: (value: TelecelPackageType) => void; className?: string }) {
  const tabs = [
    { key: "cheap" as const, label: "Data Bundles" },
    { key: "special" as const, label: "TELECEL SPECIAL" },
  ];
  return (
    <div className={`mt-3 mb-2 grid w-full grid-cols-2 gap-2 ${className}`} role="tablist" aria-label="Telecel package type">
      {tabs.map((tab) => {
        const active = value === tab.key;
        return (
          <Button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className="h-11 whitespace-nowrap rounded-xl border-0 px-2 text-xs font-bold shadow-none sm:text-sm"
            style={active ? { backgroundColor: "#ef4444", color: "#fff" } : { backgroundColor: "transparent", color: "#9ca3af" }}
          >
            {tab.label}
          </Button>
        );
      })}
    </div>
  );
}

export default function NetworkTabs({ value, onChange, className = "", telecelPackageType = "cheap", onTelecelPackageTypeChange }: Props) {
  return (
    <div className="w-full">
      <div className={`network-tabs flex w-full items-center justify-center gap-1 overflow-hidden ${className}`} role="tablist" aria-label="Mobile network">
        {NETWORK_TAB_OPTIONS.map((network) => (
          <Button
            key={network.key}
            type="button"
            role="tab"
            aria-selected={value === network.key}
            onClick={() => onChange(network.key)}
            className={`network-tab h-10 min-w-0 flex-1 whitespace-nowrap rounded-full border px-1 text-[10px] font-bold shadow-none transition-colors sm:h-11 sm:flex-none sm:px-5 sm:text-base ${value === network.key ? `network-tab-active network-tab-${network.key}` : "network-tab-inactive"}`}
            style={value === network.key ? {
              backgroundColor: network.key === "mtn" || network.key === "mtn_express" ? "#fbbf24" : network.key === "airteltigo" ? "#3b82f6" : "#ef4444",
              borderColor: network.key === "mtn" || network.key === "mtn_express" ? "#fbbf24" : network.key === "airteltigo" ? "#3b82f6" : "#ef4444",
              color: network.key === "mtn" || network.key === "mtn_express" ? "#000" : "#fff",
            } : undefined}
          >
            {network.label}
          </Button>
        ))}
      </div>
      {value === "telecel" && onTelecelPackageTypeChange && (
        <TelecelSubTabs value={telecelPackageType} onChange={onTelecelPackageTypeChange} />
      )}
    </div>
  );
}
