import { useMemo, type CSSProperties, type ReactNode } from "react";
import { Bike, Check, Phone } from "lucide-react";
import { FlyerFrame, slug, ussdMessageLines, type StoreInfo } from "@/components/FlyerShared";
import type { FlyerPackage, FlyerPackages } from "@/components/DynamicFlyer";
import whatsapp from "@/assets/brands/whatsapp.svg";
import man from "@/assets/flyer/data-man.png";

const FONT = "Montserrat, 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
const GOLD = "#ffd21f";
const DARK = "#073b10";

export type GreenDataFlyerProps = StoreInfo & { packages?: FlyerPackages; afaPrice?: number | null };

const priceText = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

const darkPill = (style: CSSProperties): CSSProperties => ({
  position: "absolute", boxSizing: "border-box", background: `linear-gradient(180deg,#0d5a1a,${DARK})`, border: `4px solid ${GOLD}`, boxShadow: "0 0 18px #ffe60088, 0 6px 14px #00000066", ...style,
});

const goldPanel = (style: CSSProperties): CSSProperties => ({
  position: "absolute", boxSizing: "border-box", background: `linear-gradient(180deg,#ffe85c,${GOLD} 60%,#f5b800)`, border: "4px solid #fff3a0", boxShadow: "0 0 18px #ffe60099, 0 6px 14px #00000066", color: "#0a3d12", ...style,
});

