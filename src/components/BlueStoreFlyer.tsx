import { useMemo, type ReactNode } from "react";
import { Check, Phone, ShoppingCart, Zap, Search, Gamepad2, MessageSquare } from "lucide-react";
import { FlyerFrame, slug, ussdMessageLines, USSD_CODE, type StoreInfo } from "@/components/FlyerShared";
import type { FlyerPackage, FlyerPackages } from "@/components/DynamicFlyer";
import woman from "@/assets/flyer/blue-flyer-woman.png";
import { SHOW_USSD } from "@/lib/ussdVisibility";

const FONT = "Montserrat, 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
const YELLOW = "#ffd21f";
const NAVY = "#0a2a6e";
const DEEP = "#061a4a";
const W = 1024;
const H = 1536;

export type BlueStoreFlyerProps = StoreInfo & { packages?: FlyerPackages };

const priceText = (value: number) => Number(value).toFixed(2);

const hostOf = (url: string) => (url || "").replace(/^https?:\/\//, "").replace(/\/$/, "");

function NetworkTable({ left, title, headerBg, subBg, list }: { left: number; title: string; headerBg: string; subBg: string; list: FlyerPackage[] }) {
  const rows = [...list].sort((a, b) => a.size_gb - b.size_gb).slice(0, 10);
  return (
    <div style={{ position: "absolute", left, top: 650, width: 236, height: 466, borderRadius: 14, overflow: "hidden", background: "#fff", border: "3px solid #fff", boxSizing: "border-box" }}>
      <div style={{ height: 50, background: headerBg, color: title === "MTN" ? "#0b2a8f" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 900 }}>{title}</div>
      <div style={{ height: 30, background: subBg, color: title === "MTN" ? "#0b2a8f" : "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 14px", fontSize: 15, fontWeight: 800 }}>
        <span>DATA</span>
        <span>PRICE (GHS)</span>
      </div>
      {rows.map((item, index) => (
        <div key={item.size_gb} style={{ height: 38.5, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", fontWeight: 800, fontSize: 24, color: "#0b1d4d", background: index % 2 ? "#eef3ff" : "#fff" }}>
          <span>{item.size_gb}GB</span>
          <span>{priceText(item.price)}</span>
        </div>
      ))}
    </div>
  );
}

function Strip({ top, height, left = 16, width = 992, children, style }: { top: number; height: number; left?: number; width?: number; children: ReactNode; style?: React.CSSProperties }) {
  return <div style={{ position: "absolute", top, left, width, height, boxSizing: "border-box", ...style }}>{children}</div>;
}

const SOCIALS = [
  { name: "TikTok", color: "#111" },
  { name: "Instagram", color: "#c13584" },
  { name: "YouTube", color: "#e60000" },
  { name: "Facebook", color: "#1877f2" },
  { name: "X (Twitter)", color: "#000" },
  { name: "Snapchat", color: "#f2b800" },
];

const SUBSCRIPTIONS = [
  { name: "ChatGPT Pro", color: "#10a37f" },
  { name: "Canva Pro", color: "#7d2ae8" },
  { name: "Netflix", color: "#b20710" },
  { name: "Spotify", color: "#1db954" },
  { name: "CapCut Pro", color: "#1b1b1b" },
  { name: "Crunchyroll", color: "#f47521" },
];

export function BlueStoreFlyer({ storeName, storeUrl, supportNumber, accessCode, packages }: BlueStoreFlyerProps) {
  const name = storeName || "Your Store";
  const host = hostOf(storeUrl) || "your-store-link";
  const nameSize = Math.max(44, Math.min(116, 500 / (name.length * 0.62)));
  const searchSize = Math.max(18, Math.min(30, 430 / (host.length * 0.58)));
  const buttonSize = Math.max(24, Math.min(44, 440 / (name.length * 0.62 + 10)));

  const message = useMemo(
    () => `${name} - get everything you want, all in one place!\nData bundles, AFA registration, airtime, social boost and subscriptions.\nShop here: ${storeUrl || "-"}\nContact: ${supportNumber || "-"}${ussdMessageLines(accessCode).length ? `\n${ussdMessageLines(accessCode).join("\n")}` : ""}`,
    [name, storeUrl, supportNumber, accessCode],
  );

  return (
    <FlyerFrame width={W} height={H} fileName={`${slug(storeName)}-store-flyer`} message={message}>
      <div style={{ position: "relative", width: W, height: H, overflow: "hidden", fontFamily: FONT, color: "#fff", background: `radial-gradient(ellipse at 70% 10%, #1d4fc4 0%, ${NAVY} 45%, ${DEEP} 100%)` }}>
        <img src={woman} alt="" style={{ position: "absolute", right: 0, top: 0, width: 470, height: 470, objectFit: "cover", objectPosition: "50% 30%", WebkitMaskImage: "linear-gradient(90deg, transparent 0%, #000 35%)", maskImage: "linear-gradient(90deg, transparent 0%, #000 35%)" }} />

        <Strip top={22} height={130} left={28} width={640} style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <ShoppingCart size={96} color="#fff" strokeWidth={2.4} style={{ flexShrink: 0 }} />
          <div style={{ fontSize: nameSize, fontWeight: 900, fontStyle: "italic", lineHeight: 1, whiteSpace: "nowrap", color: YELLOW, textShadow: "0 5px 0 #031136" }}>{name}</div>
        </Strip>
        <Strip top={156} height={40} left={28} width={560} style={{ fontSize: 28, fontWeight: 800, fontStyle: "italic", color: YELLOW, display: "flex", alignItems: "center" }}>Fast &bull; Reliable &bull; Secure</Strip>
        <Strip top={204} height={56} left={28} width={260} style={{ background: YELLOW, borderRadius: 28, color: DEEP, fontSize: 28, fontWeight: 900, fontStyle: "italic", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Zap size={26} fill={DEEP} color={DEEP} />24/7 Delivery
        </Strip>
        <Strip top={280} height={60} left={28} width={640} style={{ fontSize: 46, fontWeight: 900, fontStyle: "italic", whiteSpace: "nowrap", textShadow: "0 4px 0 #031136" }}>Get Everything You Want</Strip>
        <Strip top={342} height={86} left={28} width={540} style={{ background: YELLOW, color: "#111", transform: "skewX(-10deg)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 58, fontWeight: 900, fontStyle: "italic", whiteSpace: "nowrap" }}>All in One Place</Strip>
        <Strip top={446} height={64} left={28} width={560} style={{ background: "#fff", border: `3px solid ${YELLOW}`, borderRadius: 32, color: "#0b1d4d", display: "flex", alignItems: "center", gap: 14, padding: "0 20px", fontSize: searchSize, fontWeight: 800, fontStyle: "italic", whiteSpace: "nowrap" }}>
          <Search size={32} color={NAVY} style={{ flexShrink: 0 }} />Just Search {host}
        </Strip>

        {SHOW_USSD ? (
          <Strip top={524} height={76} style={{ background: DEEP, border: `3px solid ${YELLOW}`, borderRadius: 38, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, fontWeight: 900 }}>
              <Phone size={36} color={YELLOW} fill={YELLOW} />USE THIS SITE USSD
            </div>
            <div style={{ background: YELLOW, color: "#111", borderRadius: 30, padding: "4px 28px", fontSize: 50, fontWeight: 900, fontFamily: "monospace" }}>{USSD_CODE}</div>
            <div style={{ textAlign: "center", lineHeight: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: YELLOW }}>Access Code</div>
              <div style={{ fontSize: 50, fontWeight: 900, fontFamily: "monospace" }}>{accessCode || "-"}</div>
            </div>
          </Strip>
        ) : (
          <Strip top={524} height={76} style={{ background: DEEP, border: `3px solid ${YELLOW}`, borderRadius: 38, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 900 }}>Shop online: {host}</Strip>
        )}

        <NetworkTable left={16} title="MTN" headerBg={YELLOW} subBg="#ffe680" list={packages?.mtn ?? []} />
        <NetworkTable left={258} title="TELECEL" headerBg="#d90f0f" subBg="#f04b4b" list={packages?.telecel ?? []} />
        <NetworkTable left={500} title="AirtelTigo" headerBg="#1651d6" subBg="#4a82f0" list={packages?.airteltigo ?? []} />

        <div style={{ position: "absolute", left: 16, top: 606, width: 600, height: 38, display: "flex", alignItems: "center", gap: 12, fontSize: 26, fontWeight: 900, fontStyle: "italic", color: YELLOW }}>DATA BUNDLES <span style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>Choose Your Network</span></div>

        <Strip top={650} height={466} left={750} width={258} style={{ background: `linear-gradient(180deg, #0c3a96, ${DEEP})`, border: `3px solid ${YELLOW}`, borderRadius: 18, padding: "16px 14px" }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: YELLOW, textAlign: "center", lineHeight: 1.1, marginBottom: 14 }}>WHY CHOOSE US?</div>
          {["100% Legit & Trusted", "Instant Delivery", "24/7 Customer Support", "Best Rates in Ghana", "Safe & Secure Payments"].map((text) => (
            <div key={text} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, fontSize: 19, fontWeight: 800, lineHeight: 1.15 }}>
              <span style={{ width: 36, height: 36, borderRadius: 18, background: YELLOW, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Check size={22} color={DEEP} strokeWidth={5} /></span>
              {text}
            </div>
          ))}
        </Strip>

        <Strip top={1132} height={118} style={{ background: "#fff", borderRadius: 18, border: `3px solid ${YELLOW}`, overflow: "hidden" }}>
          <div style={{ height: 40, background: DEEP, color: YELLOW, display: "flex", alignItems: "center", gap: 18, padding: "0 18px", fontSize: 24, fontWeight: 900, fontStyle: "italic" }}>SOCIAL BOOST <span style={{ color: "#fff", fontSize: 17, fontWeight: 700 }}>Grow Your Socials - Boost Your Presence</span></div>
          <div style={{ display: "flex", height: 72 }}>
            {SOCIALS.map((item) => (
              <div key={item.name} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#0b1d4d", lineHeight: 1.1 }}>
                <span style={{ fontSize: 21, fontWeight: 900, color: item.color }}>{item.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Followers &bull; Likes</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>Views</span>
              </div>
            ))}
          </div>
        </Strip>

        <Strip top={1264} height={128} width={640} style={{ background: DEEP, border: `3px solid ${YELLOW}`, borderRadius: 18, padding: "8px 12px" }}>
          <div style={{ fontSize: 24, fontWeight: 900, fontStyle: "italic", color: YELLOW, lineHeight: 1.1 }}>SUBSCRIPTION SERVICES</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Premium Memberships &bull; More Features &bull; Better Experiences</div>
          <div style={{ display: "flex", gap: 8 }}>
            {SUBSCRIPTIONS.map((item) => (
              <div key={item.name} style={{ flex: 1, height: 58, borderRadius: 10, background: item.color, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontSize: 15, fontWeight: 900, lineHeight: 1.1, padding: "0 4px" }}>{item.name}</div>
            ))}
          </div>
        </Strip>

        <Strip top={1264} height={60} left={672} width={336} style={{ background: DEEP, border: `3px solid ${YELLOW}`, borderRadius: 18, display: "flex", alignItems: "center", gap: 12, padding: "0 14px" }}>
          <Gamepad2 size={40} color={YELLOW} style={{ flexShrink: 0 }} />
          <div style={{ lineHeight: 1.1, fontStyle: "italic", fontWeight: 900 }}><div style={{ fontSize: 24, color: YELLOW }}>GAME HUB</div><div style={{ fontSize: 15 }}>Play &amp; Earn Real Money</div></div>
        </Strip>
        <Strip top={1332} height={60} left={672} width={336} style={{ background: DEEP, border: `3px solid ${YELLOW}`, borderRadius: 18, display: "flex", alignItems: "center", gap: 12, padding: "0 14px" }}>
          <MessageSquare size={40} color={YELLOW} style={{ flexShrink: 0 }} />
          <div style={{ lineHeight: 1.1, fontStyle: "italic", fontWeight: 900 }}><div style={{ fontSize: 24, color: YELLOW }}>BULK SMS</div><div style={{ fontSize: 15 }}>Business Messaging</div></div>
        </Strip>

        <Strip top={1406} height={84} width={560} style={{ background: YELLOW, borderRadius: 42, color: "#111", display: "flex", alignItems: "center", gap: 14, padding: "0 26px" }}>
          <ShoppingCart size={46} color="#111" style={{ flexShrink: 0 }} />
          <div style={{ fontSize: buttonSize, fontWeight: 900, fontStyle: "italic", whiteSpace: "nowrap" }}>Order from {name}!</div>
        </Strip>
        <Strip top={1406} height={84} left={592} width={416} style={{ background: "#fff", borderRadius: 18, color: "#0b1d4d", padding: "8px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>MORE SERVICES</div>
          <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.2 }}>Airtime &bull; Data Bundles<br />ECG &bull; Subscription</div>
        </Strip>

        <Strip top={1498} height={34} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 22, fontWeight: 800 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Phone size={22} color={YELLOW} fill={YELLOW} />{supportNumber || "-"}</span>
          <span style={{ color: YELLOW, fontStyle: "italic" }}>Thanks for your support!</span>
        </Strip>
      </div>
    </FlyerFrame>
  );
}
