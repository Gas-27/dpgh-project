import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Download, Loader2, Share2, Palette, Save, RotateCcw,
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

// Default colors matching your image
const DEFAULT_FLYER_COLORS = {
    mtnColor: "#fbbf24",
    airtelColor: "#3b82f6",
    telecelColor: "#ef4444",
    buttonBg: "#2563eb",
    buttonText: "#ffffff",
};

// Exact sizes from your image
const MTN_SIZES = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20, 25, 30, 40, 50, 100];
const AIRTEL_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 40];
const TELECEL_SIZES = [2, 3, 5, 10, 11, 15, 16, 20, 22, 25, 30, 33, 40, 44, 50];

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
    const [generating, setGenerating] = useState(false);
    const [flyerColors, setFlyerColors] = useState(() => {
        const saved = localStorage.getItem("flyerColors");
        return saved ? JSON.parse(saved) : DEFAULT_FLYER_COLORS;
    });
    const [shareText, setShareText] = useState("");

    useEffect(() => {
        setShareText(`🎉 Get the best data deals from ${storeName}!\n\n📱 MTN • AirtelTigo • Telecel\n💨 Instant delivery • 24/7 Support\n\nVisit: ${storeUrl}\nWhatsApp: ${whatsappNumber}`);
    }, [storeName, storeUrl, whatsappNumber]);

    const getPrice = (pkg: DataPackage) => agentPrices[pkg.id] ?? pkg.price;

    const getMtnPrice = (size: number) => {
        const pkg = packages.find(p => p.network === "mtn" && p.size_gb === size);
        return pkg ? getPrice(pkg) : null;
    };
    const getAirtelPrice = (size: number) => {
        const pkg = packages.find(p => p.network === "airteltigo" && p.size_gb === size);
        return pkg ? getPrice(pkg) : null;
    };
    const getTelecelPrice = (size: number) => {
        const pkg = packages.find(p => p.network === "telecel" && p.size_gb === size);
        return pkg ? getPrice(pkg) : null;
    };

    const chunkArray = <T,>(arr: T[], size: number): T[][] => {
        const result = [];
        for (let i = 0; i < arr.length; i += size) {
            result.push(arr.slice(i, i + size));
        }
        return result;
    };

    const mtnRows = chunkArray(MTN_SIZES, 5);
    const airtelRows = chunkArray(AIRTEL_SIZES, 5);
    const telecelRows = chunkArray(TELECEL_SIZES, 5);

    const saveFlyerColors = (colors: typeof flyerColors) => {
        setFlyerColors(colors);
        localStorage.setItem("flyerColors", JSON.stringify(colors));
        toast({ title: "Flyer colours saved!" });
    };

    const downloadFlyer = async () => {
        if (!flyerRef.current) return;
        setGenerating(true);
        try {
            const dataUrl = await toPng(flyerRef.current, {
                quality: 1,
                pixelRatio: 2,
                backgroundColor: "#ffffff",
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

    const shareFlyer = async () => {
        if (!flyerRef.current) return;
        setGenerating(true);
        try {
            const dataUrl = await toPng(flyerRef.current, {
                quality: 1,
                pixelRatio: 2,
                backgroundColor: "#ffffff",
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

    const formatPhone = (phone: string) => {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('233')) return '0' + cleaned.slice(3);
        return phone;
    };

    // Render a price table row
    const renderTableRow = (sizes: number[], getPriceFn: (size: number) => number | null, networkColor: string, networkName: string) => {
        return (
            <div className="w-full mb-3">
                <div className="grid grid-cols-6 gap-0 border border-gray-200 text-[10px]">
                    {/* Header row */}
                    <div className="bg-gray-100 p-1.5 font-bold text-center border-r border-gray-200">Size</div>
                    {sizes.map((size, idx) => (
                        <div key={`header-${size}`} className="bg-gray-100 p-1.5 text-center font-semibold border-r border-gray-200 last:border-r-0">
                            {size}GB
                        </div>
                    ))}
                    {/* Network name row */}
                    <div className="bg-gray-50 p-1.5 text-center font-bold border-r border-gray-200 border-t" style={{ color: networkColor }}>
                        {networkName}
                    </div>
                    {sizes.map((size) => {
                        const price = getPriceFn(size);
                        return (
                            <div key={`price-${size}`} className="bg-gray-50 p-1.5 text-center font-bold border-r border-gray-200 border-t last:border-r-0" style={{ color: networkColor }}>
                                {price ? `GHC${price.toFixed(2)}` : "-"}
                            </div>
                        );
                    })}
                    {/* Buy Now row */}
                    <div className="bg-white p-1.5 text-center border-r border-gray-200 border-t">Buy Now</div>
                    {sizes.map((size) => (
                        <div key={`buy-${size}`} className="bg-white p-1.5 text-center border-r border-gray-200 border-t last:border-r-0">
                            <span className="inline-block px-2 py-0.5 rounded text-[8px] font-semibold" style={{ backgroundColor: flyerColors.buttonBg, color: flyerColors.buttonText }}>
                                Buy Now
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Controls */}
            <Card className="border-border">
                <CardHeader className="pb-3">
                    <CardTitle className="font-display text-base flex items-center gap-2">
                        <Palette className="h-4 w-4 text-primary" />
                        Customise Flyer
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-3 items-center justify-between">
                        <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-2">
                                <Label className="text-xs">MTN</Label>
                                <Input type="color" value={flyerColors.mtnColor} onChange={(e) => setFlyerColors({ ...flyerColors, mtnColor: e.target.value })} className="w-10 h-8 p-0" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Label className="text-xs">Airtel</Label>
                                <Input type="color" value={flyerColors.airtelColor} onChange={(e) => setFlyerColors({ ...flyerColors, airtelColor: e.target.value })} className="w-10 h-8 p-0" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Label className="text-xs">Telecel</Label>
                                <Input type="color" value={flyerColors.telecelColor} onChange={(e) => setFlyerColors({ ...flyerColors, telecelColor: e.target.value })} className="w-10 h-8 p-0" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Label className="text-xs">Button</Label>
                                <Input type="color" value={flyerColors.buttonBg} onChange={(e) => setFlyerColors({ ...flyerColors, buttonBg: e.target.value })} className="w-10 h-8 p-0" />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => saveFlyerColors(flyerColors)}><Save className="h-3 w-3 mr-1" /> Save</Button>
                            <Button variant="ghost" size="sm" onClick={() => saveFlyerColors(DEFAULT_FLYER_COLORS)}><RotateCcw className="h-3 w-3 mr-1" /> Reset</Button>
                        </div>
                    </div>

                    <div className="mt-4">
                        <Label className="text-sm">Share Message</Label>
                        <Textarea value={shareText} onChange={(e) => setShareText(e.target.value)} rows={2} className="mt-1 text-sm" />
                    </div>

                    <div className="flex gap-3 justify-end mt-4">
                        <Button variant="outline" onClick={downloadFlyer} disabled={generating} size="sm">
                            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                            Download PNG
                        </Button>
                        <Button variant="hero" onClick={shareFlyer} disabled={generating} size="sm">
                            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Share2 className="h-4 w-4 mr-1" />}
                            Share Flyer
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Flyer Preview - Exact 853x1280 dimensions */}
            <div className="flex justify-center">
                <div
                    ref={flyerRef}
                    className="bg-white shadow-xl rounded-lg overflow-hidden"
                    style={{ width: "853px", height: "1280px", fontFamily: "'Segoe UI', Arial, sans-serif" }}
                >
                    <div className="p-5 h-full flex flex-col">
                        {/* Header */}
                        <div className="text-center mb-4">
                            <h1 className="text-xl font-bold text-gray-800"># DATA BUNDLES – ALL NETWORKS</h1>
                            <p className="text-xs text-gray-500 mt-1">Affordable. Instant. Reliable.</p>
                            <div className="flex justify-center gap-4 text-sm font-bold mt-2">
                                <span style={{ color: flyerColors.mtnColor }}>MTN</span>
                                <span className="text-gray-400">|</span>
                                <span style={{ color: flyerColors.airtelColor }}>AirtelTigo</span>
                                <span className="text-gray-400">|</span>
                                <span style={{ color: flyerColors.telecelColor }}>Telecel</span>
                            </div>
                        </div>

                        {/* Store Info */}
                        <div className="text-center text-[10px] text-gray-500 border-t border-b py-1.5 mb-4">
                            <span className="font-bold text-gray-700">{storeName}</span> | {storeUrl}
                        </div>

                        {/* MTN Section */}
                        <div className="mb-4">
                            <h2 className="text-sm font-bold mb-2" style={{ color: flyerColors.mtnColor }}>MTN DATA BUNDLES</h2>
                            {mtnRows.map((row, idx) => renderTableRow(row, getMtnPrice, flyerColors.mtnColor, "MTN"))}
                        </div>

                        {/* AirtelTigo Section */}
                        <div className="mb-4">
                            <h2 className="text-sm font-bold mb-2" style={{ color: flyerColors.airtelColor }}>AIRTELTIGO DATA BUNDLES</h2>
                            {airtelRows.map((row, idx) => renderTableRow(row, getAirtelPrice, flyerColors.airtelColor, "AIRTELTIGO"))}
                        </div>

                        {/* Telecel Section */}
                        <div className="mb-4">
                            <h2 className="text-sm font-bold mb-2" style={{ color: flyerColors.telecelColor }}>TELECEL DATA BUNDLES</h2>
                            {telecelRows.map((row, idx) => renderTableRow(row, getTelecelPrice, flyerColors.telecelColor, "TELECEL"))}
                        </div>

                        {/* Footer */}
                        <div className="text-center mt-auto pt-3 border-t">
                            <p className="text-[10px] font-semibold text-gray-700">NEED HELP OR HAVE QUESTIONS?</p>
                            <p className="text-[8px] text-gray-500">Contact us directly on WhatsApp or Call.</p>
                            <p className="text-base font-bold text-primary mt-1">{formatPhone(supportNumber || whatsappNumber)}</p>
                            <div className="flex justify-center gap-3 mt-2">
                                <Button size="sm" className="h-7 text-xs" style={{ backgroundColor: "#25D366", color: "white" }}>
                                    Chat on WhatsApp
                                </Button>
                            </div>
                            <p className="text-[8px] text-gray-500 mt-2">
                                <strong>Join channel – get updates & free giveaways</strong><br />
                                Stay updated with the latest bundles, promos & offers.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
                Dimensions: 853 × 1280 pixels. Click Share to share the image + message + store link.
            </p>
        </div>
    );
};

export default FlyerGenerator;