import { useMemo, type CSSProperties, type ReactNode } from "react";
import { CalendarDays, Globe, Headset, MessageSquareText, Phone, Search, ShieldCheck, Smartphone, Users, Zap, Check } from "lucide-react";
import { FlyerFrame, slug, ussdMessageLines, useQrDataUrl, type StoreInfo } from "@/components/FlyerShared";
import woman from "@/assets/flyer/afa-woman.png";

const FONT = "Montserrat, 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
const YELLOW = "#fdc32e";
const LIGHT = "#ffe24d";
const BLACK = "#111111";

export type AfaFlyerProps = StoreInfo & { afaPrice?: number | null };

const priceText = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

const brush = (style: CSSProperties): CSSProperties => ({
  position: "absolute", boxSizing: "border-box", background: BLACK, color: "#fff", ...style,
});

const BUNDLES: { label: string; icon: ReactNode }[] = [
  { label: "Monthly No Data Bundle", icon: <CalendarDays size={34} color={BLACK} /> },
  { label: "Monthly Data Bundle", icon: <Globe size={34} color={BLACK} /> },
  { label: "Weekly No Data Bundle", icon: <MessageSquareText size={34} color={BLACK} /> },
  { label: "Weekly Data Bundle", icon: <Globe size={34} color={BLACK} /> },
  { label: "Bundle for Others", icon: <Users size={34} color={BLACK} /> },
];

