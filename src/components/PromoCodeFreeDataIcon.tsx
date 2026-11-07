import { Gift } from "lucide-react";

export default function PromoCodeFreeDataIcon() {
  return (
    <span className="flex w-fit max-w-[calc(100vw-1rem)] items-center gap-2 rounded-r-full rounded-l-xl border border-emerald-400/50 bg-emerald-950 px-3 py-2 text-emerald-100 shadow-lg">
      <Gift className="h-4 w-4 shrink-0 text-yellow-300" aria-hidden="true" />
      <span className="text-sm font-bold tracking-wide">FREE DATA</span>
    </span>
  );
}
