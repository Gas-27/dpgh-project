import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Download, Loader2, Share2, Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toPng } from "html-to-image";

interface DataPackage {
  id: string;
  network: string;
  size_gb: number;
  size_gb_text?: string;
  price: number;
  agent_price: number;
  active: boolean;
}

interface MashupFlyerGeneratorProps {
  storeName: string;
  storeUrl: string;
  whatsappNumber: string;
  supportNumber: string;
  packages: DataPackage[];
  agentPrices: Record<string, number>;
  topupReference?: string;
  isSubagent?: boolean;
}

const FLYER_W = 1080;
const FLYER_H = 1920;

const MashupFlyerGenerator = ({
  storeName,
  storeUrl,
  whatsappNumber,
  supportNumber,
  packages,
  agentPrices,
  topupReference = "0",
  isSubagent = false,
}: MashupFlyerGeneratorProps) => {
  const { toast } = useToast();
  const flyerRef = useRef<HTMLDivElement>(null);
  const flyerContainerRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [flyerScale, setFlyerScale] = useState(1);
  const [shareText, setShareText] = useState("");

  useEffect(() => {
    const ussdText = `\n\n📲 USSD: *380*455#\n🔑 Access Code: ${topupReference}`;
    setShareText(`🎉 Special MTN Mashup Data from ${storeName}!\n\n⚡ Express Data Delivery\n💨 Instant • Affordable • Reliable${ussdText}\n\nVisit: ${storeUrl}\nWhatsApp: ${whatsappNumber}`);
  }, [storeName, storeUrl, whatsappNumber, topupReference]);

  useEffect(() => {
    const calcScale = () => {
      if (flyerContainerRef.current) {
        const containerWidth = flyerContainerRef.current.offsetWidth;
        setFlyerScale(Math.min(containerWidth / FLYER_W, 1));
      }
    };
    calcScale();
    window.addEventListener("resize", calcScale);
    return () => window.removeEventListener("resize", calcScale);
  }, []);

  const getPrice = useCallback((pkg: DataPackage) => agentPrices[pkg.id] ?? pkg.price, [agentPrices]);

  // Get mashup packages (both mtn_mashup and mashup networks) sorted by size
  const mashupPackages = packages
    .filter(p => (p.network === "mtn_mashup" || p.network === "mashup") && p.active !== false)
    .sort((a, b) => (a.size_gb || 0) - (b.size_gb || 0));

  const mashupPkgs = mashupPackages.map(p => ({
    id: p.id,
    size: p.size_gb_text || `${p.size_gb}GB`,
    price: getPrice(p),
  }));

  const downloadFlyer = async () => {
    if (!flyerRef.current) return;
    setGenerating(true);
    try {
      const dataUrl = await toPng(flyerRef.current, {
        quality: 1,
        pixelRatio: 1,
        width: FLYER_W,
        height: FLYER_H,
        style: {
          transform: "none",
          transformOrigin: "top left",
        },
        canvasWidth: FLYER_W,
        canvasHeight: FLYER_H,
      });
      const link = document.createElement("a");
      link.download = `${storeName.replace(/\s+/g, "-")}-mashup-flyer.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: "Flyer downloaded!", description: "Saved as PNG image." });
    } catch (error) {
      console.error("Error downloading flyer:", error);
      toast({ title: "Error", description: "Failed to download flyer", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const shareFlyer = async () => {
    if (!flyerRef.current) return;
    setGenerating(true);
    try {
      const dataUrl = await toPng(flyerRef.current, {
        quality: 1,
        pixelRatio: 1,
        width: FLYER_W,
        height: FLYER_H,
        style: { transform: "none", transformOrigin: "top left" },
        canvasWidth: FLYER_W,
        canvasHeight: FLYER_H,
      });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "mashup-flyer.png", { type: "image/png" });
      const fullShareText = `${shareText}\n\nWhatsApp: ${whatsappNumber}\n\nStore: ${storeUrl}`;

      if (navigator.share) {
        await navigator.share({
          title: "Special MTN Mashup Flyer",
          text: fullShareText,
          files: [file],
        });
        toast({ title: "Shared successfully!" });
      } else {
        await navigator.clipboard.writeText(fullShareText);
        toast({ title: "Text copied!", description: "Share text copied. You can now share the image manually." });
        const link = document.createElement("a");
        link.download = "mashup-flyer.png";
        link.href = dataUrl;
        link.click();
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        toast({ title: "Error", description: "Could not share flyer.", variant: "destructive" });
      }
    } finally {
      setGenerating(false);
    }
  };

  // Package card component
  const PkgCard = ({ size, price }: { size: string; price: number }) => (
    <div style={{ background: "#2a2a3e", border: "2px solid rgba(251, 191, 36, 0.5)", borderRadius: 12, padding: "12px 8px", textAlign: "center", position: "relative" }}>
      <div style={{ position: "absolute", top: 4, right: 4, background: "#fbbf24", color: "#000", fontSize: 10, fontWeight: 800, padding: "4px 8px", borderRadius: 4 }}>Express</div>
      <div style={{ fontSize: 28, color: "#fbbf24", marginBottom: 6, marginTop: 2 }}>⚡</div>
      <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>Special Mashup</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{size}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#fbbf24", marginBottom: 6 }}>GHC {price.toFixed(2)}</div>
      <div style={{ background: "#fbbf24", color: "#000", borderRadius: 6, padding: "8px 0", fontSize: 12, fontWeight: 800 }}>BUY NOW</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="font-display flex items-center gap-2">
            <Image className="h-5 w-5 text-primary" /> Special MTN Mashup Flyer Generator
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Live prices auto-populate. Edit share message, then download or share directly to WhatsApp.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Share Message <span className="text-muted-foreground font-normal text-xs">(editable)</span>
            </Label>
            <Textarea value={shareText} onChange={e => setShareText(e.target.value)} rows={4} className="text-sm font-mono" />
          </div>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={downloadFlyer} disabled={generating} variant="outline" className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download PNG
            </Button>
            <Button onClick={shareFlyer} disabled={generating} variant="hero" className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Share Flyer
            </Button>
          </div>

          <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-sm">
            <p className="font-semibold flex items-center gap-1">
              <Image className="h-4 w-4" /> How to save & share
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              📱 <strong>Mobile:</strong> Tap &quot;Share Flyer&quot; to send the image directly via WhatsApp.<br />
              💻 <strong>Desktop:</strong> Download the image, then share manually on WhatsApp.<br />
              💾 <strong>Download PNG:</strong> Saves the image to your device.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Flyer Preview */}
      <div
        ref={flyerContainerRef}
        className="w-full overflow-hidden rounded-lg border border-border"
        style={{ aspectRatio: `${FLYER_W} / ${FLYER_H}`, position: "relative", background: "#000" }}
      >
        <div
          ref={flyerRef}
          style={{
            width: FLYER_W,
            height: FLYER_H,
            transform: `scale(${flyerScale})`,
            transformOrigin: "top left",
            position: "absolute",
            top: 0,
            left: 0,
            backgroundColor: "#000000",
            fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
            overflow: "hidden",
          }}
        >
          {/* TOP HEADER */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", backgroundColor: "#0a0a0a", borderBottom: "1px solid #1e1e1e" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, background: "#fbbf24", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⚡</div>
              <span style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: 0.5 }}>{storeName.toUpperCase()}</span>
            </div>
            <span style={{ fontSize: 13, color: "#0066cc", fontWeight: 700, padding: "5px 14px", background: "#0066cc20", borderRadius: 7, border: "1px solid #0066cc40" }}>Agent Dashboard</span>
          </div>

          {/* INFO HEADER - 4 boxes */}
          <div style={{ display: "flex", alignItems: "stretch", padding: "16px 32px", gap: 16, backgroundColor: "#0a0a0a" }}>
            {/* USSD Code */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "#111", border: "1.5px solid #333", borderRadius: 12 }}>
              <div style={{ width: 48, height: 48, background: "#222", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📲</div>
              <div>
                <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>USSD CODE</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", marginTop: 2, fontFamily: "monospace" }}>*380*455#</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>Dial to purchase instantly.</div>
              </div>
            </div>

            {/* Access Code */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "#111", border: "1.5px solid #333", borderRadius: 12 }}>
              <div style={{ width: 48, height: 48, background: "#222", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🔐</div>
              <div>
                <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>ACCESS CODE</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: "#fff", marginTop: 0, fontFamily: "monospace" }}>{topupReference}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 0 }}>Required for all purchases.</div>
              </div>
            </div>

            {/* Help */}
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "#111", border: "1.5px solid #333", borderRadius: 12 }}>
              <div style={{ width: 48, height: 48, background: "#10b981", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>💬</div>
              <div>
                <div style={{ fontSize: 13, color: "#10b981", fontWeight: 800, textTransform: "uppercase" }}>NEED HELP OR HAVE</div>
                <div style={{ fontSize: 13, color: "#10b981", fontWeight: 800, textTransform: "uppercase" }}>QUESTIONS?</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>Contact us on WhatsApp or Call.</div>
              </div>
            </div>

            {/* Phone */}
            <div style={{ flex: 1.2, display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", padding: "16px 20px", background: "#111", border: "1.5px solid #333", borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{ width: 40, height: 40, background: "#16a34a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📞</div>
                <span style={{ fontSize: 26, fontWeight: 900, color: "#fff", fontFamily: "monospace" }}>{supportNumber}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#25D366", borderRadius: 20, padding: "8px 18px", width: "100%" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>💬 Chat on WhatsApp</span>
              </div>
            </div>
          </div>

          {/* TITLE */}
          <div style={{ textAlign: "center", padding: "30px 20px 14px" }}>
            <div style={{ fontSize: 46, fontWeight: 900, color: "#fff", letterSpacing: -1, textTransform: "uppercase" }}>SPECIAL MTN MASHUP</div>
            <div style={{ fontSize: 18, color: "#777", marginTop: 6 }}>Express • Fast • Reliable.</div>
          </div>

          {/* PACKAGES GRID */}
          <div style={{ margin: "0 20px 16px", border: "2px solid rgba(251, 191, 36, 0.3)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", backgroundColor: "#0e0b00", borderBottom: "1px solid rgba(251, 191, 36, 0.2)" }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#fbbf24", letterSpacing: 1, textTransform: "uppercase" }}>MASHUP DATA BUNDLES</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#fbbf24", border: "2px solid #fbbf24", borderRadius: 20, padding: "4px 16px" }}>Express</span>
            </div>
            <div style={{ backgroundColor: "#0a0800", padding: "10px 10px 12px", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 7 }}>
              {mashupPkgs.map(({ id, size, price }) => (
                <PkgCard key={id} size={size} price={price} />
              ))}
            </div>
          </div>

          {/* FOOTER */}
          <div style={{ textAlign: "center", fontSize: 12, color: "#666", marginTop: 10, paddingBottom: 10 }}>
            Output: {FLYER_W} × {FLYER_H} px. Contact shown: {supportNumber}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MashupFlyerGenerator;