function Stat({ icon, value, unit }: { icon: ReactNode; value: string; unit: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 54, height: 54, borderRadius: 27, border: `3px solid ${YELLOW}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</span>
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontSize: 40, fontWeight: 900, color: YELLOW }}>{value}</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{unit}</div>
      </div>
    </div>
  );
}

export function AfaFlyer({ storeName, storeUrl, supportNumber, accessCode, afaPrice }: AfaFlyerProps) {
  const name = storeName || "Your Store";
  const nameSize = Math.max(26, Math.min(46, 460 / (name.length * 0.72)));
  const qr = useQrDataUrl(storeUrl);
  const host = (storeUrl || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const hostSize = Math.max(22, Math.min(34, 520 / Math.max(host.length, 1) / 0.58));
  const priceLabel = afaPrice ? priceText(Number(afaPrice)) : "--";

  const message = useMemo(
    () =>
      [
        `${name} - AFA Registration for MTN users only! Register once for just GHS ${priceLabel} and enjoy the convenience of buying your bundles by dialling *1848#.`,
        `Register here: ${storeUrl || "-"}`,
        `Contact: ${supportNumber || "-"}`,
        ...ussdMessageLines(accessCode),
      ].join("\n"),
    [name, priceLabel, storeUrl, supportNumber, accessCode],
  );

  return (
    <FlyerFrame width={1080} height={1080} fileName={`${slug(storeName)}-afa-flyer`} message={message}>
      <div style={{ position: "relative", width: 1080, height: 1080, overflow: "hidden", fontFamily: FONT, color: BLACK, background: `radial-gradient(ellipse at 30% 20%, #ffe97a 0%, ${YELLOW} 55%, #f5b400 100%)` }}>
        <img src={woman} alt="" crossOrigin="anonymous" style={{ position: "absolute", right: -40, top: 40, height: 930, width: "auto" }} />
        <div style={{ position: "absolute", left: 400, top: 0, width: 280, height: 1080, background: `linear-gradient(90deg, ${YELLOW}, ${YELLOW}00)` }} />
        <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 120, background: `linear-gradient(180deg, ${YELLOW}, ${YELLOW}00)` }} />

        <div style={{ position: "absolute", left: 36, top: 18, width: 520, height: 66, borderRadius: 33, background: `linear-gradient(180deg,#ffe97a,${YELLOW})`, border: `4px solid ${BLACK}`, display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", padding: "0 20px" }}>
          <span style={{ fontSize: nameSize, fontWeight: 900, whiteSpace: "nowrap" }}>{name}</span>
        </div>
        <div style={{ position: "absolute", left: 60, top: 90, fontSize: 18, fontWeight: 800, letterSpacing: 4 }}>FAST &bull; SAFE &bull; RELIABLE</div>
        <div style={{ position: "absolute", left: 915, top: 16, width: 130, height: 66, borderRadius: 33, border: `5px solid ${BLACK}`, background: YELLOW, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 900 }}>MTN</div>

        <div style={{ position: "absolute", left: 30, top: 80, fontSize: 200, fontWeight: 900, lineHeight: 1, letterSpacing: -6, textShadow: "0 0 0 #000" }}>AFA</div>
        <div style={brush({ left: 24, top: 226, width: 476, height: 70, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 50, fontWeight: 900, letterSpacing: -1 })}>REGISTRATION</div>
        <div style={{ position: "absolute", left: 70, top: 292, width: 350, height: 40, borderRadius: 10, background: LIGHT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 25, fontWeight: 800 }}>For MTN Users Only</div>

        <div style={{ position: "absolute", left: 480, top: 135, width: 290, height: 200, borderRadius: "46% 54% 50% 50%", background: `radial-gradient(circle, ${LIGHT} 0%, ${LIGHT}aa 60%, transparent 100%)`, transform: "rotate(-4deg)" }} />
        <div style={{ position: "absolute", left: 495, top: 150, width: 270, textAlign: "center", transform: "rotate(-8deg)", lineHeight: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 900 }}>REGISTER FOR</div>
          <div style={{ fontSize: 40, fontWeight: 900 }}>ONLY</div>
          <div style={{ fontSize: priceLabel.length > 5 ? 54 : 70, fontWeight: 900, marginTop: 4 }}>GHS {priceLabel}</div>
          <div style={{ height: 8, width: 190, margin: "6px auto 0", background: BLACK, borderRadius: 4, transform: "rotate(-2deg)" }} />
        </div>

        <div style={{ position: "absolute", left: 880, top: 245, width: 190, height: 190, borderRadius: 95, background: BLACK, border: `6px solid ${LIGHT}`, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "#fff", transform: "rotate(-4deg)" }}>
          <span style={{ width: 40, height: 40, borderRadius: 20, background: YELLOW, display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={28} color={BLACK} strokeWidth={5} /></span>
          <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.05, marginTop: 4 }}>ONE TIME</div>
          <div style={{ fontSize: 19, fontWeight: 900, lineHeight: 1.05, color: YELLOW }}>REGISTRATION</div>
          <div style={{ fontSize: 17, fontWeight: 700, fontStyle: "italic", marginTop: 4 }}>That&apos;s it!</div>
        </div>

        <div style={{ position: "absolute", left: 40, top: 340, width: 400, fontSize: 26, fontWeight: 700, lineHeight: 1.18 }}>
          Register once and enjoy the convenience of buying your bundles from
        </div>
        <div style={brush({ left: 62, top: 440, width: 360, height: 80, borderRadius: 40, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 })}>
          <Smartphone size={44} color={YELLOW} />
          <span style={{ fontSize: 62, fontWeight: 900, color: YELLOW, letterSpacing: -1 }}>*1848#</span>
        </div>
        <div style={{ position: "absolute", left: 118, top: 525, fontSize: 24, fontWeight: 800 }}>for all your packages.</div>

        <div style={brush({ left: 40, top: 565, width: 250, height: 36, borderRadius: "14px 14px 0 0", display: "flex", alignItems: "center", paddingLeft: 18, fontSize: 21, fontWeight: 900 })}>STORE URL LINK:</div>
        <div style={{ position: "absolute", left: 40, top: 601, width: 790, height: 66, borderRadius: "0 33px 33px 33px", background: "#fff", border: `5px solid ${BLACK}`, boxSizing: "border-box", display: "flex", alignItems: "center", gap: 14, padding: "0 8px 0 20px" }}>
          <Search size={34} color={BLACK} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: hostSize, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{host || "your-store-link"}</span>
          <span style={{ height: 46, padding: "0 22px", borderRadius: 23, background: YELLOW, display: "flex", alignItems: "center", fontSize: 26, fontWeight: 900, flexShrink: 0 }}>Search</span>
        </div>

        <div style={{ position: "absolute", left: 850, top: 540, width: 200, height: 232, borderRadius: 22, background: `linear-gradient(180deg,#fff3a0,${YELLOW})`, border: `4px solid ${LIGHT}`, boxShadow: "0 6px 16px #00000055", boxSizing: "border-box", padding: "10px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 19, fontWeight: 900 }}>SCAN QR CODE</div>
          <div style={{ marginTop: 6, width: 168, height: 168, background: "#fff", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "auto", marginRight: "auto" }}>
            {qr ? <img src={qr} alt="" style={{ width: 156, height: 156 }} /> : null}
          </div>
        </div>

        <div style={brush({ left: 36, top: 690, width: 330, height: 38, borderRadius: "14px 14px 0 0", display: "flex", alignItems: "center", paddingLeft: 22, fontSize: 27, fontWeight: 900, letterSpacing: 1 })}>CHOOSE BUNDLE:</div>
        <div style={{ position: "absolute", left: 36, top: 728, width: 810, height: 108, borderRadius: "0 24px 24px 24px", background: "#fff", boxSizing: "border-box", display: "flex", alignItems: "stretch", padding: "10px 0" }}>
          {BUNDLES.map((b, i) => (
            <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, textAlign: "center", borderLeft: i === 0 ? "none" : "2px solid #f0c340", padding: "0 8px" }}>
              <span style={{ width: 52, height: 52, borderRadius: 26, background: YELLOW, display: "flex", alignItems: "center", justifyContent: "center" }}>{b.icon}</span>
              <span style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.1 }}>{b.label}</span>
            </div>
          ))}
        </div>

        <div style={{ position: "absolute", left: 36, top: 850, height: 30, padding: "0 18px", borderRadius: "10px 10px 0 0", background: LIGHT, display: "flex", alignItems: "center", fontSize: 19, fontWeight: 900 }}>Monthly No Data Bundle</div>
        <div style={brush({ left: 24, top: 880, width: 1032, height: 92, borderRadius: 28, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px" })}>
          <Stat icon={<Phone size={26} color="#fff" />} value="258" unit="mins Onnet" />
          <Stat icon={<Phone size={26} color="#fff" />} value="30" unit="mins Offnet" />
          <Stat icon={<Users size={26} color="#fff" />} value="500" unit="mins CUG" />
          <Stat icon={<MessageSquareText size={26} color="#fff" />} value="25" unit="SMS" />
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 18, fontWeight: 700, lineHeight: 1.1 }}>
            <CalendarDays size={34} color="#fff" />
            <span>Valid for<br />30 days</span>
          </div>
          <div style={{ background: YELLOW, color: BLACK, borderRadius: 14, padding: "6px 14px", textAlign: "center", lineHeight: 1, transform: "rotate(-3deg)" }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Bundle costs</div>
            <div style={{ fontSize: 38, fontWeight: 900 }}>GHS 10</div>
          </div>
        </div>

        <div style={{ position: "absolute", left: 30, top: 992, display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ height: 50, padding: "0 18px", borderRadius: 25, border: `4px solid ${BLACK}`, display: "flex", alignItems: "center", fontSize: 28, fontWeight: 900 }}>MTN</span>
          <span style={{ fontSize: 22, fontWeight: 700, fontStyle: "italic", lineHeight: 1 }}>Everywhere<br />you go</span>
        </div>
        <div style={{ position: "absolute", left: 300, top: 992, display: "flex", alignItems: "center", gap: 26, fontSize: 15, fontWeight: 800, lineHeight: 1.05 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Zap size={34} /><span>Fast<br />Activation</span></span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}><ShieldCheck size={34} /><span>Secure<br />&amp; Reliable</span></span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Headset size={34} /><span>24/7<br />Support</span></span>
        </div>
        <div style={brush({ right: 24, top: 984, width: 300, height: 76, borderRadius: 14, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", transform: "rotate(-3deg)" })}>
          <Smartphone size={30} color={YELLOW} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 20, fontWeight: 800, fontStyle: "italic", lineHeight: 1.1 }}>Register Now &amp;<br />Enjoy Your Bundles!</span>
        </div>
      </div>
    </FlyerFrame>
  );
}
