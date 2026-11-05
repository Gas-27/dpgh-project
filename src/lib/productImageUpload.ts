import { supabase } from "@/integrations/supabase/client";

const BUCKET = "public-store-products";
const MAX_SIDE = 1600;
const MAX_BYTES = 5 * 1024 * 1024;

function loadBitmap(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read image")); };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function compressImage(file: File): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  const img = await loadBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.85, 0.7, 0.55]) {
    const webp = await canvasToBlob(canvas, "image/webp", quality);
    if (webp && webp.type === "image/webp") {
      if (webp.size <= MAX_BYTES) return { blob: webp, ext: "webp" };
      continue;
    }
    // Browser has no webp encoder: fall back to jpeg (fill transparency with white first).
    const flat = document.createElement("canvas");
    flat.width = canvas.width;
    flat.height = canvas.height;
    const flatCtx = flat.getContext("2d");
    if (!flatCtx) throw new Error("Canvas unavailable");
    flatCtx.fillStyle = "#ffffff";
    flatCtx.fillRect(0, 0, flat.width, flat.height);
    flatCtx.drawImage(canvas, 0, 0);
    const jpeg = await canvasToBlob(flat, "image/jpeg", quality);
    if (jpeg && jpeg.size <= MAX_BYTES) return { blob: jpeg, ext: "jpg" };
  }
  throw new Error("Image is too large after compression");
}

/** Resizes the image in the browser, uploads it to Supabase Storage and returns its public https URL. */
export async function uploadProductImage(storeId: string, file: File): Promise<string> {
  const { blob, ext } = await compressImage(file);
  const path = `stores/${storeId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
