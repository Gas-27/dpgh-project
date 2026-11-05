import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Check, Gift, Globe, Headphones, Search, ShieldCheck, ShoppingCart, Star, Tv, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FlyerFrame, slug, useQrDataUrl, type StoreInfo } from "@/components/FlyerShared";
import whatsapp from "@/assets/brands/whatsapp.svg";
import netflix from "@/assets/brands/netflix.svg";
import spotify from "@/assets/brands/spotify.svg";
import youtube from "@/assets/brands/youtube.svg";
import canva from "@/assets/brands/canva.svg";
import disney from "@/assets/brands/disney-plus.svg";
import prime from "@/assets/brands/prime-video.svg";
import icloud from "@/assets/brands/icloud.svg";
import googleOne from "@/assets/brands/google-one.svg";
import openai from "@/assets/brands/openai.svg";
import crunchyroll from "@/assets/brands/crunchyroll.svg";
import adobe from "@/assets/brands/adobe-creative-cloud.svg";
import microsoft from "@/assets/brands/microsoft.svg";

const FONT = "Montserrat, 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
const GOLD = "#ffd21f";

type SubscriptionRow = { id: string; name: string; category: string; price: number; duration: string | null };

const LOGOS: { test: RegExp; logo: string; invert?: boolean }[] = [
  { test: /netflix/i, logo: netflix },
  { test: /spotify/i, logo: spotify },
  { test: /youtube/i, logo: youtube },
  { test: /canva/i, logo: canva },
  { test: /disney/i, logo: disney },
  { test: /prime|amazon/i, logo: prime },
  { test: /icloud/i, logo: icloud },
  { test: /google/i, logo: googleOne },
  { test: /chatgpt|openai/i, logo: openai, invert: true },
  { test: /crunchyroll/i, logo: crunchyroll },
  { test: /adobe/i, logo: adobe },
  { test: /microsoft|office|windows/i, logo: microsoft },
];

const CARD_BORDERS = ["#d946ef", "#22c55e", "#ef4444", "#22d3ee", "#3b82f6", "#a855f7"];

const priceText = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

const MORE_LEFT = ["Netflix Gift Cards", "Google Play Gift Cards", "Steam Wallet Top-Up", "VPN Services (NordVPN, Surfshark)"];
const MORE_RIGHT = ["Software & Tools (Windows, Office, etc.)", "International Airtime & Data", "Utility Bill Payments (ECG, Water, etc.)"];

