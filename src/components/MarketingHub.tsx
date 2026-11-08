import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Clock, Copy, Download, Facebook, Heart, Instagram, Link2, Megaphone, MessageCircle, Music2, Send, Share2, Sparkles, Twitter, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { fetchMarketingPosts, type MarketingPost } from "@/lib/marketingApi";
import type { StoreInfo } from "@/components/FlyerShared";

type Platform = "whatsapp" | "tiktok" | "instagram" | "facebook";

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "whatsapp", label: "WhatsApp Status" },
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram Story" },
  { id: "facebook", label: "Facebook Story" },
];

const POST_TIMES = ["7am", "12pm", "7pm"];

const TEMPLATES = [
  "{greeting}! Need data fast? {store} delivers MTN, Telecel and AirtelTigo bundles in minutes at the best prices. Order here:",
  "Stop paying more for data. Get cheap, instant bundles from {store}. Tap the link, pick your bundle, done:",
  "{greeting}! Data finished? Top up with {store} in under a minute. No stress, no long queues. Order now:",
  "Cheap data, trusted delivery. {store} is open all day and night for MTN, Telecel and AirtelTigo. Buy here:",
  "Share this with someone who needs data today. {store} has the best bundle prices in town. Order here:",
  "Your data deal is waiting. Buy from {store}, get delivery in minutes and pay securely. Tap here:",
  "{greeting}! Big bundles, small prices. Get yours from {store} before the day ends:",
];

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const fillTemplate = (template: string, storeName: string) =>
  template.replace(/\{greeting\}/g, greeting()).replace(/\{store\}/g, storeName || "our store");

function SocialIcon({ platform }: { platform: "whatsapp" | "facebook" | "tiktok" | "instagram" | "telegram" | "x" }) {
  const className = "h-5 w-5";
  switch (platform) {
    case "whatsapp":
      return <MessageCircle className={className} aria-hidden />;
    case "facebook":
      return <Facebook className={className} aria-hidden />;
    case "tiktok":
      return <Music2 className={className} aria-hidden />;
    case "instagram":
      return <Instagram className={className} aria-hidden />;
    case "telegram":
      return <Send className={className} aria-hidden />;
    default:
      return <Twitter className={className} aria-hidden />;
  }
}

