import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toPng } from "html-to-image";
import { Copy, Download, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { fetchAllRows } from "@/lib/fetchAllRows";

type StoreInfo = { storeName: string; storeUrl: string; supportNumber: string; storeId?: string };

const slug = (value: string) => (value || "store").toLowerCase().replace(/[^a-z0-9]+/g, "-");

function useQrDataUrl(url: string) {
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

function FlyerFrame({ width, height, fileName, message, children }: { width: number; height: number; fileName: string; message: string; children: ReactNode }) {
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

const FONT = "Montserrat, Arial, sans-serif";

type BoostRow = { service_id: number; service_name: string; category: string; base_price_per_1000?: number; admin_price_per_1000?: number; default_price_per_1000?: number; max_reseller_price_per_1000?: number };

const BOOST_PLATFORMS = [
  { name: "TIKTOK", color: "#25f4ee", items: ["Followers", "Likes", "Views", "Comments"] },
  { name: "INSTAGRAM", color: "#e1306c", items: ["Followers", "Likes", "Views", "Comments"] },
  { name: "FACEBOOK", color: "#1877f2", items: ["Followers", "Likes", "Views", "Comments"] },
  { name: "YOUTUBE", color: "#ff0000", items: ["Subscribers", "Likes", "Views", "Comments"] },
  { name: "SNAPCHAT", color: "#fffc00", items: ["Followers", "Likes", "Views", "Comments"] },
  { name: "TELEGRAM", color: "#2aabee", items: ["Followers", "Likes", "Views", "Comments"] },
  { name: "TWITTER", color: "#1d9bf0", items: ["Followers", "Likes", "Views", "Comments"] },
];

const BOOST_PRICE_TYPES: { label: string; match: RegExp }[] = [
  { label: "Followers", match: /follow/i },
  { label: "Likes", match: /like/i },
  { label: "Views", match: /view/i },
  { label: "Comments", match: /comment/i },
];

export function SocialBoostFlyer({ storeName, storeUrl, supportNumber }: StoreInfo) {
  const qr = useQrDataUrl(storeUrl);
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchAllRows<BoostRow>(() => (supabase as any).from("social_boost_service_pricing").select("service_id,service_name,category,admin_price_per_1000,base_price_per_1000,default_price_per_1000,max_reseller_price_per_1000"));
        const { data: auth } = await supabase.auth.getUser();
        const saved = new Map<number, number>();
        if (auth.user) {
          const { data } = await (supabase as any).from("social_boost_reseller_pricing").select("service_id,price_per_1000").eq("user_id", auth.user.id);
          (data ?? []).forEach((item: { service_id: number; price_per_1000: number }) => saved.set(Number(item.service_id), Number(item.price_per_1000)));
        }
        const lowest: Record<string, number> = {};
        (rows ?? []).forEach((row) => {
          const text = `${row.service_name} ${row.category}`;
          if (/subscri/i.test(text)) return;
          const base = Number(row.base_price_per_1000) > 0 ? Number(row.base_price_per_1000) : Number(row.admin_price_per_1000);
          const fallback = Number(row.default_price_per_1000) > 0 ? Number(row.default_price_per_1000) : base;
          const custom = saved.get(Number(row.service_id));
          const valid = custom !== undefined && Number.isFinite(custom) && custom >= base && custom <= Number(row.max_reseller_price_per_1000 || Infinity);
          const price = valid ? custom! : fallback;
          if (!Number.isFinite(price) || price <= 0) return;
          BOOST_PRICE_TYPES.forEach((type) => {
            if (type.match.test(row.service_name) && (lowest[type.label] === undefined || price < lowest[type.label])) lowest[type.label] = price;
          });
        });
        if (!cancelled) setPrices(lowest);
      } catch { if (!cancelled) setPrices({}); }
    })();
    return () => { cancelled = true; };
  }, []);

  const message = useMemo(() => `Boost all your social media accounts with real followers and grow your audience fast! Followers, Likes, Views and Comments for TikTok, Instagram, Facebook, YouTube, Snapchat, Telegram and Twitter. Fast, cheap and real engagement.\nOrder here: ${storeUrl || "-"}\nWhatsApp: ${supportNumber || "-"}`, [storeUrl, supportNumber]);
  const name = storeName || "Your Store";

  return (
    <FlyerFrame width={1024} height={1536} fileName={`${slug(name)}-social-boost-flyer`} message={message}>
      <div style={{ width: 1024, height: 1536, boxSizing: "border-box", padding: 36, fontFamily: FONT, color: "#fff", background: "radial-gradient(circle at 50% 0%, #1d4ed8 0%, #0a1a5c 45%, #050b2e 100%)", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 52, fontWeight: 900, fontStyle: "italic", lineHeight: 1.1, textShadow: "0 0 18px #38bdf8" }}>{name}</div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 4, color: "#38bdf8" }}>SOCIAL MEDIA MARKETING</div>
        </div>
        <div style={{ textAlign: "center", fontWeight: 900, fontStyle: "italic", lineHeight: 1.05, textShadow: "0 0 24px #3b82f6" }}>
          <div style={{ fontSize: 84 }}>Boost Your</div>
          <div style={{ fontSize: 66 }}>Social Media Presence</div>
          <div style={{ fontSize: 96 }}>Instantly!</div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
          {BOOST_PLATFORMS.map((platform) => (
            <div key={platform.name} style={{ width: 178, boxSizing: "border-box", padding: "14px 12px", borderRadius: 18, background: "rgba(2,6,32,0.85)", border: `2px solid ${platform.color}`, boxShadow: `0 0 14px ${platform.color}66` }}>
              <div style={{ fontSize: 20, fontWeight: 900, textAlign: "center", color: platform.color, marginBottom: 8 }}>{platform.name}</div>
              {platform.items.map((item) => <div key={item} style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.5 }}>{"\u2713 "}{item}</div>)}
            </div>
          ))}
          <div style={{ width: 372, boxSizing: "border-box", padding: "12px 16px", borderRadius: 18, background: "rgba(2,6,32,0.9)", border: "2px solid #38bdf8", boxShadow: "0 0 14px #38bdf866" }}>
            <div style={{ fontSize: 20, fontWeight: 900, fontStyle: "italic", textAlign: "center", color: "#38bdf8", marginBottom: 6 }}>SMM SERVICES &amp; PRICE LIST</div>
            {BOOST_PRICE_TYPES.map((type) => (
              <div key={type.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700, lineHeight: 1.5 }}>
                <span>{type.label}</span><span style={{ color: "#facc15" }}>{prices[type.label] !== undefined ? `GH\u20B5${prices[type.label].toFixed(2)} /1000` : "-"}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ textAlign: "center", fontSize: 30, fontWeight: 900, letterSpacing: 2, padding: "10px 0", border: "2px solid #38bdf8", borderRadius: 16, background: "rgba(2,6,32,0.7)" }}>FAST {"\u2022"} CHEAP {"\u2022"} REAL ENGAGEMENT</div>
        <div style={{ display: "flex", gap: 20, alignItems: "stretch", flex: 1 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14, justifyContent: "center" }}>
            <div style={{ borderRadius: 18, border: "2px solid #22c55e", background: "rgba(2,6,32,0.8)", padding: "14px 20px" }}>
              <div style={{ fontSize: 26, fontWeight: 800 }}>WhatsApp:</div>
              <div style={{ fontSize: 38, fontWeight: 900, fontStyle: "italic" }}>{supportNumber || "-"}</div>
            </div>
            <div style={{ borderRadius: 18, border: "2px solid #38bdf8", background: "rgba(2,6,32,0.8)", padding: "14px 20px" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#38bdf8" }}>{name.toUpperCase()} STORE LINK</div>
              <div style={{ marginTop: 8, borderRadius: 10, background: "#fff", color: "#0a1a5c", fontSize: 20, fontWeight: 700, padding: "10px 14px", wordBreak: "break-all" }}>{storeUrl || "-"}</div>
            </div>
          </div>
          <div style={{ width: 270, borderRadius: 18, border: "2px solid #d946ef", background: "rgba(2,6,32,0.85)", padding: 14, textAlign: "center", boxShadow: "0 0 16px #d946ef66" }}>
            <div style={{ fontSize: 24, fontWeight: 900 }}>SCAN TO VISIT</div>
            <div style={{ margin: "8px auto", width: 210, height: 210, background: "#fff", borderRadius: 10, padding: 6, boxSizing: "border-box" }}>
              {qr && <img src={qr} alt="" style={{ width: "100%", height: "100%" }} />}
            </div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>QR CODE</div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-around", fontSize: 20, fontWeight: 800, paddingTop: 4 }}>
          <span>100% SAFE</span><span>FAST DELIVERY</span><span>SATISFACTION GUARANTEED</span>
        </div>
      </div>
    </FlyerFrame>
  );
}

