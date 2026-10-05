"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Share2, SlidersHorizontal } from "lucide-react";

export type FlyerPackage = { size_gb: number; price: number };
export type FlyerPackages = { mtn: FlyerPackage[]; telecel: FlyerPackage[]; airteltigo: FlyerPackage[] };

type Region = { x: number; y: number; width: number; height: number };
const WIDTH = 720;
const HEIGHT = 1280;
const SCALE = 2;
const REGIONS: Record<string, Region> = {
  storeName: { x: 150, y: 24, width: 270, height: 82 },
  accessCode: { x: 265, y: 570, width: 215, height: 48 },
  storeUrl: { x: 270, y: 1035, width: 420, height: 32 },
  mtnTable: { x: 28, y: 318, width: 162, height: 209 },
  telecelTable: { x: 213, y: 318, width: 162, height: 209 },
  airteltigoTable: { x: 390, y: 318, width: 140, height: 209 },
};

function fitText(ctx: CanvasRenderingContext2D, text: string, region: Region, preferred: number, min: number) {
  let size = preferred;
  while (size > min) {
    ctx.font = `900 italic ${size}px Arial, sans-serif`;
    if (ctx.measureText(text).width <= region.width) break;
    size -= 1;
  }
  return size;
}

function patch(ctx: CanvasRenderingContext2D, region: Region) {
  const gradient = ctx.createLinearGradient(region.x, region.y, region.x + region.width, region.y + region.height);
  gradient.addColorStop(0, "rgba(5,18,68,.88)");
  gradient.addColorStop(.5, "rgba(5,22,80,.82)");
  gradient.addColorStop(1, "rgba(4,10,40,.76)");
  ctx.save();
  ctx.filter = "blur(3px)";
  ctx.fillStyle = gradient;
  ctx.fillRect(region.x - 4, region.y - 4, region.width + 8, region.height + 8);
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, shadow = "#08b9ff") {
  ctx.save();
  ctx.shadowColor = shadow;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawRows(ctx: CanvasRenderingContext2D, packages: FlyerPackage[], region: Region, priceColor: string) {
  const rows = [...packages].sort((a, b) => a.size_gb - b.size_gb).slice(0, 11);
  const rowHeight = region.height / 11;
  ctx.font = "700 16px Arial Narrow, Arial, sans-serif";
  rows.forEach((pkg, index) => {
    const y = region.y + rowHeight * index + rowHeight * .72;
    drawText(ctx, `${pkg.size_gb}GB`, region.x + 8, y, "#fff", "#166eff");
    ctx.textAlign = "right";
    drawText(ctx, Number(pkg.price).toFixed(2), region.x + region.width - 8, y, priceColor, priceColor);
    ctx.textAlign = "left";
  });
}

export function DynamicFlyer({ storeName, accessCode, storeUrl, packages }: { storeName: string; accessCode: string; storeUrl: string; packages: FlyerPackages }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [debug, setDebug] = useState(false);
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = WIDTH * SCALE;
    canvas.height = HEIGHT * SCALE;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.drawImage(image, 0, 0, WIDTH, HEIGHT);
    const title = storeName.trim().toUpperCase() || "STORE";
    patch(ctx, REGIONS.storeName);
    ctx.textAlign = "center";
    ctx.font = `900 italic ${fitText(ctx, title, REGIONS.storeName, 54, 25)}px Arial, sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#087dff";
    ctx.strokeText(title, REGIONS.storeName.x + REGIONS.storeName.width / 2, 78);
    drawText(ctx, title, REGIONS.storeName.x + REGIONS.storeName.width / 2, 78, "#fff", "#00aaff");
    ctx.textAlign = "left";
    patch(ctx, REGIONS.accessCode);
    ctx.textAlign = "center";
    ctx.font = `900 ${fitText(ctx, accessCode || "—", REGIONS.accessCode, 35, 18)}px Arial, sans-serif`;
    drawText(ctx, accessCode || "—", REGIONS.accessCode.x + REGIONS.accessCode.width / 2, 603, "#ffe600", "#ffe600");
    ctx.textAlign = "left";
    patch(ctx, REGIONS.storeUrl);
    ctx.font = `700 ${fitText(ctx, storeUrl || "", REGIONS.storeUrl, 20, 10)}px Arial, sans-serif`;
    drawText(ctx, storeUrl || "", REGIONS.storeUrl.x, 1058, "#fff", "#007dff");
    drawRows(ctx, packages.mtn, REGIONS.mtnTable, "#ffe600");
    drawRows(ctx, packages.telecel, REGIONS.telecelTable, "#fff");
    drawRows(ctx, packages.airteltigo, REGIONS.airteltigoTable, "#fff");
    if (debug) {
      ctx.strokeStyle = "#ff00cc";
      ctx.lineWidth = 2;
      Object.values(REGIONS).forEach((r) => ctx.strokeRect(r.x, r.y, r.width, r.height));
    }
  }, [accessCode, debug, image, packages, storeName, storeUrl]);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImage(img);
    img.src = "/flyer-template.png";
  }, []);
  useEffect(() => { void document.fonts?.ready.then(draw); }, [draw]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${(storeName || "store").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-flyer.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  const share = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob || !navigator.share) return download();
    const file = new File([blob], `${storeName || "store"}-flyer.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `${storeName} flyer` });
    else download();
  };

  return <Card className="space-y-4 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-lg font-semibold">Flyer Generator</h2><p className="text-sm text-muted-foreground">Live storefront data is drawn into the flyer artwork.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={download}><Download className="mr-2 h-4 w-4" />Download Flyer</Button><Button onClick={share}><Share2 className="mr-2 h-4 w-4" />Share</Button>{(import.meta as any).env?.DEV && <Button variant="ghost" size="icon" onClick={() => setDebug((v) => !v)} aria-label="Toggle calibration"><SlidersHorizontal className="h-4 w-4" /></Button>}</div>
    </div>
    <canvas ref={canvasRef} className="mx-auto h-auto w-full max-w-[720px] rounded-lg" aria-label={`${storeName} promotional flyer`} />
    {debug && <pre className="max-h-48 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(REGIONS, null, 2)}</pre>}
  </Card>;
}

export default DynamicFlyer;
