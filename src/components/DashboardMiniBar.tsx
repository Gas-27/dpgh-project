import { Bell, Gift, Image, ShoppingCart, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

type DashboardMiniBarProps = { onSelect: (tab: string) => void };

const links = [
  ["buy", "Buy Data", ShoppingCart],
  ["notifications", "Notifications", Bell],
  ["social-boost", "Social Boost", Sparkles],
  ["api-key", "API Info", Zap],
  ["flyer", "Flyer Generator", Image],
  ["promo", "Promo Codes", Gift],
] as const;

export default function DashboardMiniBar({ onSelect }: DashboardMiniBarProps) {
  return <nav aria-label="Dashboard shortcuts" className="grid grid-cols-2 gap-2 rounded-xl border border-border/70 bg-card/60 p-2 sm:grid-cols-3 lg:grid-cols-6">
    {links.map(([value, label, Icon]) => <Button key={value} type="button" variant="outline" className="h-10 rounded-full text-xs sm:text-sm" onClick={() => onSelect(value)}><Icon data-icon="inline-start" />{label}</Button>)}
  </nav>;
}