type SubscriptionRow = { id: string; name: string; category: string; price: number; duration: string | null };

export function SubscriptionFlyer({ storeName, storeUrl, supportNumber, storeId }: StoreInfo) {
  const qr = useQrDataUrl(storeUrl);
  const [rows, setRows] = useState<SubscriptionRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: services } = await (supabase as any).from("digital_services").select("id,name,category,price,duration").eq("archived", false).order("category").order("name");
      const priceById = new Map<string, number>();
      if (storeId) {
        const { data: prices } = await (supabase as any).from("agent_service_pricing").select("service_id,sell_price,updated_at").eq("agent_store_id", storeId).order("updated_at", { ascending: false });
        (prices ?? []).forEach((item: { service_id: string; sell_price: number | null }) => { if (item.sell_price != null && Number(item.sell_price) > 0 && !priceById.has(item.service_id)) priceById.set(item.service_id, Number(item.sell_price)); });
      }
      const next = ((services ?? []) as SubscriptionRow[])
        .map((service) => ({ ...service, price: priceById.get(service.id) ?? Number(service.price) }))
        .filter((service) => service.price > 0);
      if (!cancelled) setRows(next);
    })();
    return () => { cancelled = true; };
  }, [storeId]);

  const shown = rows.slice(0, 18);
  const name = storeName || "Your Store";
  const message = useMemo(() => `${name} - your all-in-one subscription hub! Get your favourite subscriptions and gift cards at the best prices in Ghana. Subscribe more, pay less.\nBrowse and buy: ${storeUrl || "-"}\nContact: ${supportNumber || "-"}`, [name, storeUrl, supportNumber]);

  return (
    <FlyerFrame width={1200} height={1312} fileName={`${slug(name)}-subscription-flyer`} message={message}>
      <div style={{ width: 1200, height: 1312, boxSizing: "border-box", padding: 40, fontFamily: FONT, color: "#fff", background: "linear-gradient(135deg, #2a0a5e 0%, #12062e 50%, #3b0a6b 100%)", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 76, fontWeight: 900, fontStyle: "italic", color: "#facc15", lineHeight: 1.1, textShadow: "0 4px 0 #7c2d12" }}>{name}</div>
          <div style={{ fontSize: 28, fontWeight: 700, fontStyle: "italic" }}>...Your All-in-One Subscription Hub!</div>
        </div>
        <div style={{ textAlign: "center", fontSize: 28, fontWeight: 800, color: "#1c1917", background: "#facc15", borderRadius: 40, padding: "12px 24px" }}>Get your favorite subscriptions &amp; gift cards at the best prices in Ghana!</div>
        <div style={{ textAlign: "center", fontSize: 30, fontWeight: 900, fontStyle: "italic", color: "#fff" }}>POPULAR SUBSCRIPTIONS</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", alignContent: "flex-start", minHeight: 400 }}>
          {shown.map((service) => (
            <div key={service.id} style={{ width: 174, boxSizing: "border-box", borderRadius: 16, background: "rgba(0,0,0,0.65)", border: "2px solid rgba(250,204,21,0.5)", padding: "12px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15, minHeight: 46, display: "flex", alignItems: "center", justifyContent: "center" }}>{service.name}</div>
              <div style={{ marginTop: 8, borderRadius: 10, background: "#facc15", color: "#1c1917", fontSize: 22, fontWeight: 900, padding: "6px 4px" }}>GHC {Number(service.price).toFixed(2)}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#facc15", marginTop: 4 }}>{service.duration ? `/${service.duration}` : "/month"}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "stretch" }}>
          <div style={{ flex: 1, borderRadius: 20, border: "3px solid #a855f7", background: "rgba(0,0,0,0.6)", padding: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#facc15", fontStyle: "italic" }}>OUR URL SECTION</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 6 }}>Search, Buy &amp; Manage All Your Subscriptions Online!</div>
            <div style={{ marginTop: 12, borderRadius: 12, background: "#fff", color: "#1e1b4b", fontSize: 24, fontWeight: 800, padding: "12px 16px", wordBreak: "break-all" }}>{storeUrl || "-"}</div>
            <div style={{ marginTop: 12, fontSize: 20, fontWeight: 700, lineHeight: 1.6 }}>{"\u2713 Browse All Services"}<br />{"\u2713 Make Purchases"}<br />{"\u2713 Manage Your Subscriptions"}</div>
          </div>
          <div style={{ width: 260, borderRadius: 20, background: "#facc15", color: "#1c1917", padding: 14, textAlign: "center" }}>
            <div style={{ width: 220, height: 220, margin: "0 auto", background: "#fff", borderRadius: 10, padding: 6, boxSizing: "border-box" }}>{qr && <img src={qr} alt="" style={{ width: "100%", height: "100%" }} />}</div>
            <div style={{ fontSize: 20, fontWeight: 900, marginTop: 8 }}>Scan to Visit Our Store</div>
          </div>
        </div>
        <div style={{ borderRadius: 40, border: "3px solid #facc15", background: "rgba(0,0,0,0.75)", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#facc15" }}>Contact Us Today!</div>
            <div style={{ fontSize: 46, fontWeight: 900, fontStyle: "italic" }}>{supportNumber || "-"}</div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, textAlign: "right", lineHeight: 1.4 }}>Secure &amp; Reliable<br />Instant Activation<br />24/7 Support</div>
        </div>
      </div>
    </FlyerFrame>
  );
}

export default function FlyerTabs({ children, ...store }: StoreInfo & { children: ReactNode }) {
  return (
    <Tabs defaultValue="data" className="space-y-4">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="data">Data Flyer</TabsTrigger>
        <TabsTrigger value="social">Social Boost</TabsTrigger>
        <TabsTrigger value="subscription">Subscription</TabsTrigger>
      </TabsList>
      <TabsContent value="data" className="mt-0">{children}</TabsContent>
      <TabsContent value="social" className="mt-0"><SocialBoostFlyer {...store} /></TabsContent>
      <TabsContent value="subscription" className="mt-0"><SubscriptionFlyer {...store} /></TabsContent>
    </Tabs>
  );
}
