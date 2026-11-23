import { BarChart3, Gift, Megaphone, MessageSquare, Phone, Receipt, Rocket, Smartphone, Store, Tv, Users, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const PRODUCTS = [
  { label: "Cheap data", icon: Smartphone },
  { label: "Airtime", icon: Phone },
  { label: "Subscriptions", icon: Tv },
  { label: "Social boost", icon: Rocket },
  { label: "AFA registration", icon: Users },
  { label: "Utilities", icon: Receipt },
];

const PERKS = [
  { label: "Your own store link", icon: Store },
  { label: "USSD code", icon: Zap },
  { label: "Flyer generator", icon: Megaphone },
  { label: "Bulk SMS", icon: MessageSquare },
  { label: "Marketing materials", icon: Gift },
  { label: "Sub-agent earnings", icon: BarChart3 },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onBecomeAgent: () => void;
};

export default function BecomeAgentLoginPopup({ open, onClose, onBecomeAgent }: Props) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="become-agent-popup-title"
      className="fixed inset-0 z-[100000] flex h-[100dvh] flex-col bg-gradient-to-b from-[#0b0f1f] via-[#17112b] to-[#241a33] text-white"
    >
      <div className="flex justify-end px-4 pt-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full bg-white/10 p-2 text-white/80 hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-3">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-300">Agent programme</p>
          <h2 id="become-agent-popup-title" className="mt-1.5 text-balance text-2xl font-extrabold leading-tight">
            Earn up to GH{"\u20B5"}5,000 a month with no capital
          </h2>
          <p className="mt-1.5 text-pretty text-sm leading-snug text-white/75">
            Become an agent and resell cheap data, airtime, subscriptions and more under your own store.
          </p>
        </div>

        <section aria-labelledby="agent-popup-sell">
          <h3 id="agent-popup-sell" className="text-xs font-bold uppercase tracking-wider text-purple-300">What you sell</h3>
          <ul className="mt-1.5 grid grid-cols-3 gap-2">
            {PRODUCTS.map(({ label, icon: Icon }) => (
              <li key={label} className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-1 py-2 text-center">
                <Icon className="h-5 w-5 text-purple-300" aria-hidden="true" />
                <span className="text-[11px] font-semibold leading-tight">{label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="agent-popup-get">
          <h3 id="agent-popup-get" className="text-xs font-bold uppercase tracking-wider text-purple-300">What you get</h3>
          <ul className="mt-1.5 grid grid-cols-2 gap-2">
            {PERKS.map(({ label, icon: Icon }) => (
              <li key={label} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
                <Icon className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                <span className="text-xs font-semibold leading-tight">{label}</span>
              </li>
            ))}
          </ul>
        </section>

        <p className="text-center text-xs leading-snug text-white/70">
          Plus more tools to help you sell more. One-time registration fee, no monthly charges.
        </p>
      </div>

      <div className="flex flex-col gap-1 px-5 pb-5 pt-2">
        <Button
          onClick={onBecomeAgent}
          className="h-12 w-full rounded-full bg-purple-600 text-base font-bold text-white hover:bg-purple-500"
        >
          Become an Agent
        </Button>
        <button type="button" onClick={onClose} className="py-2 text-sm font-semibold text-white/70 hover:text-white">
          Not now
        </button>
      </div>
    </div>
  );
}