function StoryPreview({ platform, storeName, caption, link, imageUrl }: { platform: Platform; storeName: string; caption: string; link: string; imageUrl: string | null }) {
  const initial = (storeName || "S").trim().charAt(0).toUpperCase();
  const host = link.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const label = platform === "whatsapp" ? "My status" : platform === "tiktok" ? `@${(storeName || "store").toLowerCase().replace(/[^a-z0-9]+/g, "")}` : platform === "instagram" ? (storeName || "Your story") : "Your story";

  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[250px] overflow-hidden rounded-[28px] border-4 border-border bg-background shadow-xl">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/70 to-background" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-background/80" />

      <div className="relative z-10 flex h-full flex-col p-3">
        <div className="flex gap-1" aria-hidden>
          <span className="h-0.5 flex-1 rounded-full bg-foreground" />
          <span className="h-0.5 flex-1 rounded-full bg-foreground/40" />
          <span className="h-0.5 flex-1 rounded-full bg-foreground/40" />
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{initial}</span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-xs font-semibold text-foreground">{label}</p>
            <p className="text-[10px] text-muted-foreground">Just now</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-1">
          <p className="line-clamp-[9] whitespace-pre-line text-balance text-center text-sm font-bold leading-snug text-foreground drop-shadow">
            {caption || "Your message appears here"}
          </p>
        </div>

        <div className="mb-2 flex items-center justify-center">
          <span className="flex max-w-full items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-lg">
            <Link2 className="h-3 w-3 shrink-0 text-primary" />
            <span className="truncate">{host}</span>
          </span>
        </div>

        {platform === "whatsapp" && (
          <div className="rounded-full bg-card/80 px-3 py-1.5 text-center text-[10px] text-muted-foreground">Swipe up to reply</div>
        )}
        {platform === "instagram" && (
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-full border border-foreground/40 px-3 py-1.5 text-[10px] text-foreground/80">Send message</div>
            <Heart className="h-4 w-4 text-foreground" />
            <Send className="h-4 w-4 text-foreground" />
          </div>
        )}
        {platform === "facebook" && (
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-full bg-card/80 px-3 py-1.5 text-[10px] text-muted-foreground">Reply...</div>
            <Heart className="h-4 w-4 text-foreground" />
          </div>
        )}
        {platform === "tiktok" && (
          <div className="absolute bottom-14 right-2 flex flex-col items-center gap-3 text-foreground" aria-hidden>
            <Heart className="h-5 w-5" />
            <MessageCircle className="h-5 w-5" />
            <Share2 className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}

type MarketingHubProps = StoreInfo & { children?: ReactNode };

export default function MarketingHub({ storeName, storeUrl, children }: MarketingHubProps) {
  const { toast } = useToast();
  const [platform, setPlatform] = useState<Platform>("whatsapp");
  const [templateIndex, setTemplateIndex] = useState(0);
  const [caption, setCaption] = useState(() => fillTemplate(TEMPLATES[0], storeName));
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: posts = [] } = useQuery({ queryKey: ["marketing-posts"], queryFn: fetchMarketingPosts, staleTime: 60_000 });

  const fullText = useMemo(() => `${caption.trim()}\n${storeUrl}`, [caption, storeUrl]);

  const aiWrite = () => {
    setWriting(true);
    window.setTimeout(() => {
      const next = (templateIndex + 1 + Math.floor(Math.random() * (TEMPLATES.length - 1))) % TEMPLATES.length;
      setTemplateIndex(next);
      setCaption(fillTemplate(TEMPLATES[next], storeName));
      setImageUrl(null);
      setWriting(false);
    }, 600);
  };

  const copyText = async (text: string, message = "Copied") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      toast({ title: message });
      return true;
    } catch {
      toast({ title: "Could not copy", description: "Select the text and copy it manually.", variant: "destructive" });
      return false;
    }
  };

  const open = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  const shareTo = async (target: "whatsapp" | "facebook" | "telegram" | "x" | "tiktok" | "instagram") => {
    const text = encodeURIComponent(fullText);
    const link = encodeURIComponent(storeUrl);
    if (target === "whatsapp") return open(`https://wa.me/?text=${text}`);
    if (target === "facebook") return open(`https://www.facebook.com/sharer/sharer.php?u=${link}&quote=${encodeURIComponent(caption.trim())}`);
    if (target === "telegram") return open(`https://t.me/share/url?url=${link}&text=${encodeURIComponent(caption.trim())}`);
    if (target === "x") return open(`https://twitter.com/intent/tweet?text=${text}`);
    const copiedOk = await copyText(fullText, `Caption copied. Paste it in ${target === "tiktok" ? "TikTok" : "Instagram"}.`);
    if (copiedOk) open(target === "tiktok" ? "https://www.tiktok.com/upload" : "https://www.instagram.com/");
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: storeName, text: caption.trim(), url: storeUrl });
      } catch {
        // dismissed by the user
      }
    } else {
      void copyText(fullText, "Message and link copied");
    }
  };

  const usePost = (post: MarketingPost) => {
    setCaption(post.caption.replace(/\{store\}/g, storeName || "our store"));
    setImageUrl(post.image_url);
    toast({ title: "Message loaded", description: "Check the preview, then share it." });
  };

  const socials: { id: "whatsapp" | "facebook" | "tiktok" | "instagram" | "telegram" | "x"; label: string; className: string }[] = [
    { id: "whatsapp", label: "WhatsApp", className: "bg-[#25D366] text-[#052e16]" },
    { id: "tiktok", label: "TikTok", className: "bg-foreground text-background" },
    { id: "instagram", label: "Instagram", className: "bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white" },
    { id: "facebook", label: "Facebook", className: "bg-[#1877F2] text-white" },
    { id: "telegram", label: "Telegram", className: "bg-[#229ED9] text-white" },
    { id: "x", label: "X", className: "bg-secondary text-secondary-foreground" },
  ];

  return (
    <Tabs defaultValue="message" className="space-y-6">
      <TabsList className="grid h-auto w-full grid-cols-2">
        <TabsTrigger value="message">Market</TabsTrigger>
        <TabsTrigger value="flyers">Market with flyer</TabsTrigger>
      </TabsList>
      <TabsContent value="message" className="mt-0 space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-card to-card p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Megaphone className="h-5 w-5" />
          </span>
          <div className="space-y-1">
            <h2 className="font-display text-xl font-bold text-foreground">Marketing tools</h2>
            <p className="text-sm text-muted-foreground text-pretty">
              Share your store link every day on all your socials. Agents who post daily get more customers and more orders.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <Clock className="h-3.5 w-3.5 text-primary" /> Best times to post:
          </span>
          {POST_TIMES.map((time) => (
            <span key={time} className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 font-semibold text-primary">
              {time}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
          <Video className="h-5 w-5 text-primary" aria-hidden /> How to market and get customers
        </h3>
        <video
          src="/videos/get-your-first-customers-dataplug.mp4"
          controls
          playsInline
          preload="metadata"
          aria-label="How to market and get your first customers"
          className="aspect-video w-full rounded-xl bg-black"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-foreground">Your message</h3>
            <Button size="sm" onClick={aiWrite} disabled={writing} className="gap-1.5">
              <Sparkles className={`h-4 w-4 ${writing ? "animate-pulse" : ""}`} />
              {writing ? "Writing..." : "AI Write for me"}
            </Button>
          </div>
          <Textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            rows={5}
            maxLength={500}
            aria-label="Share message"
            className="text-sm"
          />
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs">
            <Link2 className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-medium text-foreground">{storeUrl}</span>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Share to</p>
            <div className="grid grid-cols-3 gap-2">
              {socials.map((social) => (
                <button
                  key={social.id}
                  type="button"
                  onClick={() => void shareTo(social.id)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-3 text-xs font-semibold transition hover:-translate-y-0.5 hover:brightness-110 ${social.className}`}
                >
                  <SocialIcon platform={social.id} />
                  {social.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void copyText(fullText, "Message and link copied")}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy message + link
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void nativeShare()}>
              <Share2 className="h-4 w-4" /> More apps
            </Button>
            {imageUrl && (
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <a href={imageUrl} target="_blank" rel="noopener noreferrer" download>
                  <Download className="h-4 w-4" /> Get image
                </a>
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h3 className="font-display text-base font-bold text-foreground">Story preview</h3>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Preview platform">
            {PLATFORMS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={platform === item.id}
                onClick={() => setPlatform(item.id)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                  platform === item.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <StoryPreview platform={platform} storeName={storeName} caption={caption} link={storeUrl} imageUrl={imageUrl} />
          <p className="text-center text-xs text-muted-foreground">This is how your post looks when you share it.</p>
        </div>
      </section>

      {posts.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-display text-base font-bold text-foreground">From the team</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {posts.map((post) => (
              <article key={post.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
                {post.image_url && <img src={post.image_url} alt="" className="h-36 w-full object-cover" loading="lazy" />}
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h4 className="font-semibold text-foreground">{post.title}</h4>
                  <p className="line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">{post.caption.replace(/\{store\}/g, storeName || "our store")}</p>
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    <Button size="sm" onClick={() => usePost(post)}>
                      Use this
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void copyText(`${post.caption.replace(/\{store\}/g, storeName || "our store")}\n${storeUrl}`, "Message and link copied")}
                    >
                      <Copy className="mr-1.5 h-4 w-4" /> Copy
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      </TabsContent>
      <TabsContent value="flyers" className="mt-0 space-y-3">
        <p className="text-sm text-muted-foreground text-pretty">
          Pick a flyer, download it, then copy the ready-made message (with your store link and USSD) to send with it.
        </p>
        {children}
      </TabsContent>
    </Tabs>
  );
}
