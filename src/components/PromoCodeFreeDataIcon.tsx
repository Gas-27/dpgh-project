import { Gift } from "lucide-react";

export default function PromoCodeFreeDataIcon() {
  return (
    <span className="flex w-56 max-w-[calc(100vw-1rem)] items-center gap-3 rounded-r-full rounded-l-[2rem] border border-emerald-400/50 bg-emerald-950 px-5 py-3 text-emerald-100 shadow-lg">
      <Gift className="h-7 w-7 shrink-0 text-yellow-300" aria-hidden="true" />
      <span className="text-lg font-bold tracking-wide">FREE DATA</span>
    </span>
  );
}
