import { Copy, Send, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { shareText } from "@/lib/gameHubApi";

type ShareScoreButtonsProps = {
  title: string;
  text: string;
  url: string;
};

export default function ShareScoreButtons({ title, text, url }: ShareScoreButtonsProps) {
  const { toast } = useToast();
  const message = `${text} ${url}`;
  const encodedMessage = encodeURIComponent(message);

  const targets = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodedMessage}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
    { label: "X", href: `https://twitter.com/intent/tweet?text=${encodedMessage}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}` },
  ];

  const handleNativeShare = async () => {
    try {
      const result = await shareText(title, text, url);
      if (result === "copied") toast({ title: "Copied to clipboard", description: "Paste it in any app to challenge a friend." });
    } catch {
      toast({ title: "Could not share", variant: "destructive" });
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast({ title: "Copied to clipboard", description: "Paste it in any app to challenge a friend." });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  const chipClass = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-400/30 bg-violet-900/60 px-3 py-2.5 text-xs font-semibold text-white";

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => void handleNativeShare()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-rose-500 px-4 py-3 text-sm font-bold text-white">
        <Share2 className="h-4 w-4" aria-hidden="true" /> Share with a friend
      </button>
      <div className="grid grid-cols-2 gap-2">
        {targets.map((target) => (
          <a key={target.label} href={target.href} target="_blank" rel="noopener noreferrer" className={chipClass}>
            <Send className="h-3.5 w-3.5" aria-hidden="true" /> {target.label}
          </a>
        ))}
      </div>
      <button type="button" onClick={() => void handleCopy()} className={chipClass}>
        <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy message
      </button>
    </div>
  );
}
