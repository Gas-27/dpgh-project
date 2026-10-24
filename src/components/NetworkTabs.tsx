import { Button } from "@/components/ui/button";

export const NETWORK_TAB_OPTIONS = [
  { key: "mtn", label: "MTN" },
  { key: "mtn_express", label: "MTN Express" },
  { key: "airteltigo", label: "AirtelTigo" },
  { key: "telecel", label: "Telecel" },
] as const;

export type NetworkTabKey = (typeof NETWORK_TAB_OPTIONS)[number]["key"];

type Props = { value: NetworkTabKey; onChange: (value: NetworkTabKey) => void; className?: string; telecelPackageType?: "cheap" | "special"; onTelecelPackageTypeChange?: (value: "cheap" | "special") => void };

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
      <div className="mt-2 flex w-full justify-center gap-2" role="tablist" aria-label="Telecel package type">
        {(["cheap", "special"] as const).map((type) => (
          <Button key={type} type="button" role="tab" aria-selected={telecelPackageType === type} onClick={() => onTelecelPackageTypeChange(type)} variant={telecelPackageType === type ? "default" : "outline"} className="rounded-full px-4 text-xs sm:text-sm">
            {type === "cheap" ? "Cheap Data" : "Telecel Special"}
          </Button>
        ))}
      </div>
    )}
    </div>
  );
}
