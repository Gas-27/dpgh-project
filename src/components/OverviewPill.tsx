import type { CSSProperties, ReactNode } from "react";
import {
  Bell, CalendarDays, Code2, Droplets, Gamepad2, Globe, HandCoins, Megaphone, MessagesSquare, Package,
  Palette, RadioTower, Receipt, Rocket, ShoppingCart, Tag, Tv, Users, Wallet, Zap,
} from "lucide-react";

type PillTheme = { background: string; color: string; border: string; glow: string; icon?: ReactNode; trailing?: ReactNode };

const VipBadge = () => (
  <span className="rounded-md bg-[#0a0f3a] px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-[#c7d2fe]">VIP</span>
);

const icon = "h-4 w-4 shrink-0 sm:h-6 sm:w-6";

const THEMES: Record<string, PillTheme> = {
  Marketing: { background: "linear-gradient(90deg,#be185d,#f43f5e)", color: "#ffe4ec", border: "#fb7185", glow: "#fb7185", icon: <Megaphone className={icon} /> },
  GameHub: { background: "linear-gradient(90deg,#14a8f5,#00f0e6)", color: "#0b3358", border: "#22d3ee", glow: "#00e5ff", icon: <Gamepad2 className={icon} fill="currentColor" /> },
  "Buy Data": { background: "linear-gradient(90deg,#7a1c05,#a83c00)", color: "#ff8a1f", border: "#ff6a00", glow: "#ff6a00", icon: <RadioTower className={icon} /> },
  "Promo Codes": { background: "linear-gradient(90deg,#7b1fa2,#a21caf)", color: "#f6d6ff", border: "#e040fb", glow: "#e040fb", icon: <Tag className={icon} fill="currentColor" /> },
  Domains: { background: "linear-gradient(90deg,#0a4f35,#0f6b44)", color: "#4ade80", border: "#22c55e", glow: "#22c55e", icon: <Globe className={icon} /> },
  "Instant Data": { background: "linear-gradient(90deg,#3a58d6,#4a8af0)", color: "#e3e9ff", border: "#3b82f6", glow: "#3b82f6", icon: <Zap className={icon} fill="currentColor" /> },
  Subscription: { background: "linear-gradient(90deg,#d57a5c,#eaa45f)", color: "#ffe3c4", border: "#f0a060", glow: "#f0a060", icon: <CalendarDays className={icon} fill="currentColor" /> },
  "Subscription (Price Set)": { background: "linear-gradient(90deg,#a9b8fb,#c1cdfc)", color: "#0b1050", border: "#60a5fa", glow: "#60a5fa", icon: <VipBadge /> },
  "Top Up": { background: "linear-gradient(90deg,#2b2e30,#303334)", color: "#fbbf24", border: "#d4a537", glow: "#d4a537", icon: <Wallet className={icon} fill="currentColor" /> },
  "Store Prices": { background: "linear-gradient(90deg,#2a0b3d,#33104a)", color: "#f0e6ff", border: "#7c3aed", glow: "#7c3aed", icon: <ShoppingCart className={icon} /> },
  Notifications: { background: "linear-gradient(90deg,#1b8a98,#1a8f93)", color: "#6ff5e1", border: "#14d4c4", glow: "#14d4c4", icon: <Bell className={icon} fill="currentColor" /> },
  "AFA Registration": { background: "linear-gradient(90deg,#2a2552,#31295c)", color: "#d8b4fe", border: "#4b3f8f", glow: "#4b3f8f" },
  Subagents: { background: "linear-gradient(90deg,#8c6c3a,#9c7c44)", color: "#fcd34d", border: "#c9973f", glow: "#c9973f", icon: <Users className={icon} fill="currentColor" /> },
  Appearance: { background: "linear-gradient(90deg,#c4ecf6,#d4f1f8)", color: "#5b7fa6", border: "#8fb1d0", glow: "#8fb1d0", icon: <Palette className={icon} fill="currentColor" /> },
  "Bulk SMS": { background: "linear-gradient(90deg,#78461a,#85511f)", color: "#fb923c", border: "#d97a2b", glow: "#d97a2b", icon: <MessagesSquare className={icon} fill="currentColor" /> },
  Products: { background: "linear-gradient(90deg,#1d0a4a,#260f5c)", color: "#c9a8ff", border: "#5b3a9e", glow: "#5b3a9e", icon: <Package className={icon} fill="currentColor" /> },
  Utilities: {
    background: "linear-gradient(90deg,#134d1f,#17601f)", color: "#4ade80", border: "#22c55e", glow: "#22c55e",
    icon: <Receipt className={icon} />,
    trailing: <span className="flex shrink-0 flex-col items-center"><Tv className="h-3 w-3 sm:h-4 sm:w-4" /><Droplets className="h-3 w-3 sm:h-4 sm:w-4" fill="currentColor" /></span>,
  },
  "Social Boost": { background: "linear-gradient(90deg,#2a2e9a,#3a36b8)", color: "#c4b5fd", border: "#5b5be6", glow: "#5b5be6", icon: <Rocket className={icon} fill="currentColor" /> },
  "Subagent Pricing": { background: "linear-gradient(90deg,#a85e08,#c4740a)", color: "#fff0cc", border: "#f59e0b", glow: "#f59e0b", icon: <HandCoins className={icon} /> },
  "API Info": { background: "linear-gradient(90deg,#34b4f2,#3fc0f0)", color: "#0b2a6b", border: "#38bdf8", glow: "#38bdf8", icon: <Code2 className={icon} /> },
  "Flyer Generator": { background: "linear-gradient(90deg,#3a1d05,#4a2606)", color: "#ff7a18", border: "#f97316", glow: "#f97316" },
};

const FALLBACK: PillTheme = { background: "linear-gradient(90deg,#1e293b,#334155)", color: "#e2e8f0", border: "#64748b", glow: "#64748b" };

type Props = { label: string; text?: string; onClick: () => void };

export default function OverviewPill({ label, text, onClick }: Props) {
  const theme = THEMES[label] ?? FALLBACK;
  const style: CSSProperties = {
    background: theme.background,
    color: theme.color,
    border: `2px solid ${theme.border}`,
    boxShadow: `0 0 12px ${theme.glow}88, inset 0 0 10px ${theme.glow}33`,
  };
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className="flex min-h-12 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-center text-[13px] font-bold leading-tight transition hover:-translate-y-0.5 hover:brightness-110 sm:min-h-14 sm:gap-2 sm:px-3 sm:text-base"
    >
      {theme.icon}
      <span>{text ?? label}</span>
      {theme.trailing}
    </button>
  );
}
