import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Download, Loader2, Share2, Save, RotateCcw, Image,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toPng } from "html-to-image";

interface DataPackage {
    id: string;
    network: string;
    size_gb: number;
    price: number;
    agent_price: number;
    active: boolean;
}

interface FlyerGeneratorProps {
    storeName: string;
    storeUrl: string;
    whatsappNumber: string;
    supportNumber: string;
    packages: DataPackage[];
    agentPrices: Record<string, number>;
}

// Default colors matching the agent flyer
const DEFAULT_FLYER_COLORS = {
    mtnColor: "#fbbf24",
    airtelColor: "#dc2626",
    telecelColor: "#dc2626",
    buttonBg: "#2563eb",
};

// Flyer dimensions - 1080x1920 (standard mobile portrait)
const FLYER_W = 1080;
const FLYER_H = 1920;

const FlyerGenerator = ({
    storeName,
    storeUrl,
    whatsappNumber,
    supportNumber,
    packages,
    agentPrices,
}: FlyerGeneratorProps) => {
    const { toast } = useToast();
    const flyerRef = useRef<HTMLDivElement>(null);
    const flyerContainerRef = useRef<HTMLDivElement>(null);
    const [generating, setGenerating] = useState(false);
    const [flyerScale, setFlyerScale] = useState(1);
    const [flyerColors, setFlyerColors] = useState(() => {
        const saved = localStorage.getItem("subagentFlyerColors");
        return saved ? JSON.parse(saved) : DEFAULT_FLYER_COLORS;
    });
    const [shareText, setShareText] = useState("");

    useEffect(() => {
        setShareText(`🎉 Get the best data deals from ${storeName}!\n\n📱 MTN • AirtelTigo • Telecel\n💨 Instant delivery • 24/7 Support\n\nVisit: ${storeUrl}\nWhatsApp: ${whatsappNumber}`);
    }, [storeName, storeUrl, whatsappNumber]);

    // Calculate scale to fit container
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

    // Get packages by network
    const mtnPackages = packages.filter(p => p.network === "mtn" && p.active !== false);
    const airtelPackages = packages.filter(p => p.network === "airteltigo" && p.active !== false);
    const telecelPackages = packages.filter(p => p.network === "telecel" && p.active !== false);

    // Get sorted packages for flyer
    const getMtnPkgs = () => mtnPackages.sort((a, b) => a.size_gb - b.size_gb).map(p => ({ size: p.size_gb, price: getPrice(p) }));
    const getAirtelPkgs = () => airtelPackages.sort((a, b) => a.size_gb - b.size_gb).map(p => ({ size: p.size_gb, price: getPrice(p) }));
    const getTelecelPkgs = () => telecelPackages.sort((a, b) => a.size_gb - b.size_gb).map(p => ({ size: p.size_gb, price: getPrice(p) }));

    const mtnPkgs = getMtnPkgs();
    const airtelPkgs = getAirtelPkgs();
    const telecelPkgs = getTelecelPkgs();

    const saveFlyerColors = (colors: typeof flyerColors) => {
        setFlyerColors(colors);
        localStorage.setItem("subagentFlyerColors", JSON.stringify(colors));
        toast({ title: "Flyer colours saved!" });
    };

    const downloadFlyer = async () => {
        if (!flyerRef.current) return;
        setGenerating(true);
        try {
            const dataUrl = await toPng(flyerRef.current, {
                quality: 1,
                pixelRatio: 2,
                width: FLYER_W,
                height: FLYER_H,
            });
            const link = document.createElement("a");
            link.download = `${storeName.replace(/\s+/g, "-")}-flyer.png`;
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

    const previewAsImage = async () => {
        if (!flyerRef.current) return;
        setGenerating(true);
        try {
            const dataUrl = await toPng(flyerRef.current, { quality: 1, pixelRatio: 2, width: FLYER_W, height: FLYER_H });
            // Open in new window with full-screen display
            const newWindow = window.open("", "_blank");
            if (newWindow) {
                newWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>${storeName} - Flyer</title>
                        <style>
                            * { margin: 0; padding: 0; box-sizing: border-box; }
                            body { 
                                background: #000; 
                                min-height: 100vh; 
                                display: flex; 
                                justify-content: center; 
                                align-items: center;
                                padding: 10px;
                            }
                            img { 
                                max-width: 100%; 
                                max-height: 100vh; 
                                width: auto;
                                height: auto;
                                object-fit: contain;
                            }
                        </style>
                    </head>
                    <body>
                        <img src="${dataUrl}" alt="${storeName} Flyer" />
                    </body>
                    </html>
                `);
                newWindow.document.close();
            }
        } catch (error) {
            toast({ title: "Error", description: "Could not generate preview.", variant: "destructive" });
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
                pixelRatio: 2,
                width: FLYER_W,
                height: FLYER_H,
            });
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], "flyer.png", { type: "image/png" });
            const fullShareText = `${shareText}\n\nStore: ${storeUrl}`;

            if (navigator.share) {
                await navigator.share({
                    title: "Data Price Flyer",
                    text: fullShareText,
                    files: [file],
                });
                toast({ title: "Shared successfully!" });
            } else {
                await navigator.clipboard.writeText(fullShareText);
                toast({
                    title: "Text copied!",
                    description: "Share text copied. You can now share the image manually.",
                });
                const link = document.createElement("a");
                link.download = "flyer.png";
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

    // Package card component matching the agent's flyer
    const PkgCard = ({ size, price, network, accent, textColor }: { size: number; price: number; network: string; accent: string; textColor: string }) => (
        <div style={{ background: "#151515", border: `1.5px solid ${accent}50`, borderRadius: 8, padding: "8px 4px", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff" }}>{size}GB</div>
            <div style={{ fontSize: 11, color: accent, fontWeight: 700, marginTop: 2, textTransform: "uppercase" }}>{network}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#ccc", marginTop: 4 }}>GHC{price.toFixed(2)}</div>
            <div style={{ marginTop: 6, background: accent, borderRadius: 6, padding: "4px 0", fontSize: 11, fontWeight: 800, color: textColor }}>BUY NOW</div>
        </div>
    );

    return (
        <div className="space-y-4">
            <Card className="border-border">
                <CardHeader className="pb-3">
                    <CardTitle className="font-display flex items-center gap-2">
                        <Image className="h-5 w-5 text-primary" /> Flyer Generator
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Live prices auto-populate. Customise colours, edit share message, then download or share directly to WhatsApp.
                    </p>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex flex-wrap gap-3 items-center">
                            {([
                                { label: "MTN", key: "mtnColor" },
                                { label: "Airtel", key: "airtelColor" },
                                { label: "Telecel", key: "telecelColor" },
                                { label: "Brand", key: "buttonBg" },
                            ] as { label: string; key: keyof typeof flyerColors }[]).map(({ label, key }) => (
                                <div key={key} className="flex items-center gap-2">
                                    <Label className="text-xs">{label}</Label>
                                    <Input
                                        type="color"
                                        value={flyerColors[key]}
                                        onChange={e => setFlyerColors({ ...flyerColors, [key]: e.target.value })}
                                        className="w-10 h-8 p-0 cursor-pointer"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => saveFlyerColors(flyerColors)}>
                                <Save className="h-3 w-3 mr-1" /> Save
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => saveFlyerColors(DEFAULT_FLYER_COLORS)}>
                                <RotateCcw className="h-3 w-3 mr-1" /> Reset
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-sm font-medium">
                            Share Message <span className="text-muted-foreground font-normal text-xs">(editable)</span>
                        </Label>
                        <Textarea value={shareText} onChange={e => setShareText(e.target.value)} rows={4} className="text-sm font-mono" />
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Button variant="outline" onClick={downloadFlyer} disabled={generating} className="gap-2 flex-1 sm:flex-none">
                            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download PNG
                        </Button>
                        <Button variant="hero" onClick={previewAsImage} disabled={generating} className="gap-2 flex-1 sm:flex-none">
                            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Image className="h-4 w-4" />} Preview as Image
                        </Button>
                        <Button variant="secondary" onClick={shareFlyer} disabled={generating} className="gap-2 flex-1 sm:flex-none">
                            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Share Flyer
                        </Button>
                    </div>

                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-sm">
                        <p className="font-semibold flex items-center gap-1"><Image className="h-4 w-4" /> How to save & share</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            📱 <strong>Mobile:</strong> Tap &quot;Share Flyer&quot; to send the image directly via WhatsApp (native share sheet).<br />
                            💻 <strong>Desktop:</strong> The image will be downloaded, then WhatsApp opens with your message – attach the downloaded image manually.<br />
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
                    {/* TOP NAV */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", backgroundColor: "#0a0a0a", borderBottom: "1px solid #1e1e1e" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 36, height: 36, background: flyerColors.buttonBg, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            </div>
                            <span style={{ fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: 0.5 }}>{storeName.toUpperCase()}</span>
                        </div>
                        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                            {["Packages", "Services", "Become an Agent"].map(l => (
                                <span key={l} style={{ fontSize: 14, color: "#666", fontWeight: 500 }}>{l}</span>
                            ))}
                            <span style={{ fontSize: 13, color: flyerColors.buttonBg, fontWeight: 700, padding: "5px 14px", background: `${flyerColors.buttonBg}20`, borderRadius: 7, border: `1px solid ${flyerColors.buttonBg}40` }}>Agent Dashboard</span>
                            <span style={{ fontSize: 14, color: "#888" }}>Sign Out</span>
                        </div>
                    </div>

                    {/* Title */}
                    <div style={{ textAlign: "center", padding: "30px 20px 14px" }}>
                        <div style={{ fontSize: 46, fontWeight: 900, color: "#fff", letterSpacing: -1, textTransform: "uppercase" }}>DATA BUNDLES – ALL NETWORKS</div>
                        <div style={{ fontSize: 18, color: "#777", marginTop: 6 }}>Affordable. Instant. Reliable.</div>
                    </div>

                    {/* Network tabs */}
                    <div style={{ display: "flex", justifyContent: "center", margin: "0 auto 20px", width: "fit-content" }}>
                        {[
                            { label: "MTN", bg: flyerColors.mtnColor, txt: "#000" },
                            { label: "AirtelTigo", bg: flyerColors.airtelColor, txt: "#fff" },
                            { label: "Telecel", bg: flyerColors.telecelColor, txt: "#fff" },
                        ].map((tab, i) => (
                            <div key={tab.label} style={{ padding: "13px 52px", background: tab.bg, color: tab.txt, fontSize: 17, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, borderRadius: i === 0 ? "9px 0 0 9px" : i === 2 ? "0 9px 9px 0" : "0", border: `2px solid ${tab.bg}` }}>{tab.label}</div>
                        ))}
                    </div>

                    {/* MTN Section */}
                    <div style={{ margin: "0 20px 16px", border: `2px solid ${flyerColors.mtnColor}50`, borderRadius: 14, overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", backgroundColor: "#0e0b00", borderBottom: `1px solid ${flyerColors.mtnColor}30` }}>
                            <span style={{ fontSize: 22, fontWeight: 900, color: flyerColors.mtnColor, letterSpacing: 1, textTransform: "uppercase" }}>MTN DATA BUNDLES</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: flyerColors.mtnColor, border: `2px solid ${flyerColors.mtnColor}`, borderRadius: 20, padding: "4px 16px" }}>MTN</span>
                        </div>
                        <div style={{ backgroundColor: "#0a0800", padding: "10px 10px 12px", display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 7 }}>
                            {mtnPkgs.map(({ size, price }) => <PkgCard key={size} size={size} price={price} network="MTN" accent={flyerColors.mtnColor} textColor="#000" />)}
                        </div>
                    </div>

                    {/* AirtelTigo Section */}
                    <div style={{ margin: "0 20px 16px", border: `2px solid ${flyerColors.airtelColor}50`, borderRadius: 14, overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", backgroundColor: "#06041a", borderBottom: `1px solid ${flyerColors.airtelColor}30` }}>
                            <span style={{ fontSize: 22, fontWeight: 900, color: flyerColors.airtelColor, letterSpacing: 1, textTransform: "uppercase" }}>AIRTELTIGO DATA BUNDLES</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: flyerColors.airtelColor, border: `2px solid ${flyerColors.airtelColor}`, borderRadius: 20, padding: "4px 16px" }}>airtel tigo</span>
                        </div>
                        <div style={{ backgroundColor: "#050314", padding: "10px 10px 12px", display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 7 }}>
                            {airtelPkgs.map(({ size, price }) => <PkgCard key={size} size={size} price={price} network="AIRTELTIGO" accent={flyerColors.airtelColor} textColor="#fff" />)}
                        </div>
                    </div>

                    {/* Telecel Section */}
                    <div style={{ margin: "0 20px 16px", border: `2px solid ${flyerColors.telecelColor}50`, borderRadius: 14, overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px", backgroundColor: "#120000", borderBottom: `1px solid ${flyerColors.telecelColor}30` }}>
                            <span style={{ fontSize: 22, fontWeight: 900, color: flyerColors.telecelColor, letterSpacing: 1, textTransform: "uppercase" }}>TELECEL DATA BUNDLES</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: flyerColors.telecelColor, border: `2px solid ${flyerColors.telecelColor}`, borderRadius: 20, padding: "4px 16px" }}>telecel</span>
                        </div>
                        <div style={{ backgroundColor: "#0e0000", padding: "10px 10px 12px", display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 7 }}>
                            {telecelPkgs.map(({ size, price }) => <PkgCard key={size} size={size} price={price} network="TELECEL" accent={flyerColors.telecelColor} textColor="#fff" />)}
                        </div>
                    </div>

                    {/* Contact footer */}
                    <div style={{ margin: "0 20px 16px", background: "#0d7c30", borderRadius: 14, padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <svg width="30" height="30" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                            </div>
                            <div>
                                <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 }}>NEED HELP OR HAVE QUESTIONS?</div>
                                <div style={{ fontSize: 14, color: "#86efac", marginTop: 3 }}>Contact us directly on WhatsApp or Call.</div>
                            </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(0,0,0,0.35)", borderRadius: 40, padding: "12px 30px", border: "1.5px solid rgba(255,255,255,0.15)", flexShrink: 0 }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                            <span style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: 1 }}>{supportNumber || whatsappNumber}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#25D366", borderRadius: 40, padding: "12px 24px", flexShrink: 0 }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                            <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Chat on WhatsApp</span>
                        </div>
                    </div>

                    {/* Store URL */}
                    <div style={{ textAlign: "center", paddingBottom: 24, fontSize: 16, color: "#444" }}>
                        <span style={{ color: flyerColors.buttonBg }}>{storeUrl}</span>
                    </div>
                </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
                Output: {FLYER_W} × {FLYER_H} px. Contact shown: <strong>{supportNumber || whatsappNumber || "— set in Settings"}</strong>
            </p>
        </div>
    );
};

export default FlyerGenerator;
