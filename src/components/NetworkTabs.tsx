import { Button } from "@/components/ui/button";

export const NETWORK_TAB_OPTIONS = [
  { key: "mtn", label: "MTN" },
  { key: "mtn_express", label: "MTN Express" },
  { key: "airteltigo", label: "AirtelTigo" },
  { key: "telecel", label: "Telecel" },
] as const;

export type NetworkTabKey = (typeof NETWORK_TAB_OPTIONS)[number]["key"];

type Props = { value: NetworkTabKey; onChange: (value: NetworkTabKey) => void; className?: string };

export default function NetworkTabs({ value, onChange, className = "" }: Props) {
  return (
    <div className={`network-tabs flex flex-wrap gap-3 ${className}`} role="tablist" aria-label="Mobile network">
      {NETWORK_TAB_OPTIONS.map((network) => (
        <Button
          key={network.key}
          type="button"
          role="tab"
          aria-selected={value === network.key}
          onClick={() => onChange(network.key)}
          className={`network-tab h-12 rounded-2xl border px-5 text-base font-bold shadow-none transition-colors ${value === network.key ? "network-tab-active" : "network-tab-inactive"}`}
        >
          {network.label}
        </Button>
      ))}
    </div>
  );
}