const GoldCheck = () => (
  <span style={{ width: 46, height: 46, borderRadius: 23, background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <Check size={32} color="#0a3d12" strokeWidth={5} />
  </span>
);

function NetworkPanel({ left, width, background, border, header, textColor, lineColor, list }: { left: number; width: number; background: string; border: string; header: ReactNode; textColor: string; lineColor: string; list: FlyerPackage[] }) {
  const rows = [...list].sort((a, b) => a.size_gb - b.size_gb).slice(0, 9);
  return (
    <div style={{ position: "absolute", left, top: 340, width, height: 462, boxSizing: "border-box", borderRadius: 34, background, border: `5px solid ${border}`, boxShadow: `0 0 22px ${border}cc, inset 0 0 16px #ffffff44`, color: textColor, overflow: "hidden" }}>
      <div style={{ height: 76, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, borderBottom: `3px solid ${lineColor}` }}>{header}</div>
      <div style={{ padding: "8px 18px 0" }}>
        {rows.map((item) => (
          <div key={item.size_gb} style={{ height: 40.5, display: "flex", alignItems: "baseline", gap: 8, fontSize: 28, fontWeight: 800, lineHeight: "40px", borderBottom: `1px solid ${lineColor}55` }}>
            <span style={{ width: 118, whiteSpace: "nowrap" }}>{item.size_gb}GB =</span>
            <span style={{ flex: 1, textAlign: "center", fontSize: 30 }}>{priceText(Number(item.price))}</span>
            <span style={{ fontSize: 26, fontWeight: 700 }}>cedis</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const USSD_CODE = "*920*337#";

export function GreenDataFlyer({ storeName, storeUrl, supportNumber, packages, afaPrice, accessCode }: GreenDataFlyerProps) {
  const name = (storeName || "Your Store").toUpperCase();
  const nameSize = Math.max(34, Math.min(84, 640 / (name.length * 0.8)));
  const message = useMemo(() => `${storeName || "Our store"} - fast and reliable data. Register for AFA today and enjoy the best data deals! Delivery within 5 to 10 mins after payment.\nBuy here: ${storeUrl || "-"}\nContact: ${supportNumber || "-"}\n${ussdMessageLines(accessCode).join("\n")}`, [storeName, storeUrl, supportNumber, accessCode]);

  return (
    <FlyerFrame width={1124} height={1530} fileName={`${slug(storeName)}-data-flyer`} message={message}>
      <div style={{ position: "relative", width: 1124, height: 1530, overflow: "hidden", fontFamily: FONT, color: "#fff", background: "radial-gradient(ellipse at 60% 45%, #b6ff4a 0%, #3ed21c 30%, #12961a 60%, #07551a 100%)" }}>
        <div style={{ position: "absolute", inset: 0, background: "repeating-conic-gradient(from 0deg at 62% 62%, rgba(255,255,170,0.22) 0deg 3deg, transparent 3deg 11deg)" }} />

        <div style={{ position: "absolute", left: 38, top: 10, width: 230, height: 190 }}>
          <div style={{ position: "absolute", left: 28, top: 0, width: 174, height: 170, clipPath: "polygon(50% 0, 100% 14%, 100% 62%, 50% 100%, 0 62%, 0 14%)", background: "linear-gradient(180deg,#ffe35a,#e0a400)" }} />
          <div style={{ position: "absolute", left: 40, top: 12, width: 150, height: 146, clipPath: "polygon(50% 0, 100% 14%, 100% 62%, 50% 100%, 0 62%, 0 14%)", background: "linear-gradient(180deg,#8dff4a,#17a622)" }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: 24, textAlign: "center", fontSize: 76, fontWeight: 900, color: DARK, lineHeight: 1 }}>AFA</div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 98, height: 44, background: `linear-gradient(180deg,#ffe35a,${GOLD})`, borderTop: "3px solid #fff3a0", borderBottom: "3px solid #b88400", display: "flex", alignItems: "center", justifyContent: "center", color: DARK, fontSize: 25, fontWeight: 900 }}>REGISTRATION</div>
          <div style={{ position: "absolute", left: 85, top: 140, width: 62, height: 62, borderRadius: 31, background: "#16a229", border: "4px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={40} color="#fff" strokeWidth={5} /></div>
        </div>

        <div style={darkPill({ left: 290, top: 16, width: 700, height: 118, borderRadius: 59, display: "flex", alignItems: "center", justifyContent: "center" })}>
          <div style={{ fontSize: nameSize, fontWeight: 900, fontStyle: "italic", whiteSpace: "nowrap", textShadow: "0 4px 0 #000, 0 0 16px #00000099", letterSpacing: -1 }}>{name}</div>
        </div>
        <div style={{ position: "absolute", left: 300, top: 138, width: 690, height: 54, borderRadius: 27, background: "linear-gradient(90deg,#0a4d14cc,#0a4d14)", border: "2px solid #ffe60088", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, fontStyle: "italic", whiteSpace: "nowrap" }}>
          Register Today and enjoy the&nbsp;<span style={{ color: GOLD }}>best</span>&nbsp;data deals!
        </div>

        <div style={goldPanel({ left: 14, top: 198, width: 428, height: 128, borderRadius: 34, padding: "6px 22px", textAlign: "center" })}>
          <div style={{ fontSize: 27, fontWeight: 900, fontStyle: "italic", lineHeight: 1.1, whiteSpace: "nowrap" }}>AFA Registration Price:</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginTop: 4 }}>
            <span style={{ fontSize: 62, fontWeight: 900, fontStyle: "italic", lineHeight: 1, color: DARK }}>GHC</span>
            <span style={{ width: 190, height: 56, borderRadius: 14, background: "#fff", border: "3px solid #9b1c1c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, fontWeight: 900, color: "#0a3d12" }}>{afaPrice ? priceText(Number(afaPrice)) : ""}</span>
          </div>
        </div>
        <div style={{ position: "absolute", left: 458, top: 208, width: 2, height: 108, background: "#ffffffaa" }} />
        <div style={darkPill({ left: 474, top: 198, width: 296, height: 118, borderRadius: 40, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", border: "3px solid #6ee06a", boxShadow: "0 0 14px #9dff6a88" })}>
          <div style={{ fontSize: 28, fontWeight: 700, fontStyle: "italic", lineHeight: 1.1 }}>Buy from AFA<br />and get registered</div>
          <div style={{ fontSize: 40, fontWeight: 900, fontStyle: "italic", color: GOLD, lineHeight: 1 }}>instantly!</div>
        </div>
        <div style={goldPanel({ left: 786, top: 198, width: 324, height: 118, borderRadius: 40, display: "flex", alignItems: "center", gap: 12, padding: "0 20px" })}>
          <Phone size={54} color={DARK} fill={DARK} style={{ transform: "scaleX(-1)", flexShrink: 0 }} />
          <div style={{ lineHeight: 1.1, fontStyle: "italic", fontWeight: 900, whiteSpace: "nowrap" }}>
            <div style={{ fontSize: 33 }}>Dial *1848#</div>
            <div style={{ fontSize: 24 }}>to register now!</div>
          </div>
        </div>

        <NetworkPanel left={22} width={360} background="linear-gradient(180deg,#ffe35a,#ffd21f 40%,#f7c000)" border="#f5b800" lineColor="#d9a300" textColor="#14210a" list={packages?.mtn ?? []}
          header={<><span style={{ fontSize: 46, fontWeight: 900, fontStyle: "italic" }}>my MTN</span><span style={{ width: 112, height: 56, borderRadius: 28, border: "5px solid #0b2a8f", background: GOLD, color: "#0b2a8f", fontSize: 30, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>MTN</span></>} />
        <NetworkPanel left={400} width={330} background="linear-gradient(180deg,#1a4fe0,#0a2a9a)" border="#3aa0ff" lineColor="#6aa8ff" textColor="#ffffff" list={packages?.airteltigo ?? []}
          header={<span style={{ fontSize: 50, fontWeight: 800 }}>airtel<span style={{ fontWeight: 900 }}>Tigo</span></span>} />
        <NetworkPanel left={746} width={364} background="linear-gradient(180deg,#f21c1c,#b80c0c)" border="#ff5a5a" lineColor="#ff9a9a" textColor="#ffffff" list={packages?.telecel ?? []}
          header={<span style={{ fontSize: 56, fontWeight: 900 }}>telecel</span>} />

        <div style={darkPill({ left: 14, top: 826, width: 752, height: 92, borderRadius: 46, display: "flex", alignItems: "center", paddingLeft: 40, fontSize: 64, fontWeight: 900, fontStyle: "italic", letterSpacing: -1 })}>FAST AND&nbsp;<span style={{ color: GOLD }}>RELIABLE</span></div>

        <div style={{ position: "absolute", left: 30, top: 930, width: 640, height: 112, borderRadius: "0 40px 40px 0", background: "linear-gradient(90deg,#0a4d14,#0d5a1a)", border: "2px solid #ffe60099", padding: "8px 24px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 6, boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 38, fontWeight: 900, fontStyle: "italic" }}><GoldCheck />CONTACT US:</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 38, fontWeight: 900, fontStyle: "italic" }}><GoldCheck /><span style={{ whiteSpace: "nowrap" }}>{supportNumber || "-"}</span></div>
        </div>

        <div style={{ position: "absolute", left: 16, top: 1054, width: 680, height: 150, borderRadius: 36, background: "linear-gradient(90deg,#052d0c,#0a4d14)", border: "2px solid #ffe60099", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 18, padding: "0 20px" }}>
          <Bike size={140} color={GOLD} strokeWidth={2} style={{ flexShrink: 0 }} />
          <div style={{ lineHeight: 1.05, fontStyle: "italic", fontWeight: 900 }}>
            <div style={{ fontSize: 40 }}>DELIVERY WITHIN</div>
            <div style={{ fontSize: 60, color: GOLD }}>5 TO 10 MINS</div>
            <div style={{ fontSize: 40 }}>AFTER PAYMENT</div>
          </div>
        </div>

        <div style={darkPill({ left: 10, top: 1222, width: 740, height: 148, borderRadius: 74, display: "flex", alignItems: "center", gap: 20, padding: "0 28px" })}>
          <img src={whatsapp} alt="" style={{ width: 112, height: 112 }} />
          <div style={{ fontSize: supportNumber && supportNumber.length > 14 ? 56 : 68, fontWeight: 800, fontStyle: "italic", whiteSpace: "nowrap" }}>{supportNumber || "-"}</div>
        </div>

        <img src={man} alt="" style={{ position: "absolute", left: 690, top: 800, height: 520, width: "auto", filter: "drop-shadow(0 8px 18px #00000088)" }} />
        <div style={darkPill({ left: 14, top: 1388, width: 1096, height: 124, borderRadius: 62, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 30px" })}>
          <div style={{ textAlign: "center", lineHeight: 1.1 }}>
            <div style={{ fontSize: 24, fontWeight: 800, fontStyle: "italic", color: GOLD }}>USSD CODE</div>
            <div style={{ fontSize: 54, fontWeight: 900, fontFamily: "monospace" }}>{USSD_CODE}</div>
          </div>
          <div style={{ width: 3, height: 84, background: `${GOLD}99` }} />
          <div style={{ textAlign: "center", lineHeight: 1.1 }}>
            <div style={{ fontSize: 24, fontWeight: 800, fontStyle: "italic", color: GOLD }}>ACCESS CODE</div>
            <div style={{ fontSize: 54, fontWeight: 900, fontFamily: "monospace" }}>{accessCode || "-"}</div>
          </div>
        </div>
        <div style={{ position: "absolute", right: 14, top: 1250, width: 360, transform: "rotate(-5deg)" }}>
          <div style={{ background: `linear-gradient(180deg,#ffe85c,${GOLD})`, color: DARK, fontSize: 27, fontWeight: 900, fontStyle: "italic", padding: "6px 12px", textAlign: "center", boxShadow: "0 4px 10px #00000088", whiteSpace: "nowrap" }}>FAST AND RELIABLE</div>
          <div style={{ background: "#041f08", color: "#fff", fontSize: 29, fontWeight: 800, fontStyle: "italic", padding: "6px 12px", textAlign: "center", border: `2px solid ${GOLD}`, whiteSpace: "nowrap" }}>Get your data now!</div>
        </div>
      </div>
    </FlyerFrame>
  );
}
