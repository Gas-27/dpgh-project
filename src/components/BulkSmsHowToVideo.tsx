import { Video } from "lucide-react";

const BULK_SMS_VIDEO_URL = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/bulk-sms-how-to-0vSVKsjiEvqm4WWQr3e04vAwYXgha0.mp4";

export default function BulkSmsHowToVideo() {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
        <Video className="h-5 w-5 text-primary" aria-hidden /> How to send bulk SMS
      </h3>
      <video
        src={BULK_SMS_VIDEO_URL}
        controls
        playsInline
        preload="metadata"
        aria-label="How to send bulk SMS to your customers"
        className="aspect-video w-full rounded-xl bg-black"
      />
    </section>
  );
}
