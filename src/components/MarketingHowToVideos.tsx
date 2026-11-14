import { Video } from "lucide-react";
import BulkSmsHowToVideo from "@/components/BulkSmsHowToVideo";

const SOCIAL_VIDEO_URL = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/sell-on-instagram-facebook-tiktok-0DiJo5cjT2SWZ1zoeEbUfmhVhzKoK3.mp4";

function VideoCard({ title, src, label }: { title: string; src: string; label: string }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
        <Video className="h-5 w-5 text-primary" aria-hidden /> {title}
      </h3>
      <video src={src} controls playsInline preload="metadata" aria-label={label} className="aspect-video w-full rounded-xl bg-black" />
    </section>
  );
}

export default function MarketingHowToVideos() {
  return (
    <div className="space-y-4">
      <VideoCard
        title="How to market on WhatsApp"
        src="/videos/get-your-first-customers-dataplug.mp4"
        label="How to market on WhatsApp and get your first customers"
      />
      <VideoCard
        title="How to promote on TikTok, Instagram and Facebook"
        src={SOCIAL_VIDEO_URL}
        label="How to sell and promote on TikTok, Instagram and Facebook"
      />
      <BulkSmsHowToVideo />
    </div>
  );
}
