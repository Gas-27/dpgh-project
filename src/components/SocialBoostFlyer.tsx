import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { BadgeCheck, Check, ChevronRight, Heart, Link2, MessageCircle, Play, ShieldCheck, User, Users, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { FlyerFrame, slug, useQrDataUrl, type StoreInfo } from "@/components/FlyerShared";
import tiktok from "@/assets/brands/tiktok.svg";
import instagram from "@/assets/brands/instagram.svg";
import facebook from "@/assets/brands/facebook.svg";
import youtube from "@/assets/brands/youtube.svg";
import snapchat from "@/assets/brands/snapchat.svg";
import telegram from "@/assets/brands/telegram.svg";
import twitter from "@/assets/brands/twitter.svg";
import whatsapp from "@/assets/brands/whatsapp.svg";

const FONT = "Montserrat, 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
const NAVY = "rgba(4,10,48,0.88)";

type BoostRow = { service_id: number; service_name: string; category: string; base_price_per_1000?: number; admin_price_per_1000?: number; default_price_per_1000?: number; max_reseller_price_per_1000?: number };

type Platform = { name: string; logo: string; items: string[]; border: string; glow: string; bg?: string; logoStyle?: CSSProperties; tile?: string };

const STD = ["Followers", "Likes", "Views", "Comments"];
const PLATFORMS: Platform[] = [
  { name: "TIKTOK", logo: tiktok, items: STD, border: "#2b4fd8", glow: "#3b6cff", logoStyle: { filter: "invert(1) hue-rotate(180deg)" } },
  { name: "INSTAGRAM", logo: instagram, items: STD, border: "#c026d3", glow: "#d946ef" },
  { name: "FACEBOOK", logo: facebook, items: STD, border: "#2f6bff", glow: "#3b82f6" },
  { name: "YOUTUBE", logo: youtube, items: ["Subscribers", "Likes", "Views", "Comments"], border: "#ef2b2b", glow: "#ef4444", bg: "rgba(58,6,22,0.9)" },
  { name: "SNAPCHAT", logo: snapchat, items: STD, border: "#f5b82e", glow: "#f5b82e", bg: "rgba(36,24,14,0.9)", tile: "#fffc00" },
  { name: "TELEGRAM", logo: telegram, items: STD, border: "#2f8cff", glow: "#2f8cff" },
  { name: "TWITTER", logo: twitter, items: STD, border: "#2f8cff", glow: "#2f8cff" },
];

const PRICE_TYPES: { label: string; test: (name: string, text: string) => boolean }[] = [
  { label: "Followers", test: (name) => /follow/i.test(name) },
  { label: "Likes", test: (name) => /like/i.test(name) },
  { label: "Views", test: (name) => /view/i.test(name) },
  { label: "Comments", test: (name) => /comment/i.test(name) },
  { label: "YouTube Subscribers", test: (name, text) => /subscriber/i.test(name) && /youtube/i.test(text) },
];

const money = (value: number | undefined) => (value === undefined ? "-" : `GH\u20B5${Number.isInteger(value) ? value : value.toFixed(2)}`);

const CheckDot = () => (
  <span style={{ width: 24, height: 24, borderRadius: 12, background: "#2f86ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 8px #2f86ff" }}>
    <Check size={16} color="#fff" strokeWidth={4} />
  </span>
);

const glowBox = (border: string, glow: string, bg = NAVY): CSSProperties => ({
  boxSizing: "border-box", border: `2.5px solid ${border}`, borderRadius: 22, background: bg, boxShadow: `0 0 18px ${glow}99, inset 0 0 14px ${glow}33`,
});

function PlatformCard({ platform, style }: { platform: Platform; style: CSSProperties }) {
  return (
    <div style={{ ...glowBox(platform.border, platform.glow, platform.bg), position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 10px 0", ...style }}>
      {platform.tile ? (
        <div style={{ width: 84, height: 84, borderRadius: 22, background: platform.tile, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src={platform.logo} alt="" style={{ width: 62, height: 62 }} />
        </div>
      ) : (
        <img src={platform.logo} alt="" style={{ width: platform.name === "YOUTUBE" ? 100 : 84, height: 84, objectFit: "contain", ...platform.logoStyle }} />
      )}
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, marginBottom: 6, letterSpacing: 0.3, whiteSpace: "nowrap" }}>{platform.name}</div>
      <div style={{ alignSelf: "stretch", paddingLeft: 6 }}>
        {platform.items.map((item) => (
          <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 20, fontWeight: 500, lineHeight: "27px", whiteSpace: "nowrap" }}><CheckDot />{item}</div>
        ))}
      </div>
    </div>
  );
}

function PriceRow({ icon, label, price }: { icon: ReactNode; label: string; price: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, height: 50 }}>
      <span style={{ width: 40, display: "flex", justifyContent: "center", flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 19, fontWeight: 500, lineHeight: 1.05 }}>{label}</span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1, flexShrink: 0 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: "#facc15", whiteSpace: "nowrap" }}>{price}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#9cc2ff", marginTop: 2 }}>per 1K</span>
      </span>
    </div>
  );
}

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
          const youtubeSubscribers = PRICE_TYPES[4].test(row.service_name, text);
          if (!youtubeSubscribers && /subscri/i.test(text)) return;
          const base = Number(row.base_price_per_1000) > 0 ? Number(row.base_price_per_1000) : Number(row.admin_price_per_1000);
          const fallback = Number(row.default_price_per_1000) > 0 ? Number(row.default_price_per_1000) : base;
          const custom = saved.get(Number(row.service_id));
          const valid = custom !== undefined && Number.isFinite(custom) && custom >= base && custom <= Number(row.max_reseller_price_per_1000 || Infinity);
          const price = valid ? custom! : fallback;
          if (!Number.isFinite(price) || price <= 0) return;
          PRICE_TYPES.forEach((type) => {
            if (type.test(row.service_name, text) && (lowest[type.label] === undefined || price < lowest[type.label])) lowest[type.label] = price;
          });
        });
        if (!cancelled) setPrices(lowest);
      } catch { if (!cancelled) setPrices({}); }
    })();
    return () => { cancelled = true; };
  }, []);

  const name = storeName || "Your Store";
  const message = useMemo(() => `Boost all your social media accounts with real followers and grow your audience fast! Followers, Likes, Views and Comments for TikTok, Instagram, Facebook, YouTube, Snapchat, Telegram and Twitter. Prices are per 1K (1,000). Fast, cheap and real engagement.\nOrder here: ${storeUrl || "-"}\nWhatsApp: ${supportNumber || "-"}`, [storeUrl, supportNumber]);
  const nameSize = name.length > 22 ? 36 : name.length > 14 ? 48 : 62;
  const bubble: CSSProperties = { position: "absolute", top: 30, width: 128, height: 104, borderRadius: 26, background: "linear-gradient(145deg,#3b8bff,#1747d6)", border: "3px solid #7fb4ff", boxShadow: "0 0 26px #3b82f6, inset 0 0 18px #ffffff44", display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <FlyerFrame width={1024} height={1536} fileName={`${slug(name)}-social-boost-flyer`} message={message}>
      <div style={{ position: "relative", width: 1024, height: 1536, overflow: "hidden", fontFamily: FONT, color: "#fff", background: "radial-gradient(ellipse at 50% 14%, #2a63ff 0%, #0c2fb8 30%, #07196a 58%, #030a30 100%)" }}>
        <div style={{ position: "absolute", inset: 0, background: "repeating-conic-gradient(from 0deg at 50% 16%, rgba(120,180,255,0.13) 0deg 2.5deg, transparent 2.5deg 11deg)" }} />
        <div style={{ position: "absolute", left: -120, top: 330, width: 520, height: 6, transform: "rotate(-24deg)", background: "linear-gradient(90deg, transparent, #4aa3ff)", boxShadow: "0 0 18px #4aa3ff" }} />
        <div style={{ position: "absolute", right: -120, top: 330, width: 520, height: 6, transform: "rotate(24deg)", background: "linear-gradient(270deg, transparent, #4aa3ff)", boxShadow: "0 0 18px #4aa3ff" }} />

        <div style={{ ...bubble, left: 42, transform: "rotate(-12deg)" }}><Heart size={64} color="#fff" fill="#fff" /></div>
        <div style={{ ...bubble, right: 42, transform: "rotate(12deg)" }}><User size={64} color="#fff" fill="#fff" /></div>

        <div style={{ position: "absolute", top: 20, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 18 }}>
          <div style={{ fontSize: 96, fontWeight: 900, fontStyle: "italic", lineHeight: 1, color: "#2a8cff", textShadow: "0 0 18px #2a8cff, 4px 4px 0 #0b3aa8" }}>{name.charAt(0).toUpperCase()}</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", maxWidth: 560 }}>
            <div style={{ fontSize: nameSize, fontWeight: 800, fontStyle: "italic", lineHeight: 1, whiteSpace: "nowrap", textShadow: "0 0 14px #5aa8ff" }}>{name}</div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 5, color: "#27d3ff", marginTop: 4 }}>SOCIAL MEDIA MARKETING</div>
          </div>
        </div>

        <div style={{ position: "absolute", top: 118, left: 0, right: 0, textAlign: "center", fontWeight: 900, fontStyle: "italic", lineHeight: 0.98, textShadow: "0 5px 0 #1b47c8, 0 0 34px #3b82f6" }}>
          <div style={{ fontSize: 104 }}>Boost Your</div>
          <div style={{ fontSize: 74 }}>Social Media Presence</div>
          <div style={{ fontSize: 112 }}>Instantly!</div>
        </div>

        {PLATFORMS.slice(0, 5).map((platform, index) => (
          <PlatformCard key={platform.name} platform={platform} style={{ left: 18 + index * 201, top: 400, width: 188, height: 262 }} />
        ))}
        <PlatformCard platform={PLATFORMS[5]} style={{ left: 18, top: 684, width: 190, height: 262 }} />
        <PlatformCard platform={PLATFORMS[6]} style={{ left: 224, top: 684, width: 190, height: 262 }} />

        <div style={{ ...glowBox("#2f8cff", "#3b82f6", "rgba(4,10,52,0.9)"), position: "absolute", left: 430, top: 684, width: 578, height: 304 }}>
          <div style={{ margin: "-2px auto 0", width: 520, height: 56, borderRadius: 28, border: "2.5px solid #2f8cff", background: "rgba(6,20,90,0.95)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 33, fontWeight: 800, fontStyle: "italic", color: "#37d0ff", boxShadow: "0 0 14px #2f8cff" }}>SMM SERVICES &amp; PRICE LIST</div>
          <div style={{ textAlign: "center", fontSize: 17, fontWeight: 700, color: "#9cc2ff", marginTop: 4 }}>All prices are per 1K (1,000)</div>
          <div style={{ display: "flex", padding: "2px 14px 0", gap: 0 }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
              <PriceRow icon={<Users size={44} color="#3b8bff" fill="#3b8bff" />} label="Followers" price={money(prices.Followers)} />
              <PriceRow icon={<Heart size={38} color="#ff3b4e" fill="#ff3b4e" />} label="Likes" price={money(prices.Likes)} />
              <PriceRow icon={<span style={{ width: 38, height: 38, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={24} color="#ef2b2b" fill="#ef2b2b" /></span>} label="Views" price={money(prices.Views)} />
            </div>
            <div style={{ width: 2, background: "#2f8cff88", margin: "4px 0" }} />
            <div style={{ flex: 1, minWidth: 0, paddingLeft: 12 }}>
              <PriceRow icon={<MessageCircle size={42} color="#3b8bff" fill="#3b8bff" />} label="Comments" price={money(prices.Comments)} />
              <PriceRow icon={<img src={youtube} alt="" style={{ width: 44, height: 31 }} />} label="YouTube Subscribers" price={money(prices["YouTube Subscribers"])} />
            </div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ width: 54, height: 3, background: "#facc15" }} />
            <div style={{ padding: "4px 24px", borderRadius: 30, border: "2.5px solid #2f8cff", background: "rgba(6,20,90,0.95)", fontSize: 23, fontWeight: 800, fontStyle: "italic", color: "#ffd21f", whiteSpace: "nowrap" }}>Get More Engagement Today!</div>
            <div style={{ width: 54, height: 3, background: "#facc15" }} />
          </div>
        </div>

        <div style={{ ...glowBox("#27d3a0", "#22c55e", "rgba(3,12,40,0.92)"), position: "absolute", left: 26, top: 996, width: 560, height: 134, borderRadius: 67, display: "flex", alignItems: "center", gap: 22, padding: "0 22px" }}>
          <img src={whatsapp} alt="" style={{ width: 112, height: 112 }} />
          <div style={{ width: 2, height: 90, background: "#ffffff33" }} />
          <div>
            <div style={{ fontSize: 50, fontWeight: 800, lineHeight: 1 }}>WhatsApp:</div>
            <div style={{ fontSize: 37, fontWeight: 600, fontStyle: "italic", lineHeight: 1.15 }}>{supportNumber || "-"}</div>
          </div>
        </div>
        <div style={{ position: "absolute", left: 598, top: 1034, display: "flex", color: "#27a8ff" }}>
          <ChevronRight size={64} strokeWidth={4} /><ChevronRight size={64} strokeWidth={4} style={{ marginLeft: -30 }} /><ChevronRight size={64} strokeWidth={4} style={{ marginLeft: -30 }} />
        </div>

        <div style={{ ...glowBox("#2f8cff", "#3b82f6", "rgba(4,12,60,0.9)"), position: "absolute", left: 30, top: 1160, width: 638, height: 186, borderRadius: 34, padding: "10px 24px" }}>
          <div style={{ textAlign: "center", fontSize: Math.max(22, Math.min(38, 580 / ((name.length + 11) * 0.8))), fontWeight: 800, color: "#37c8ff", whiteSpace: "nowrap", overflow: "hidden" }}>{name.toUpperCase()} STORE LINK</div>
          <div style={{ marginTop: 10, height: 76, borderRadius: 24, background: "#fff", display: "flex", alignItems: "center", padding: "0 10px 0 22px", gap: 14, boxShadow: "0 0 14px #ffffff88" }}>
            <Link2 size={44} color="#2f6bff" />
            <div style={{ flex: 1, minWidth: 0, fontSize: 26, fontWeight: 500, color: "#24306e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{storeUrl || "-"}</div>
            <div style={{ width: 130, height: 56, borderRadius: 14, background: "linear-gradient(180deg,#2f8cff,#0a5fe0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 800, color: "#fff" }}>Go</div>
          </div>
        </div>

        <div style={{ ...glowBox("#d946ef", "#d946ef", "rgba(18,6,58,0.92)"), position: "absolute", left: 686, top: 1096, width: 316, height: 302, borderRadius: 28, textAlign: "center" }}>
          <div style={{ fontSize: 35, fontWeight: 800, marginTop: 12 }}>SCAN TO VISIT</div>
          <div style={{ margin: "8px auto 0", width: 204, height: 204, background: "#fff", borderRadius: 10, padding: 8, boxSizing: "border-box" }}>{qr && <img src={qr} alt="" style={{ width: "100%", height: "100%" }} />}</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>QR CODE</div>
        </div>

        <div style={{ position: "absolute", left: 30, top: 1398, width: 700, display: "flex", alignItems: "center", gap: 18 }}>
          <ShieldCheck size={86} color="#3b8bff" strokeWidth={1.8} />
          <div style={{ fontSize: 33, fontWeight: 800, lineHeight: 1 }}>100%<br />SAFE</div>
          <div style={{ width: 2, height: 80, background: "#ffffff44", margin: "0 8px" }} />
          <div style={{ width: 82, height: 82, borderRadius: 41, border: "3px solid #ffb800", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px #ffb80088" }}><Zap size={50} color="#ffb800" fill="#ffb800" /></div>
          <div style={{ fontSize: 31, fontWeight: 800, lineHeight: 1 }}>FAST<br />DELIVERY</div>
          <div style={{ width: 2, height: 80, background: "#ffffff44", margin: "0 8px" }} />
          <BadgeCheck size={86} color="#3b8bff" strokeWidth={1.8} />
          <div style={{ fontSize: 31, fontWeight: 800, lineHeight: 1 }}>SATISFACTION<br />GUARANTEED</div>
        </div>
      </div>
    </FlyerFrame>
  );
}
