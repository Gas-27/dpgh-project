import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

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
      <DialogContent className="max-w-sm rounded-3xl p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366]/15">
          <MessageCircle className="h-7 w-7 text-[#25D366]" aria-hidden="true" />
        </div>
        <DialogTitle className="text-xl font-bold">Join Our WhatsApp Channel!</DialogTitle>
        <DialogDescription className="leading-relaxed">
          Get instant updates, announcements, price changes and exclusive offers directly on WhatsApp. Do not miss out.
        </DialogDescription>
        <Button asChild className="h-12 w-full rounded-xl bg-[#25D366] text-base font-semibold text-black hover:bg-[#20bd5a]">
          <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-5 w-5" />Join Channel Now</a>
        </Button>
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" className="h-auto flex-col gap-1 rounded-xl py-3 text-emerald-500" onClick={markJoined}>
            <CheckCircle2 className="h-5 w-5" />I have joined
          </Button>
          <Button type="button" variant="secondary" className="h-auto flex-col gap-1 rounded-xl py-3 text-amber-500" onClick={remindLater}>
            <Clock className="h-5 w-5" />Remind me later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
