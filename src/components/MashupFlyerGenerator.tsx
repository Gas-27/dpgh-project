import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Loader2, Share2, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toPng } from "html-to-image";
import { Zap } from "lucide-react";

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

const DEFAULT_MASHUP_COLORS = {
  bg: "#1a1a1a",
  accent: "#fbbf24",
  text: "#ffffff",
  buttonBg: "#2563eb",
};

const FLYER_W = 1080;
const FLYER_H = 1920;

const MashupFlyerGenerator = ({
  storeName,
  storeUrl,
  whatsappNumber,
  supportNumber,
  packages,
  agentPrices,
  topupReference,
  isSubagent = false,
}: MashupFlyerGeneratorProps) => {
  const { toast } = useToast();
  const flyerRef = useRef<HTMLDivElement>(null);
  const flyerContainerRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [flyerScale, setFlyerScale] = useState(1);
  const [flyerColors, setFlyerColors] = useState(() => {
    const key = isSubagent ? "subagentMashupFlyerColors" : "agentMashupFlyerColors";
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : DEFAULT_MASHUP_COLORS;
  });
  const [shareText, setShareText] = useState("");

  useEffect(() => {
    const ussdText = topupReference ? `\n\n📲 USSD: *380*455#\n🔑 Access Code: ${topupReference}` : "";
    setShareText(`🎉 Special MTN Mashup from ${storeName}!\n\n💨 125 mins + 0.36GB from GHC 6.00\n⚡ Express delivery • 24/7 Support${ussdText}\n\nVisit: ${storeUrl}\nWhatsApp: ${whatsappNumber}`);
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

  // Get mashup packages (both mtn_mashup and mashup networks)
  const mashupPackages = packages.filter(p => (p.network === "mtn_mashup" || p.network === "mashup") && p.active !== false);
  const sortedMashupPackages = mashupPackages.sort((a, b) => {
    const sizeA = a.size_gb || 0;
    const sizeB = b.size_gb || 0;
    return sizeA - sizeB;
  });

  const getMashupPkgs = () =>
    sortedMashupPackages.map(p => ({
      id: p.id,
      display: p.size_gb_text || `${p.size_gb}GB`,
      price: getPrice(p),
    }));

  const mashupPkgs = getMashupPkgs();

  const saveFlyerColors = (colors: typeof flyerColors) => {
    const key = isSubagent ? "subagentMashupFlyerColors" : "agentMashupFlyerColors";
    setFlyerColors(colors);
    localStorage.setItem(key, JSON.stringify(colors));
    toast({ title: "Flyer colours saved!" });
  };

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
          transform: 'none',
          transformOrigin: 'top left',
        },
        canvasWidth: FLYER_W,
        canvasHeight: FLYER_H,
      });
      const link = document.createElement("a");
      link.download = `${storeName.replace(/\s+/g, "-")}-mashup-flyer.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: "Flyer downloaded!", description: "Saved as PNG." });
    } catch (error) {
      console.error("Error generating flyer:", error);
      toast({ title: "Error", description: "Could not generate flyer.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard!" });
  };

  const resetColors = () => {
    saveFlyerColors(DEFAULT_MASHUP_COLORS);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" /> Special MTN Mashup Flyer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Flyer Preview */}
          <div
            ref={flyerContainerRef}
            className="flex justify-center bg-gray-900 rounded-lg p-4 overflow-x-auto"
          >
            <div
              ref={flyerRef}
              style={{
                width: FLYER_W,
                height: FLYER_H,
                transform: `scale(${flyerScale})`,
                transformOrigin: 'top center',
                backgroundColor: flyerColors.bg,
              }}
              className="relative text-white p-6 space-y-6 flex flex-col"
            >
              {/* Header */}
              <div className="text-center space-y-2">
                <h1 className="text-4xl font-bold">{storeName}</h1>
                <p className="text-sm opacity-75">Special MTN Mashup Data</p>
              </div>

              {/* USSD Code Section */}
              <div className="border-2 border-yellow-500 rounded-lg p-4 text-center space-y-2">
                <div className="text-xs font-semibold text-yellow-400">USSD CODE</div>
                <div className="text-3xl font-bold" style={{ color: flyerColors.accent }}>*380*455#</div>
                <div className="text-xs">Dial to purchase instantly.</div>
              </div>

              {/* Access Code Section */}
              <div className="border-2 border-green-500 rounded-lg p-4 text-center space-y-2">
                <div className="text-xs font-semibold text-green-400">ACCESS CODE</div>
                <div className="text-3xl font-bold">{topupReference || "0"}</div>
                <div className="text-xs">Required for all purchases.</div>
              </div>

              {/* Contact Section */}
              <div className="border-2 border-green-500 rounded-lg p-4 space-y-2">
                <div className="text-center">
                  <div className="text-xs font-semibold text-green-400 mb-2">NEED HELP OR HAVE QUESTIONS?</div>
                  <div className="text-2xl font-bold">{supportNumber}</div>
                  <div className="text-xs mt-2">Contact us directly on WhatsApp or Call.</div>
                </div>
              </div>

              {/* Packages Grid */}
              <div className="grid grid-cols-2 gap-3 flex-1">
                {mashupPkgs.slice(0, 8).map((pkg, idx) => (
                  <div
                    key={pkg.id || idx}
                    className="border-2 rounded-lg p-3 text-center space-y-2"
                    style={{ borderColor: flyerColors.accent }}
                  >
                    <div className="flex justify-between items-start">
                      <Zap className="h-4 w-4" style={{ color: flyerColors.accent }} />
                      <span
                        className="text-xs font-bold px-2 py-1 rounded"
                        style={{ backgroundColor: flyerColors.accent, color: '#000' }}
                      >
                        Express
                      </span>
                    </div>
                    <div>
                      <div className="text-xs opacity-75 uppercase">Special Mashup</div>
                      <div className="text-lg font-bold">{pkg.display}</div>
                    </div>
                    <div
                      className="text-2xl font-bold"
                      style={{ color: flyerColors.accent }}
                    >
                      GHC {pkg.price.toFixed(2)}
                    </div>
                    <button
                      className="w-full py-2 rounded font-bold text-sm"
                      style={{ backgroundColor: flyerColors.buttonBg, color: '#fff' }}
                    >
                      Buy Now
                    </button>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="text-center text-xs opacity-50">
                {storeUrl}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-4 border-t pt-4">
            <div>
              <Label className="text-sm font-semibold">Flyer Accent Color</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  type="color"
                  value={flyerColors.accent}
                  onChange={(e) => setFlyerColors({ ...flyerColors, accent: e.target.value })}
                  className="h-10 w-20"
                />
                <Button
                  variant="outline"
                  onClick={() => saveFlyerColors(flyerColors)}
                  size="sm"
                >
                  Save Colors
                </Button>
                <Button
                  variant="outline"
                  onClick={resetColors}
                  size="sm"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={downloadFlyer} disabled={generating} variant="default">
                {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Download Flyer
              </Button>
              <Button onClick={() => copyToClipboard(shareText)} variant="outline">
                <Share2 className="h-4 w-4 mr-2" /> Copy Share Text
              </Button>
            </div>

            {/* Share Preview */}
            <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg space-y-2">
              <Label className="text-sm font-semibold">Share Text Preview</Label>
              <p className="text-sm whitespace-pre-wrap break-words opacity-75">{shareText}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MashupFlyerGenerator;
