const PILL_STYLES = [
  "border-cyan-400/60 bg-gradient-to-br from-cyan-500/30 to-sky-500/20 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.35)]",
  "border-orange-400/60 bg-gradient-to-br from-orange-600/35 to-red-700/25 text-orange-200 shadow-[0_0_14px_rgba(251,146,60,0.35)]",
  "border-fuchsia-400/60 bg-gradient-to-br from-fuchsia-600/35 to-purple-700/25 text-fuchsia-100 shadow-[0_0_14px_rgba(217,70,239,0.35)]",
  "border-emerald-400/60 bg-gradient-to-br from-emerald-600/35 to-green-800/25 text-emerald-200 shadow-[0_0_14px_rgba(52,211,153,0.35)]",
  "border-blue-400/60 bg-gradient-to-br from-blue-600/35 to-indigo-600/25 text-blue-100 shadow-[0_0_14px_rgba(96,165,250,0.35)]",
  "border-amber-400/60 bg-gradient-to-br from-amber-500/30 to-orange-500/20 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.35)]",
  "border-violet-400/60 bg-gradient-to-br from-violet-700/35 to-purple-900/25 text-violet-100 shadow-[0_0_14px_rgba(167,139,250,0.35)]",
  "border-teal-400/60 bg-gradient-to-br from-teal-500/30 to-cyan-700/20 text-teal-100 shadow-[0_0_14px_rgba(45,212,191,0.35)]",
  "border-indigo-400/60 bg-gradient-to-br from-indigo-600/35 to-blue-800/25 text-indigo-100 shadow-[0_0_14px_rgba(129,140,248,0.35)]",
];

export const overviewTabClass = (index: number) =>
  `flex min-h-11 items-center justify-center rounded-full border px-3 py-2 text-center text-xs font-semibold leading-tight transition hover:-translate-y-0.5 hover:brightness-125 ${PILL_STYLES[index % PILL_STYLES.length]}`;