const GoldCheck = ({ size = 28 }: { size?: number }) => (
  <span style={{ width: size, height: size, borderRadius: size / 2, background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <Check size={size * 0.68} color="#1c1917" strokeWidth={4} />
  </span>
);

const Tab = ({ children, style }: { children: ReactNode; style: CSSProperties }) => (
  <div style={{ position: "absolute", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontStyle: "italic", ...style }}>{children}</div>
);

const flagBand = (style: CSSProperties): CSSProperties => ({
  position: "absolute", height: 110, background: "linear-gradient(180deg,#d62828 0 33%,#ffd21f 33% 66%,#0a8f3c 66% 100%)", boxShadow: "0 0 18px rgba(0,0,0,0.5)", ...style,
});

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

  const shown = rows.slice(0, 12);
  const name = storeName || "Your Store";
  const nameSize = name.length > 22 ? 48 : name.length > 14 ? 64 : 84;
  const message = useMemo(() => `${name} - your all-in-one subscription hub! Get your favourite subscriptions and gift cards at the best prices in Ghana. Subscribe more, pay less.\nBrowse and buy: ${storeUrl || "-"}\nContact: ${supportNumber || "-"}`, [name, storeUrl, supportNumber]);

  return (
    <FlyerFrame width={1200} height={1312} fileName={`${slug(name)}-subscription-flyer`} message={message}>
      <div style={{ position: "relative", width: 1200, height: 1312, overflow: "hidden", fontFamily: FONT, color: "#fff", background: "radial-gradient(ellipse at 50% 30%, #6a1fd0 0%, #3a0c8a 45%, #1a0645 100%)" }}>
        <div style={{ position: "absolute", inset: 0, background: "repeating-conic-gradient(from 0deg at 50% 25%, rgba(190,120,255,0.10) 0deg 3deg, transparent 3deg 12deg)" }} />
        <div style={flagBand({ left: -120, top: 60, width: 520, transform: "rotate(-34deg)" })} />
        <div style={flagBand({ left: -100, bottom: 40, width: 440, transform: "rotate(18deg)" })} />
        <div style={flagBand({ right: -140, bottom: 20, width: 500, transform: "rotate(-14deg)" })} />
        <Star size={70} color="#000" fill="#000" style={{ position: "absolute", left: 30, top: 70 }} />
        <Star size={60} color="#000" fill="#000" style={{ position: "absolute", left: 44, bottom: 40 }} />

        <div style={{ position: "absolute", left: 170, top: 28, width: 140, height: 140, borderRadius: 30, background: `linear-gradient(145deg,#ffe35a,#f5a800)`, display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(-6deg)", boxShadow: "0 0 24px #ffd21f88" }}>
          <ShoppingCart size={84} color="#2a0a5e" strokeWidth={2.5} />
        </div>
        <div style={{ position: "absolute", left: 340, top: 30, width: 560, textAlign: "center" }}>
          <div style={{ fontSize: nameSize, fontWeight: 900, fontStyle: "italic", color: GOLD, lineHeight: 1.05, whiteSpace: "nowrap", textShadow: "0 5px 0 #7c2d12, 0 0 20px #00000099" }}>{name}</div>
          <div style={{ fontSize: 30, fontWeight: 700, fontStyle: "italic", marginTop: 2 }}>...Your All-in-One Subscription Hub!</div>
        </div>
        <div style={{ position: "absolute", right: 36, top: 24, width: 260, textAlign: "center", transform: "rotate(-8deg)", fontStyle: "italic", fontWeight: 800, lineHeight: 1.05 }}>
          <div style={{ fontSize: 44 }}>Subscribe More,</div>
          <div style={{ fontSize: 50, color: GOLD }}>Pay Less!</div>
        </div>

        <Tab style={{ left: 178, top: 188, width: 784, height: 70, borderRadius: 35, background: `linear-gradient(180deg,#ffe35a,${GOLD})`, color: "#1c1917", fontSize: 30, fontStyle: "normal", textAlign: "center", lineHeight: 1.1, transform: "rotate(-2deg)", boxShadow: "0 6px 14px #00000066" }}>
          <span style={{ fontStyle: "italic", fontWeight: 800 }}>Get your favorite subscriptions &amp; gift cards at the best prices in <span style={{ color: "#dc2626" }}>Ghana!</span></span>
        </Tab>
        <Tab style={{ left: 285, top: 262, width: 590, height: 52, borderRadius: 26, background: "linear-gradient(90deg,#6d28d9,#a855f7)", fontSize: 31, gap: 10, border: "2px solid #c084fc" }}>
          <Gift size={36} color={GOLD} style={{ position: "absolute", left: 20, top: -16 }} />POPULAR SUBSCRIPTIONS
        </Tab>

        {shown.map((service, index) => {
          const brand = LOGOS.find((item) => item.test.test(service.name));
          const col = index % 6;
          const row = Math.floor(index / 6);
          return (
            <div key={service.id} style={{ position: "absolute", left: 24 + col * 194, top: 318 + row * 148, width: 184, height: 140, boxSizing: "border-box", borderRadius: 22, background: "#08040f", border: `3px solid ${CARD_BORDERS[col]}`, boxShadow: `0 0 14px ${CARD_BORDERS[col]}99`, display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 6px 0" }}>
              <div style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {brand
                  ? <img src={brand.logo} alt="" style={{ height: 50, maxWidth: 110, objectFit: "contain", filter: brand.invert ? "invert(1)" : undefined }} />
                  : <div style={{ width: 48, height: 48, borderRadius: 24, background: GOLD, color: "#1c1917", fontSize: 28, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{service.name.charAt(0).toUpperCase()}</div>}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.05, height: 44, display: "flex", alignItems: "center", textAlign: "center" }}>{service.name}</div>
              <div style={{ width: 160, borderRadius: 14, background: `linear-gradient(180deg,#ffe35a,${GOLD})`, color: "#1c1917", textAlign: "center", padding: "2px 0 3px", lineHeight: 1 }}>
                <div style={{ fontSize: 26, fontWeight: 900 }}>GHC {priceText(Number(service.price))}</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>/{service.duration || "month"}</div>
              </div>
            </div>
          );
        })}

        <div style={{ position: "absolute", left: 16, top: 624, width: 620, height: 250, boxSizing: "border-box", borderRadius: 24, border: `3px solid ${GOLD}`, background: "linear-gradient(135deg,#0a1f7a,#1744d0)", boxShadow: "0 0 18px #ffd21f66" }}>
          <div style={{ position: "absolute", left: 100, top: -26, padding: "2px 36px", borderRadius: 16, background: GOLD, color: "#1c1917", fontSize: 36, fontWeight: 900, fontStyle: "italic" }}>TV SUBSCRIPTIONS</div>
          <div style={{ position: "absolute", left: 30, top: 56 }}>
            <div style={{ fontSize: 78, fontWeight: 900, lineHeight: 1 }}>DStv</div>
            <div style={{ fontSize: 34, fontWeight: 800, fontStyle: "italic" }}>They Dey <span style={{ color: GOLD }}>Here</span></div>
          </div>
          <Tv size={90} color="#ffffff55" style={{ position: "absolute", left: 40, bottom: 12 }} />
          <div style={{ position: "absolute", left: 340, top: 40, bottom: 30, width: 3, background: GOLD }} />
          <div style={{ position: "absolute", left: 370, top: 36, textAlign: "center", width: 230 }}>
            <div style={{ fontSize: 36, fontWeight: 800 }}>StarTimes</div>
            <div style={{ fontSize: 26, fontWeight: 800, fontStyle: "italic" }}>They Dey <span style={{ color: GOLD }}>Here</span></div>
            <div style={{ fontSize: 60, fontWeight: 900, color: GOLD, lineHeight: 1.1, marginTop: 6 }}>GOtv</div>
            <div style={{ fontSize: 26, fontWeight: 800, fontStyle: "italic" }}>They Dey <span style={{ color: GOLD }}>Here</span></div>
          </div>
        </div>

        <div style={{ position: "absolute", left: 648, top: 628, width: 540, height: 246, boxSizing: "border-box", borderRadius: 24, border: "3px solid #a855f7", background: "rgba(8,4,24,0.92)" }}>
          <div style={{ position: "absolute", left: 60, top: -22, width: 400, height: 46, borderRadius: 23, background: "linear-gradient(90deg,#6d28d9,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 900, fontStyle: "italic" }}>OUR URL SECTION</div>
          <div style={{ position: "absolute", left: 20, top: 34, right: 20, textAlign: "center", fontSize: 20, fontWeight: 600, fontStyle: "italic" }}>Search, Buy &amp; Manage <span style={{ color: GOLD }}>All Your Subscriptions Online!</span></div>
          <div style={{ position: "absolute", left: 18, right: 18, top: 70, height: 56, borderRadius: 28, background: "#fff", display: "flex", alignItems: "center", overflow: "hidden" }}>
            <Globe size={34} color="#2563eb" style={{ marginLeft: 14 }} />
            <div style={{ flex: 1, minWidth: 0, margin: "0 10px", fontSize: 24, fontWeight: 700, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{storeUrl || "-"}</div>
            <div style={{ width: 80, height: "100%", background: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center" }}><Search size={32} color="#fff" /></div>
          </div>
          <div style={{ position: "absolute", left: 24, top: 140, fontSize: 22, fontWeight: 600, lineHeight: "34px" }}>
            {["Browse All Services", "Make Purchases", "Manage Your Subscriptions"].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}><GoldCheck size={26} />{item}</div>
            ))}
          </div>
          <div style={{ position: "absolute", right: 8, top: 148, width: 230, padding: "6px 10px", textAlign: "center", background: GOLD, color: "#1c1917", transform: "rotate(-4deg)", fontSize: 32, fontWeight: 900, fontStyle: "italic", lineHeight: 1 }}>Visit Our Website Now!</div>
        </div>

        <div style={{ position: "absolute", left: 18, top: 906, width: 584, height: 178, boxSizing: "border-box", borderRadius: 22, border: `3px solid ${GOLD}`, background: "#050308" }}>
          <div style={{ position: "absolute", left: 40, top: -26, padding: "2px 30px", borderRadius: 16, background: GOLD, color: "#1c1917", fontSize: 34, fontWeight: 900, fontStyle: "italic" }}>MORE SERVICES</div>
          <div style={{ position: "absolute", left: 22, top: 30, width: 270 }}>
            {MORE_LEFT.map((item) => <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: item.length > 26 ? 17 : 22, fontWeight: 600, lineHeight: "36px" }}><GoldCheck size={26} />{item}</div>)}
          </div>
          <div style={{ position: "absolute", left: 304, top: 26, width: 270 }}>
            {MORE_RIGHT.map((item) => <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 18, fontWeight: 600, lineHeight: 1.15, marginBottom: 12 }}><GoldCheck size={26} />{item}</div>)}
          </div>
        </div>

        <div style={{ position: "absolute", left: 618, top: 920, width: 330, height: 130, borderRadius: 65, background: "linear-gradient(180deg,#ff3b3b,#c40d0d)", border: "3px solid #ff9090", boxShadow: "0 8px 18px #00000088", display: "flex", alignItems: "center", gap: 14, padding: "0 20px" }}>
          <ShoppingCart size={64} color="#fff" strokeWidth={2.4} />
          <div style={{ lineHeight: 1.05 }}>
            <div style={{ fontSize: 46, fontWeight: 900, fontStyle: "italic", color: GOLD }}>Buy Here</div>
            <div style={{ fontSize: 22, fontWeight: 600, fontStyle: "italic" }}>Shop. Pay. Enjoy.</div>
          </div>
        </div>
        <div style={{ position: "absolute", left: 700, top: 1030, width: 210, height: 60, borderBottom: `8px solid ${GOLD}`, borderRadius: "0 0 120px 120px", transform: "rotate(-6deg)" }} />
        <div style={{ position: "absolute", left: 944, top: 960, width: 0, height: 0, borderTop: "28px solid transparent", borderBottom: "28px solid transparent", borderLeft: `46px solid ${GOLD}` }} />

        <div style={{ position: "absolute", left: 994, top: 888, width: 188, height: 198, boxSizing: "border-box", borderRadius: 18, border: `4px solid ${GOLD}`, background: "#050308", padding: 6, textAlign: "center" }}>
          <div style={{ width: 166, height: 150, background: "#fff", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>{qr && <img src={qr} alt="" style={{ width: 146, height: 146 }} />}</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 6, lineHeight: 1 }}>Scan to Visit Our Store</div>
        </div>

        <div style={{ position: "absolute", left: 18, top: 1106, width: 1164, height: 112, boxSizing: "border-box", borderRadius: 30, border: `3px solid ${GOLD}`, background: "#050308", display: "flex", alignItems: "center", padding: "0 24px", gap: 20 }}>
          <div style={{ position: "absolute", left: 150, top: -30, padding: "2px 30px", borderRadius: 16, background: GOLD, color: "#1c1917", fontSize: 32, fontWeight: 900, fontStyle: "italic" }}>Contact Us Today!</div>
          <img src={whatsapp} alt="" style={{ width: 84, height: 84 }} />
          <div style={{ fontSize: 56, fontWeight: 800, fontStyle: "italic", whiteSpace: "nowrap", width: 470 }}>{supportNumber || "-"}</div>
          <div style={{ width: 2, height: 80, background: "#ffffff44" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22, fontWeight: 600, lineHeight: 1.1 }}><ShieldCheck size={56} color={GOLD} />Secure &amp;<br />Reliable</div>
          <div style={{ width: 2, height: 80, background: "#ffffff44" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22, fontWeight: 600, lineHeight: 1.1 }}><Zap size={50} color={GOLD} fill={GOLD} />Instant<br />Activation</div>
          <div style={{ width: 2, height: 80, background: "#ffffff44" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22, fontWeight: 600, lineHeight: 1.1 }}><Headphones size={54} color={GOLD} />24/7<br />Support</div>
        </div>

        <div style={{ position: "absolute", right: 24, top: 1236, padding: "6px 36px", background: GOLD, color: "#1c1917", fontSize: 38, fontWeight: 900, fontStyle: "italic", transform: "rotate(-4deg)", boxShadow: "0 4px 10px #00000088" }}>Get it. Enjoy it.</div>
      </div>
    </FlyerFrame>
  );
}
