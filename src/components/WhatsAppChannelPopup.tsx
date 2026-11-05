import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    <path d="M3 21l1.65-4.9A9 9 0 1 1 8 19.4L3 21z" />
    <path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1.2-1.4c.2-.3.1-.6-.2-.8l-1.6-.8c-.3-.1-.5 0-.7.2l-.5.6c-1.2-.5-2.2-1.5-2.7-2.7l.6-.5c.2-.2.3-.4.2-.7l-.8-1.6c-.2-.3-.5-.4-.8-.2L9 8.5z" />
  </svg>
);

const CHANNEL_URL = "https://whatsapp.com/channel/0029Vb7ogJx9MF91sU2npr10";
const JOINED_KEY = "jb_whatsapp_channel_joined";
const REMIND_AT_KEY = "jb_whatsapp_channel_remind_at";
const REMIND_DELAY_MS = 10 * 60 * 1000;
const FIRST_SHOW_DELAY_MS = 2000;

const readStorage = (key: string) => {
  try { return window.localStorage.getItem(key); } catch { return null; }
};
const writeStorage = (key: string, value: string) => {
  try { window.localStorage.setItem(key, value); } catch { /* storage unavailable */ }
};

export default function WhatsAppChannelPopup() {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);

  const schedule = useCallback((delay: number) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (readStorage(JOINED_KEY) !== "true") setOpen(true);
    }, delay);
  }, []);

  useEffect(() => {
    if (readStorage(JOINED_KEY) === "true") return;
    const remindAt = Number(readStorage(REMIND_AT_KEY) || 0);
    const wait = Math.max(FIRST_SHOW_DELAY_MS, remindAt - Date.now());
    schedule(wait);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [schedule]);

  const remindLater = () => {
    writeStorage(REMIND_AT_KEY, String(Date.now() + REMIND_DELAY_MS));
    setOpen(false);
    schedule(REMIND_DELAY_MS);
  };

  const markJoined = () => {
    writeStorage(JOINED_KEY, "true");
    if (timer.current) window.clearTimeout(timer.current);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) remindLater(); }}>
      <DialogContent className="max-h-[92vh] max-w-md gap-0 overflow-y-auto rounded-3xl border-0 bg-white p-6 text-[#1a0b3b] [&>button]:hidden">
        <div className="flex items-start justify-between">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#dff5df]">
            <WhatsAppIcon className="h-8 w-8 text-[#4cbb5a]" />
          </div>
          <button type="button" onClick={remindLater} aria-label="Close" className="rounded-full p-1 text-[#8a8a8f] hover:bg-black/5">
            <X className="h-7 w-7" />
          </button>
        </div>
        <DialogTitle className="mt-4 text-center text-[26px] font-extrabold uppercase leading-tight text-[#1a0b3b]">
          {"Don\u2019t miss out! \u{1F680} Join JustBuy on WhatsApp"}
        </DialogTitle>
        <DialogDescription className="mt-3 text-center text-base leading-snug text-black">
          Be the first to know about the latest JustBuy updates, exclusive offers, important announcements and exciting opportunities.
        </DialogDescription>
        <p className="mt-4 text-center text-base leading-snug text-black">
          {"\u{1F381} WEEKLY GIVEAWAYS! Stand a chance to win FREE DATA and CASH by participating in our quizzes and challenges in the channel"}
        </p>
        <p className="mt-4 text-center text-base leading-snug text-black">Join our WhatsApp Channel today and never miss an update!</p>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[#ececee] px-4 py-3">
          <WhatsAppIcon className="h-6 w-6 shrink-0 text-[#4cbb5a]" />
          <span className="text-lg font-bold text-[#1a0b3b]">JustBuygh channel</span>
        </div>
        <a
          href={CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#64c96e] text-xl font-bold text-white hover:bg-[#58bb62]"
        >
          <WhatsAppIcon className="h-6 w-6" />Join Channel Now
        </a>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <button type="button" onClick={markJoined} className="flex flex-col items-center gap-1 rounded-2xl bg-[#ececee] py-4 text-base font-semibold text-[#4cbb5a]">
            <CheckCircle2 className="h-8 w-8" />I&apos;ve Joined
          </button>
          <button type="button" onClick={remindLater} className="flex flex-col items-center gap-1 rounded-2xl bg-[#ececee] py-4 text-base font-semibold text-[#f0a020]">
            <Clock className="h-8 w-8" />Remind Later
          </button>
        </div>
        <p className="mt-4 text-center text-base italic text-[#1a0b3b]">You can change this anytime in settings</p>
      </DialogContent>
    </Dialog>
  );
}
