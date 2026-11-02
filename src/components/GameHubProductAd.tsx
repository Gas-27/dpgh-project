import { BadgeCheck, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchGameHubAdImage, type GameHubAd } from "@/lib/gameHubAds";

type GameHubProductAdProps = {
  ad: GameHubAd;
  onOpen: (ad: GameHubAd) => void;
  onClose: () => void;
};

export default function GameHubProductAd({ ad, onOpen, onClose }: GameHubProductAdProps) {
  const { data: lazyImage, isLoading } = useQuery({
    queryKey: ["game-hub-ad-image", ad.id],
    queryFn: () => fetchGameHubAdImage(ad.id),
    enabled: !ad.image,
    staleTime: 30 * 60 * 1000,
  });
  const imageSrc = ad.image || lazyImage || null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="gh-ad-title" className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-violet-400/30 bg-[#150a30] text-white shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close ad"
          className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onOpen(ad)} className="block w-full text-left">
          {imageSrc ? (
            <img src={imageSrc} alt={ad.title} className="h-56 w-full object-cover" />
          ) : (
            <div className="flex h-56 w-full items-center justify-center bg-violet-950 text-sm text-violet-300">{isLoading ? "Loading image" : ""}</div>
          )}
          <div className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-violet-800 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-100">Ad</span>
              {ad.golden ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-2 py-0.5 text-[11px] font-bold text-amber-950">
                  <BadgeCheck className="h-3 w-3" aria-hidden="true" /> Golden Boost
                </span>
              ) : (
                <span className="rounded-full bg-fuchsia-600 px-2 py-0.5 text-[11px] font-bold text-white">Boosted</span>
              )}
            </div>
            <h3 id="gh-ad-title" className="line-clamp-2 text-lg font-bold">{ad.title}</h3>
            <p className="text-base font-semibold text-emerald-300">GH&#8373;{ad.price.toFixed(2)}</p>
            <span className="mt-1 block rounded-xl bg-violet-600 px-4 py-3 text-center text-sm font-bold">View product</span>
          </div>
        </button>
        <button type="button" onClick={onClose} className="w-full px-4 py-3 text-xs text-violet-300 underline">
          Skip and continue
        </button>
      </div>
    </div>
  );
}
