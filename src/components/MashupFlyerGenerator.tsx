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
    setShareText(`🎉 Special MTN Mashup Data from ${storeName}!\n\n⚡ Express Data Delivery\n💨 Instant • Affordable • Reliable${ussdText}\n\nVisit store: ${storeUrl}\nWhatsApp: ${whatsappNumber}`);
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
      // Clone the node to avoid scaling issues
      const node = flyerRef.current;
      
      // Generate at full resolution
      const dataUrl = await toPng(node, {
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
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "mashup-flyer.png", { type: "image/png" });

      if (navigator.share) {
        await navigator.share({
          title: "Special MTN Mashup Flyer",
          text: shareText,
          files: [file],
        });
        toast({ title: "Shared successfully!" });
      } else {
        await navigator.clipboard.writeText(shareText);
        toast({
          title: "Text copied!",
          description: "Share text copied. You can now share the image manually.",
        });
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", backgroundColor: "#000", borderBottom: "2px solid #1a1a1a" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, background: "#fbbf24", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>⚡</div>
              <span style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: 0.5 }}>
                {storeName}
              </span>
            </div>
            <div style={{ display: "flex", gap: 20, alignItems: "center", fontSize: 13, color: "#999" }}>
              <span>Packages</span>
              <span>Services</span>
              <span>Become an Agent</span>
              <span style={{ background: "#0099ff", color: "#fff", padding: "8px 16px", borderRadius: 6, fontWeight: 700 }}>Agent Dashboard</span>
              <span>Sign Out</span>
            </div>
          </div>

          {/* INFO BOXES - 4 boxes in a row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, padding: "20px 32px", backgroundColor: "#000" }}>
            {/* USSD CODE */}
            <div style={{ border: "2px solid #333", borderRadius: 12, padding: "16px", textAlign: "center", backgroundColor: "#0a0a0a" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📲</div>
              <div style={{ fontSize: 11, color: "#fbbf24", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>USSD CODE</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", marginBottom: 8, fontFamily: "monospace" }}>*380*455#</div>
              <div style={{ fontSize: 12, color: "#888" }}>Dial to purchase instantly.</div>
            </div>

            {/* ACCESS CODE */}
            <div style={{ border: "2px solid #333", borderRadius: 12, padding: "16px", textAlign: "center", backgroundColor: "#0a0a0a" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
              <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>ACCESS CODE</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginBottom: 8, fontFamily: "monospace" }}>{topupReference}</div>
              <div style={{ fontSize: 12, color: "#888" }}>Required for all purchases.</div>
            </div>

            {/* HELP */}
            <div style={{ border: "2px solid #333", borderRadius: 12, padding: "16px", textAlign: "center", backgroundColor: "#0a0a0a" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
              <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>NEED HELP OR HAVE</div>
              <div style={{ fontSize: 11, color: "#10b981", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>QUESTIONS?</div>
              <div style={{ fontSize: 12, color: "#888" }}>Contact us on WhatsApp or Call.</div>
            </div>

            {/* CONTACT */}
            <div style={{ border: "2px solid #333", borderRadius: 12, padding: "16px", textAlign: "center", backgroundColor: "#0a0a0a" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📞</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 8, fontFamily: "monospace" }}>{supportNumber}</div>
              <div style={{ background: "#10b981", color: "#fff", padding: "8px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>💬 Chat on WhatsApp</div>
            </div>
          </div>

          {/* PACKAGES GRID - 4 columns */}
          <div style={{ margin: "20px 32px", padding: "0" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              {mashupPkgs.map(({ id, size, price }) => (
                <div
                  key={id}
                  style={{
                    border: "2px solid #333",
                    borderRadius: 12,
                    padding: "16px",
                    textAlign: "center",
                    backgroundColor: "#0a0a0a",
                    position: "relative",
                  }}
                >
                  {/* Zap Icon */}
                  <div style={{ fontSize: 28, marginBottom: 12, marginTop: 4 }}>⚡</div>

                  {/* Label */}
                  <div style={{ fontSize: 12, color: "#fbbf24", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Special Mashup</div>

                  {/* Size */}
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", marginBottom: 8 }}>{size}</div>

                  {/* Price */}
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#fbbf24", marginBottom: 12 }}>GHC {price.toFixed(2)}</div>

                  {/* Buy Now Button */}
                  <button style={{ width: "100%", background: "#fbbf24", color: "#000", border: "none", borderRadius: 6, padding: "10px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                    Buy Now
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* FOOTER */}
          <div style={{ textAlign: "center", fontSize: 12, color: "#666", padding: "20px 32px" }}>
            Output: {FLYER_W} × {FLYER_H} px. Contact shown: {supportNumber}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MashupFlyerGenerator;
