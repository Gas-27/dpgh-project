import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Download, Loader2, Share2, RotateCcw, Image } from "lucide-react";
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

  // Get mashup packages (both mtn_mashup and mashup networks) and sort by size
  const mashupPackages = packages.filter(p => 
    (p.network === "mtn_mashup" || p.network === "mashup") && p.active !== false
  ).sort((a, b) => {
    const sizeA = a.size_gb || 0;
    const sizeB = b.size_gb || 0;
    return sizeA - sizeB;
  });

  const getMashupPkgs = () =>
    mashupPackages.map(p => ({
      id: p.id,
      size: p.size_gb_text || `${p.size_gb}GB`,
      price: getPrice(p),
    }));

  const mashupPkgs = getMashupPkgs();

  const downloadFlyer = async () => {
    if (!flyerRef.current) return;
    setGenerating(true);
    try {
      const dataUrl = await toPng(flyerRef.current, {
        quality: 1,
        pixelRatio: 1,
        width: FLYER_W,
        height: FLYER_H,
      });
      const link = document.createElement("a");
      link.download = `${storeName.replace(/\s+/g, "-")}-mashup-flyer-${Date.now()}.png`;
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

  const shareOnWhatsApp = () => {
    const text = encodeURIComponent(shareText);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="w-5 h-5 text-primary" />
            Special MTN Mashup Flyer Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Share Message</Label>
              <Textarea
                value={shareText}
                onChange={(e) => setShareText(e.target.value)}
                className="h-24"
              />
            </div>
            <div className="space-y-2">
              <Label>Flyer Actions</Label>
              <div className="flex gap-2 flex-col">
                <Button onClick={downloadFlyer} disabled={generating} className="w-full">
                  {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Download Flyer
                </Button>
                <Button onClick={shareOnWhatsApp} variant="outline" className="w-full">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share on WhatsApp
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FLYER PREVIEW */}
      <div ref={flyerContainerRef} className="flex justify-center bg-gray-900 rounded-lg overflow-x-auto p-4">
        <div
          ref={flyerRef}
          style={{
            width: `${FLYER_W}px`,
            height: `${FLYER_H}px`,
            transform: `scale(${flyerScale})`,
            transformOrigin: "top center",
            backgroundColor: "#1a1a2e",
          }}
          className="relative font-sans"
        >
          {/* HEADER */}
          <div className="flex items-center justify-between px-8 py-6 border-b border-gray-600" style={{ backgroundColor: "#0f0f1e" }}>
            <div className="text-2xl font-bold text-white">
              ⚡ {storeName}
            </div>
            <div className="bg-cyan-500 text-black px-4 py-2 rounded text-xs font-bold">
              Dashboard
            </div>
          </div>

          {/* INFO BOXES - 4 columns */}
          <div className="grid grid-cols-4 gap-3 px-4 py-6">
            {/* USSD CODE */}
            <div className="border-2 border-yellow-500 rounded-lg p-3 text-center" style={{ backgroundColor: "rgba(251, 191, 36, 0.05)" }}>
              <div className="text-yellow-400 text-2xl mb-1">📲</div>
              <div className="text-yellow-400 text-xs font-bold">USSD CODE</div>
              <div className="text-white font-bold text-sm mt-1">*380*455#</div>
              <div className="text-gray-400 text-xs mt-1">Dial to purchase instantly.</div>
            </div>

            {/* ACCESS CODE */}
            <div className="border-2 border-green-500 rounded-lg p-3 text-center" style={{ backgroundColor: "rgba(16, 185, 129, 0.05)" }}>
              <div className="text-green-400 text-2xl mb-1">🔐</div>
              <div className="text-green-400 text-xs font-bold">ACCESS CODE</div>
              <div className="text-white font-bold text-sm mt-1">{topupReference}</div>
              <div className="text-gray-400 text-xs mt-1">Required for all purchases.</div>
            </div>

            {/* HELP */}
            <div className="border-2 border-green-500 rounded-lg p-3 text-center" style={{ backgroundColor: "rgba(16, 185, 129, 0.05)" }}>
              <div className="text-green-400 text-2xl mb-1">💬</div>
              <div className="text-green-400 text-xs font-bold">NEED HELP OR HAVE</div>
              <div className="text-green-400 text-xs font-bold">QUESTIONS?</div>
              <div className="text-gray-400 text-xs mt-1">Contact us on WhatsApp or Call.</div>
            </div>

            {/* CONTACT */}
            <div className="border-2 border-green-500 rounded-lg p-3 text-center" style={{ backgroundColor: "rgba(16, 185, 129, 0.05)" }}>
              <div className="text-green-400 text-2xl mb-1">📞</div>
              <div className="text-white font-bold text-sm">{supportNumber}</div>
              <button className="mt-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded w-full">
                💬 Chat on WhatsApp
              </button>
            </div>
          </div>

          {/* PACKAGES GRID - 4 columns */}
          <div className="px-4 pb-6">
            <div className="grid grid-cols-4 gap-3">
              {mashupPkgs.map((pkg, idx) => (
                <div
                  key={pkg.id || idx}
                  className="rounded-lg p-3 text-center border-2 relative"
                  style={{
                    backgroundColor: "#2a2a3e",
                    borderColor: "rgba(251, 191, 36, 0.3)",
                  }}
                >
                  {/* Express Badge */}
                  <div className="absolute top-2 right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-0.5 rounded">
                    Express
                  </div>

                  {/* Zap Icon */}
                  <div className="text-yellow-400 text-2xl mb-2">⚡</div>

                  {/* Label */}
                  <div className="text-yellow-400 text-xs font-bold mb-1">SPECIAL MASHUP</div>

                  {/* Size */}
                  <div className="text-white font-bold text-sm mb-2">{pkg.size}</div>

                  {/* Price */}
                  <div className="text-yellow-400 font-bold text-base mb-2">GHC {pkg.price.toFixed(2)}</div>

                  {/* Buy Now Button */}
                  <button className="w-full bg-yellow-500 text-black font-bold py-1 rounded text-xs hover:bg-yellow-600">
                    Buy Now
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* FOOTER */}
          <div className="absolute bottom-2 left-0 right-0 text-center text-gray-500 text-xs">
            Output: {FLYER_W} × {FLYER_H} px. Contact shown: {supportNumber}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MashupFlyerGenerator;
