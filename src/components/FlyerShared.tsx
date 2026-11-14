import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toPng } from "html-to-image";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/montserrat/800.css";
import "@fontsource/montserrat/900.css";
import "@fontsource/montserrat/500-italic.css";
import "@fontsource/montserrat/700-italic.css";
import "@fontsource/montserrat/800-italic.css";
import "@fontsource/montserrat/900-italic.css";
import { Copy, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { SHOW_USSD } from "@/lib/ussdVisibility";

export type StoreInfo = { storeName: string; storeUrl: string; supportNumber: string; storeId?: string; accessCode?: string };

export const USSD_CODE = "*920*337#";

export const ussdMessageLines = (accessCode?: string) => SHOW_USSD ? [`USSD: ${USSD_CODE}`, ...(accessCode ? [`Access Code: ${accessCode}`] : [])] : [];

export const slug = (value: string) => (value || "store").toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function useQrDataUrl(url: string) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    if (!url) { setDataUrl(""); return; }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=8&data=${encodeURIComponent(url)}`);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => { if (!cancelled) setDataUrl(String(reader.result)); };
        reader.readAsDataURL(blob);
      } catch { if (!cancelled) setDataUrl(""); }
    })();
    return () => { cancelled = true; };
  }, [url]);
  return dataUrl;
}

export function FlyerFrame({ width, height, fileName, message, children }: { width: number; height: number; fileName: string; message: string; children: ReactNode }) {
  const { toast } = useToast();
  const flyerRef = useRef<HTMLDivElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const update = () => { if (holderRef.current) setScale(Math.min(1, holderRef.current.clientWidth / width)); };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [width]);

  const render = useCallback(async () => {
    if (!flyerRef.current) throw new Error("Flyer not ready");
    return toPng(flyerRef.current, { pixelRatio: 1, cacheBust: true, width, height, style: { transform: "none", margin: "0" } });
  }, [width, height]);

  const download = async () => {
    setBusy(true);
    try {
      const link = document.createElement("a");
      link.download = `${fileName}.png`;
      link.href = await render();
      link.click();
    } catch { toast({ title: "Could not create flyer", variant: "destructive" }); }
    setBusy(false);
  };

  const copyMessage = async () => { await navigator.clipboard.writeText(message); toast({ title: "Message copied" }); };

  const share = async () => {
    setBusy(true);
    try {
      const blob = await (await fetch(await render())).blob();
      const file = new File([blob], `${fileName}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: message });
      else { await navigator.clipboard.writeText(message); await download(); toast({ title: "Message copied", description: "Flyer downloaded - paste the message when sharing." }); }
    } catch { /* share cancelled */ }
    setBusy(false);
  };

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={download} disabled={busy}><Download className="mr-2 h-4 w-4" />Download PNG</Button>
        <Button onClick={share} disabled={busy}><Share2 className="mr-2 h-4 w-4" />Share</Button>
      </div>
      <div ref={holderRef} className="w-full overflow-hidden rounded-lg border border-border" style={{ height: height * scale }}>
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <div ref={flyerRef} style={{ width, height }}>{children}</div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Share message</p>
          <Button variant="outline" size="sm" onClick={copyMessage}><Copy className="mr-2 h-4 w-4" />Copy</Button>
        </div>
        <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed">{message}</pre>
      </div>
    </Card>
  );
}

