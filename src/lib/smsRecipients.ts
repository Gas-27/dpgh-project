import { createWorker } from "tesseract.js";

/** Normalize any Ghana phone format (+233, 233, 00233, missing zero) to 0XXXXXXXXX, or null. */
export const normalizeGh = (raw: string): string | null => {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00233")) d = "0" + d.slice(5);
  else if (d.startsWith("233") && d.length >= 12) d = "0" + d.slice(3);
  if (d.length === 9 && /^[2-5]/.test(d)) d = "0" + d;
  if (d.length > 10) {
    const tail10 = d.slice(-10);
    const tail9 = d.slice(-9);
    if (/^0[2-5]\d{8}$/.test(tail10)) d = tail10;
    else if (/^[2-5]\d{8}$/.test(tail9)) d = "0" + tail9;
  }
  return /^0[2-5]\d{8}$/.test(d) ? d : null;
};

/** Extract every valid Ghana number from free-form text or OCR output. */
export const extractNumbers = (text: string): string[] => {
  const chunks = text.match(/(?:\+?233|00233|0)?(?:[\s.\-()]*\d){9,10}/g) || [];
  const out = new Set<string>();
  for (const chunk of chunks) {
    const n = normalizeGh(chunk);
    if (n) out.add(n);
  }
  return Array.from(out);
};

const preprocessScreenshot = async (file: File): Promise<HTMLCanvasElement> => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(3, Math.max(1.5, 1800 / bitmap.width));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return canvas;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < image.data.length; index += 4) {
    const gray = image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114;
    const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.45 + 128));
    image.data[index] = contrast;
    image.data[index + 1] = contrast;
    image.data[index + 2] = contrast;
  }
  context.putImageData(image, 0, 0);
  bitmap.close();
  return canvas;
};

/** Read numbers from screenshots (OCR) and TXT/CSV files. */
export const extractNumbersFromFiles = async (files: FileList | File[]): Promise<string[]> => {
  const list = Array.from(files);
  const needsOcr = list.some((file) => file.type.startsWith("image/"));
  const worker = needsOcr ? await createWorker("eng") : null;
  const found = new Set<string>();
  try {
    for (const file of list) {
      let text = "";
      if (file.type.startsWith("image/") && worker) {
        const prepared = await preprocessScreenshot(file);
        text = (await worker.recognize(prepared)).data.text;
      } else if (/\.(txt|csv|tsv)$/i.test(file.name) || file.type.includes("text") || file.type.includes("csv")) {
        text = await file.text();
      }
      extractNumbers(text).forEach((n) => found.add(n));
    }
  } finally {
    await worker?.terminate();
  }
  return Array.from(found);
};
