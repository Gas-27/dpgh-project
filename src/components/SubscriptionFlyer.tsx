import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Check, Crown, Gift, Globe, Headphones, Search, ShieldCheck, ShoppingCart, Star, Tv, Zap } from "lucide-react";
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
import deepl from "@/assets/brands/deepl.svg";
import perplexity from "@/assets/brands/perplexity.svg";
import ilovepdf from "@/assets/brands/ilovepdf.svg";
import coursera from "@/assets/brands/coursera.svg";
import tradingview from "@/assets/brands/tradingview.svg";
import duolingo from "@/assets/brands/duolingo.svg";
import appleMusic from "@/assets/brands/apple-music.svg";

const FONT = "Montserrat, 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
const GOLD = "#ffd21f";

type SubscriptionRow = { id: string; name: string; category: string; price: number; duration: string | null; logo_url?: string | null; service_type?: string | null };

const LOGOS: { test: RegExp; logo: string; invert?: boolean }[] = [
  { test: /apple.?music/i, logo: appleMusic },
  { test: /deepl/i, logo: deepl },
  { test: /perplexity/i, logo: perplexity, invert: true },
  { test: /ilovepdf/i, logo: ilovepdf },
  { test: /coursera/i, logo: coursera },
  { test: /tradingview/i, logo: tradingview, invert: true },
  { test: /duolingo/i, logo: duolingo },
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
      const { data: services } = await (supabase as any).from("digital_services").select("id,name,category,price,duration,logo_url,service_type").eq("archived", false).order("category").order("name");
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
  const nameSize = Math.max(36, Math.min(84, 540 / (name.length * 0.8)));
  const message = useMemo(() => `${name} - your all-in-one subscription hub! Get your favourite subscriptions and gift cards at the best prices in Ghana. Subscribe more, pay less.\nBrowse and buy: ${storeUrl || "-"}\nContact: ${supportNumber || "-"}`, [name, storeUrl, supportNumber]);

  return (
    <FlyerFrame width={1200} height={1312} fileName={`${slug(name)}-subscription-flyer`} message={message}>
      <div style={{ position: "relative", width: 1200, height: 1312, overflow: "hidden", fontFamily: FONT, color: "#fff", background: "radial-gradient(ellipse at 50% 30%, #6a1fd0 0%, #3a0c8a 45%, #1a0645 100%)" }}>
        <div style={{ position: "absolute", inset: 0, background: "repeating-conic-gradient(from 0deg at 50% 25%, rgba(190,120,255,0.10) 0deg 3deg, transparent 3deg 12deg)" }} />
        <div style={flagBand({ left: -120, top: 60, width: 520, transform: "rotate(-34deg)" })} />
        <div style={flagBand({ left: -100, bottom: 40, width: 440, transform: "rotate(18deg)" })} />
        <div style={flagBand({ right: -140, bottom: 20, width: 500, transform: "rotate(-14deg)" })} />
        <div style={{ position: "absolute", right: 30, top: 150, width: 230, height: 190, transform: "rotate(-14deg)", opacity: 0.9 }}>
          {[0, 1, 2].map((i) => <div key={i} style={{ position: "absolute", left: i * 34, top: i * -8, width: 96, height: 176, borderRadius: 16, border: "3px solid #1f2547", background: "linear-gradient(160deg,#2a1d6e,#0a0a22)", boxShadow: "0 6px 14px #00000088", transform: `skewY(${i * 3}deg)` }} />)}
        </div>
        <Star size={70} color="#000" fill="#000" style={{ position: "absolute", left: 30, top: 70 }} />
        <Star size={60} color="#000" fill="#000" style={{ position: "absolute", left: 44, bottom: 40 }} />

        <div style={{ position: "absolute", left: 150, top: 14, width: 180, height: 170 }}>
          <Crown size={64} color={GOLD} fill={GOLD} style={{ position: "absolute", left: 100, top: -4 }} />
          <div style={{ position: "absolute", left: 38, top: 28, width: 82, height: 62, border: `10px solid ${GOLD}`, borderBottom: "none", borderRadius: "41px 41px 0 0", transform: "rotate(-8deg)" }} />
          <div style={{ position: "absolute", left: 10, top: 66, width: 150, height: 100, borderRadius: "14px 14px 30px 30px", background: "linear-gradient(145deg,#ffe35a,#f5a800)", transform: "rotate(-8deg)", boxShadow: "0 0 24px #ffd21f88", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 58, height: 58, borderRadius: 14, background: "#2a0a5e", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ marginLeft: 6, width: 0, height: 0, borderTop: "16px solid transparent", borderBottom: "16px solid transparent", borderLeft: `26px solid ${GOLD}` }} />
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", left: 340, top: 30, width: 560, textAlign: "center" }}>
          <div style={{ fontSize: nameSize, fontWeight: 900, fontStyle: "italic", color: GOLD, lineHeight: 1.05, whiteSpace: "nowrap", textShadow: "0 5px 0 #7c2d12, 0 0 20px #00000099" }}>{name}</div>
          <div style={{ fontSize: 26, fontWeight: 700, fontStyle: "italic", marginTop: 2, whiteSpace: "nowrap" }}>...Your All-in-One Subscription Hub!</div>
        </div>
        <div style={{ position: "absolute", right: 30, top: 28, width: 270, textAlign: "center", transform: "rotate(-8deg)", fontStyle: "italic", fontWeight: 800, lineHeight: 1.05 }}>
          <div style={{ fontSize: 32, whiteSpace: "nowrap" }}>Subscribe More,</div>
          <div style={{ fontSize: 40, color: GOLD, whiteSpace: "nowrap" }}>Pay Less!</div>
        </div>

        <Tab style={{ left: 178, top: 188, width: 784, height: 70, clipPath: "polygon(3% 0, 100% 12%, 97% 100%, 0 88%)", background: `linear-gradient(180deg,#ffe35a,${GOLD})`, color: "#1c1917", fontSize: 30, fontStyle: "normal", textAlign: "center", lineHeight: 1.1, transform: "rotate(-2deg)", boxShadow: "0 6px 14px #00000066" }}>
          <span style={{ fontStyle: "italic", fontWeight: 800 }}>Get your favorite subscriptions &amp; gift cards at the best prices in <span style={{ color: "#dc2626" }}>Ghana!</span></span>
        </Tab>
        <Tab style={{ left: 285, top: 262, width: 590, height: 52, borderRadius: 26, background: "linear-gradient(90deg,#6d28d9,#a855f7)", fontSize: 31, gap: 10, border: "2px solid #c084fc" }}>
          <Gift size={36} color={GOLD} style={{ position: "absolute", left: 20, top: -16 }} />POPULAR SUBSCRIPTIONS
        </Tab>

        {shown.map((service, index) => {
          const brand = LOGOS.find((item) => item.test.test(service.name));
          const col = index % 6;
          const row = Math.floor(index / 6);
          const inRow = Math.min(6, shown.length - row * 6);
          return (
            <div key={service.id} style={{ position: "absolute", left: (1200 - (inRow * 194 - 10)) / 2 + col * 194, top: 318 + row * 148, width: 184, height: 140, boxSizing: "border-box", borderRadius: 22, background: /canva/i.test(service.name) ? "linear-gradient(180deg,#00c4cc,#4d6bf5 60%,#7d2ae8)" : /disney/i.test(service.name) ? "linear-gradient(180deg,#0a1a4a,#050a24)" : "#08040f", border: `3px solid ${CARD_BORDERS[col]}`, boxShadow: `0 0 14px ${CARD_BORDERS[col]}99`, display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 6px 0" }}>
              <div style={{ position: "absolute", top: -2, right: 8, padding: "1px 8px", borderRadius: "0 0 8px 8px", fontSize: 11, fontWeight: 900, letterSpacing: 0.5, background: service.service_type === "private_shared" ? "#16a34a" : "#2563eb", color: "#fff" }}>{service.service_type === "private_shared" ? "PRIVATE" : "SHARED"}</div>
              <div style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {brand
                  ? <img src={brand.logo} alt="" style={{ height: 50, maxWidth: 110, objectFit: "contain", filter: brand.invert ? "invert(1)" : undefined }} />
                  : service.logo_url
                  ? <img src={service.logo_url} alt="" crossOrigin="anonymous" style={{ height: 50, maxWidth: 110, objectFit: "contain" }} />
                  : <div style={{ width: 48, height: 48, borderRadius: 24, background: GOLD, color: "#1c1917", fontSize: 28, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{service.name.charAt(0).toUpperCase()}</div>}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.05, height: 44, display: "flex", alignItems: "center", textAlign: "center" }}>{/canva|disney/i.test(service.name) ? "" : service.name}</div>
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
          <div style={{ position: "absolute", left: 22, top: 140, fontSize: 18, fontWeight: 600, lineHeight: "34px", whiteSpace: "nowrap" }}>
            {["Browse All Services", "Make Purchases", "Manage Your Subscriptions"].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}><GoldCheck size={26} />{item}</div>
            ))}
          </div>
          <div style={{ position: "absolute", right: 8, top: 140, width: 186, padding: "6px 8px", textAlign: "center", background: GOLD, color: "#1c1917", transform: "rotate(-4deg)", fontSize: 27, fontWeight: 900, fontStyle: "italic", lineHeight: 1.02 }}>Visit Our<br />Website<br />Now!</div>
        </div>

        <div style={{ position: "absolute", left: 18, top: 906, width: 584, height: 178, boxSizing: "border-box", borderRadius: 22, border: `3px solid ${GOLD}`, background: "#050308" }}>
          <div style={{ position: "absolute", left: 40, top: -26, padding: "2px 30px", borderRadius: 16, background: GOLD, color: "#1c1917", fontSize: 34, fontWeight: 900, fontStyle: "italic" }}>MORE SERVICES</div>
          <div style={{ position: "absolute", left: 18, top: 30, width: 290 }}>
            {MORE_LEFT.map((item) => <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: item.length > 26 ? 14 : 18, fontWeight: 600, lineHeight: "36px", whiteSpace: "nowrap" }}><GoldCheck size={24} />{item}</div>)}
          </div>
          <div style={{ position: "absolute", left: 318, top: 26, width: 258 }}>
            {MORE_RIGHT.map((item) => <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 600, lineHeight: 1.15, marginBottom: 12 }}><GoldCheck size={24} />{item}</div>)}
          </div>
        </div>

        <div style={{ position: "absolute", left: 618, top: 920, width: 330, height: 130, borderRadius: 65, background: "linear-gradient(180deg,#ff3b3b,#c40d0d)", border: "3px solid #ff9090", boxShadow: "0 8px 18px #00000088", display: "flex", alignItems: "center", gap: 14, padding: "0 20px" }}>
          <ShoppingCart size={54} color="#fff" strokeWidth={2.4} style={{ flexShrink: 0 }} />
          <div style={{ lineHeight: 1.05, whiteSpace: "nowrap" }}>
            <div style={{ fontSize: 38, fontWeight: 900, fontStyle: "italic", color: GOLD }}>Buy Here</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontStyle: "italic" }}>Shop. Pay. Enjoy.</div>
          </div>
        </div>
        <svg width="380" height="110" viewBox="0 0 380 110" style={{ position: "absolute", left: 640, top: 1022 }}>
          <path d="M60 6 C 90 70, 200 84, 280 40" stroke={GOLD} strokeWidth="12" fill="none" strokeLinecap="round" />
          <polygon points="268,6 330,38 266,76" fill={GOLD} />
          <path d="M310 -8 L352 18 L310 44 Z" fill={GOLD} transform="translate(0 -4)" />
        </svg>
        <div style={{ position: "absolute", left: 994, top: 888, width: 188, height: 198, boxSizing: "border-box", borderRadius: 18, border: `4px solid ${GOLD}`, background: "#050308", padding: 6, textAlign: "center" }}>
          <div style={{ width: 166, height: 150, background: "#fff", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>{qr && <img src={qr} alt="" style={{ width: 146, height: 146 }} />}</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 6, lineHeight: 1 }}>Scan to Visit Our Store</div>
        </div>

        <div style={{ position: "absolute", left: 18, top: 1106, width: 1164, height: 112, boxSizing: "border-box", borderRadius: 30, border: `3px solid ${GOLD}`, background: "#050308", display: "flex", alignItems: "center", padding: "0 24px", gap: 20 }}>
          <div style={{ position: "absolute", left: 150, top: -30, padding: "2px 30px", borderRadius: 16, background: GOLD, color: "#1c1917", fontSize: 32, fontWeight: 900, fontStyle: "italic" }}>Contact Us Today!</div>
          <img src={whatsapp} alt="" style={{ width: 84, height: 84 }} />
          <div style={{ fontSize: 44, fontWeight: 800, fontStyle: "italic", whiteSpace: "nowrap", width: 380 }}>{supportNumber || "-"}</div>
          <div style={{ width: 2, height: 80, background: "#ffffff44" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 20, fontWeight: 600, lineHeight: 1.1, whiteSpace: "nowrap" }}><ShieldCheck size={46} color={GOLD} /><span>Secure &amp;<br />Reliable</span></div>
          <div style={{ width: 2, height: 80, background: "#ffffff44" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 20, fontWeight: 600, lineHeight: 1.1, whiteSpace: "nowrap" }}><Zap size={42} color={GOLD} fill={GOLD} /><span>Instant<br />Activation</span></div>
          <div style={{ width: 2, height: 80, background: "#ffffff44" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 20, fontWeight: 600, lineHeight: 1.1, whiteSpace: "nowrap" }}><Headphones size={44} color={GOLD} /><span>24/7<br />Support</span></div>
        </div>

        <div style={{ position: "absolute", right: 24, top: 1236, padding: "6px 36px", background: GOLD, color: "#1c1917", fontSize: 38, fontWeight: 900, fontStyle: "italic", transform: "rotate(-4deg)", boxShadow: "0 4px 10px #00000088" }}>Get it. Enjoy it.</div>
      </div>
    </FlyerFrame>
  );
}
