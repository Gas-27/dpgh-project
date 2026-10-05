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
export const REGIONS: Record<string, Region> = {
  storeName: { x: 0.2, y: 0.021, width: 0.37, height: 0.046 },
  accessCode: { x: 0.42, y: 0.494, width: 0.22, height: 0.016 },
  storeUrl: { x: 0.377, y: 0.812, width: 0.473, height: 0.015 },
  mtnTable: { x: 0.039, y: 0.241, width: 0.225, height: 0.166 },
  telecelTable: { x: 0.293, y: 0.241, width: 0.218, height: 0.166 },
  airteltigoTable: { x: 0.539, y: 0.241, width: 0.199, height: 0.166 },
};

const px = (region: Region): Region => ({ x: region.x * WIDTH, y: region.y * HEIGHT, width: region.width * WIDTH, height: region.height * HEIGHT });

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, min: number, font: string) {
  let current = size;
  while (current > min) {
    ctx.font = font.replace("SIZE", String(current));
    if (ctx.measureText(text).width <= maxWidth) return current;
    current -= 1;
  }
  return current;
}

function drawStoreName(ctx: CanvasRenderingContext2D, value: string, region: Region) {
  const title = value.trim().toUpperCase() || "STORE";
  const lines = title.length > 14 ? [title.slice(0, Math.ceil(title.length / 2)), title.slice(Math.ceil(title.length / 2))] : [title];
  const size = fit(ctx, lines.sort((a, b) => b.length - a.length)[0], region.width, 47, 18, "900 italic SIZEpx Montserrat, Arial, sans-serif");
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 italic ${size}px Montserrat, Arial, sans-serif`;
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#063578";
  ctx.shadowColor = "#00aaff";
  ctx.shadowBlur = 12;
  lines.forEach((line, index) => {
    const y = region.y + region.height / 2 + (index - (lines.length - 1) / 2) * (size * 0.82);
    for (let copy = 6; copy >= 1; copy -= 1) { ctx.strokeStyle = "#063578"; ctx.strokeText(line, region.x + region.width / 2 + copy * 2, y + copy * 2); }
    ctx.strokeStyle = "#063578";
    ctx.fillStyle = "#fff";
    ctx.strokeText(line, region.x + region.width / 2, y);
    ctx.fillText(line, region.x + region.width / 2, y);
  });
  ctx.restore();
}

function drawRows(ctx: CanvasRenderingContext2D, list: FlyerPackage[], region: Region, color: string) {
  const rows = [...list].sort((a, b) => a.size_gb - b.size_gb).slice(0, 11);
  const rowHeight = region.height / 11;
  const size = Math.max(12, Math.min(17, rowHeight * 0.72));
  ctx.save();
  ctx.font = `600 ${size}px Oswald, Arial Narrow, sans-serif`;
  ctx.textBaseline = "middle";
  rows.forEach((item, index) => {
    const y = region.y + rowHeight * index + rowHeight / 2;
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.fillText(`${item.size_gb}GB`, region.x + region.width * 0.05, y);
    ctx.textAlign = "right";
    ctx.fillStyle = color;
    ctx.fillText(Number(item.price).toFixed(2), region.x + region.width * 0.95, y);
  });
  ctx.restore();
}

export function DynamicFlyer({ storeName, bannerText = "DATA PLUG", accessCode, storeUrl, packages }: { storeName: string; bannerText?: string; accessCode: string; storeUrl: string; packages: FlyerPackages }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [calibrate, setCalibrate] = useState(false);
  const [sample, setSample] = useState(false);
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = WIDTH * SCALE;
    canvas.height = HEIGHT * SCALE;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.drawImage(image, 0, 0, WIDTH, HEIGHT);
    const values = sample ? { name: "DEMO DATA STORE", code: "123456", url: "https://store.example.com", data: { mtn: [{ size_gb: 1, price: 5.5 }, { size_gb: 5, price: 20 }], telecel: [{ size_gb: 2, price: 10 }], airteltigo: [{ size_gb: 3, price: 14 }] } } : { name: storeName, code: accessCode, url: storeUrl, data: packages };
    const nameRegion = px(REGIONS.storeName);
    drawStoreName(ctx, values.name, nameRegion);
    const codeRegion = px(REGIONS.accessCode);
    ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `700 ${fit(ctx, values.code || "—", codeRegion.width, 20, 10, "700 SIZEpx Arial, sans-serif")}px Arial, sans-serif`; ctx.fillStyle = "#fff9a5"; ctx.shadowColor = "#ffe600"; ctx.shadowBlur = 6; ctx.fillText(values.code || "—", codeRegion.x + codeRegion.width / 2, codeRegion.y + codeRegion.height / 2); ctx.restore();
    const urlRegion = px(REGIONS.storeUrl);
    ctx.save(); ctx.textAlign = "left"; ctx.textBaseline = "middle"; let url = values.url || ""; let urlSize = fit(ctx, url, urlRegion.width, 16, 9, "600 SIZEpx Arial, sans-serif"); if (ctx.measureText(url).width > urlRegion.width) { url = url.replace(/^https?:\/\//, ""); urlSize = fit(ctx, url, urlRegion.width, 16, 9, "600 SIZEpx Arial, sans-serif"); } ctx.font = `600 ${urlSize}px Arial, sans-serif`; ctx.fillStyle = "#fff"; ctx.fillText(url, urlRegion.x, urlRegion.y + urlRegion.height / 2); ctx.restore();
    drawRows(ctx, values.data.mtn, px(REGIONS.mtnTable), "#ffe600"); drawRows(ctx, values.data.telecel, px(REGIONS.telecelTable), "#fff"); drawRows(ctx, values.data.airteltigo, px(REGIONS.airteltigoTable), "#fff");
    if (calibrate) { ctx.save(); ctx.lineWidth = 2; Object.entries(REGIONS).forEach(([key, raw], index) => { const r = px(raw); ctx.strokeStyle = ["#ff00cc", "#00ffcc", "#ffff00", "#ff6600", "#66aaff", "#ffffff"][index] || "#fff"; ctx.strokeRect(r.x, r.y, r.width, r.height); ctx.fillStyle = ctx.strokeStyle; ctx.font = "12px monospace"; ctx.fillText(key, r.x, r.y - 3); }); ctx.restore(); }
  }, [accessCode, calibrate, image, packages, sample, storeName, storeUrl]);
  useEffect(() => { const img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => setImage(img); img.src = "/flyer-template.png"; }, []);
  useEffect(() => { void document.fonts?.ready.then(draw); }, [draw]);
  const download = () => { const canvas = canvasRef.current; if (!canvas) return; const link = document.createElement("a"); link.download = `${(storeName || "store").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-flyer.png`; link.href = canvas.toDataURL("image/png"); link.click(); };
  const share = async () => { const canvas = canvasRef.current; if (!canvas) return; const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png")); if (!blob || !navigator.share) return download(); const file = new File([blob], `${storeName || "store"}-flyer.png`, { type: "image/png" }); if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: `${storeName} flyer` }); else download(); };
  return <Card className="space-y-4 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-semibold">Flyer Generator</h2><p className="text-sm text-muted-foreground">Storefront data is drawn directly into the blank flyer regions.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={download}><Download className="mr-2 h-4 w-4" />Download PNG</Button><Button onClick={share}><Share2 className="mr-2 h-4 w-4" />Share</Button><Button variant={sample ? "default" : "outline"} onClick={() => setSample((value) => !value)}>Sample text</Button><Button variant={calibrate ? "default" : "ghost"} size="icon" onClick={() => setCalibrate((value) => !value)} aria-label="Toggle calibration"><SlidersHorizontal className="h-4 w-4" /></Button></div></div><canvas ref={canvasRef} className="mx-auto h-auto w-full max-w-[720px] rounded-lg" aria-label={`${storeName} promotional flyer`} />{calibrate && <pre className="max-h-48 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(REGIONS, null, 2)}</pre>}</Card>;
}

export default DynamicFlyer;
