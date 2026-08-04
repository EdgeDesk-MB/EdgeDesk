/**
 * Client-side OCR via Tesseract.js (free, no API key).
 * First run downloads ~2MB of language data in the browser.
 */
import type { BetOcrFields, ScreenshotSource } from "./types";
import { parseBetScreenshot, summariseOcrFields } from "./parse-bet-screenshot";
import { repairOcrRaceResultText } from "@/lib/racing/parse-race-result-text";

export interface OcrResult {
  text: string;
  fields: BetOcrFields;
  summary: string[];
  confidence: number;
}

export type OcrLayout = "sparse" | "auto" | "block";

export async function extractTextFromImage(
  file: File | string | Buffer | Blob,
  layout: OcrLayout = "sparse"
): Promise<{ text: string; confidence: number }> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: () => {},
  });
  try {
    // Sparse: bet-slip columns. Auto: promo paragraphs. Block: result tables.
    const mode =
      layout === "auto"
        ? PSM.AUTO
        : layout === "block"
          ? PSM.SINGLE_BLOCK
          : PSM.SPARSE_TEXT;
    await worker.setParameters({
      tessedit_pageseg_mode: mode,
    });
    const { data } = await worker.recognize(file);
    return { text: data.text, confidence: data.confidence };
  } finally {
    await worker.terminate();
  }
}

/** Free client-side OCR for offer / promo screenshots (paragraph layout). */
export async function ocrOfferScreenshot(
  file: File
): Promise<{ text: string; confidence: number }> {
  return extractTextFromImage(file, "auto");
}

/** Prefer OCR dumps that preserve fractional SPs after repair. */
function scoreRaceResultOcrText(text: string): number {
  const repaired = repairOcrRaceResultText(text);
  const fracs = repaired.match(/\b\d+\s*\/\s*\d+/g)?.length ?? 0;
  const favs = repaired.match(/\b(?:2Fav|J?Fav)\b/gi)?.length ?? 0;
  return fracs * 4 + favs * 2 + Math.min(repaired.replace(/\s/g, "").length, 800) / 400;
}

/**
 * Upscale screenshots so thin SP fractions (11/1, 20/1) survive Tesseract.
 * Browser-only; returns the original file when canvas APIs are unavailable.
 */
async function upscaleImageForOcr(file: File, scale = 2): Promise<Blob | File> {
  if (typeof createImageBitmap !== "function") return file;
  const bmp = await createImageBitmap(file);
  try {
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(bmp, 0, 0, w, h);
      return await canvas.convertToBlob({ type: "image/png" });
    }
    if (typeof document === "undefined") return file;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );
    return blob ?? file;
  } finally {
    bmp.close?.();
  }
}

/** OCR for race-result tables (Sporting Life / ATR Full Result screenshots). */
export async function ocrRaceResultScreenshot(
  file: File
): Promise<{ text: string; confidence: number }> {
  const upscaled = await upscaleImageForOcr(file, 2);
  const [block, blockUp] = await Promise.all([
    extractTextFromImage(file, "block"),
    upscaled === file
      ? Promise.resolve(null)
      : extractTextFromImage(upscaled, "block"),
  ]);
  const candidates = [block, blockUp].filter(
    (c): c is { text: string; confidence: number } => c != null
  );
  candidates.sort(
    (a, b) => scoreRaceResultOcrText(b.text) - scoreRaceResultOcrText(a.text)
  );
  const best = candidates[0]!;
  if (best.text.replace(/\s/g, "").length >= 40) return best;
  return extractTextFromImage(upscaled, "auto");
}

/**
 * OCR several offer screenshots with one Tesseract worker (still free / on-device).
 * Processes sequentially - typical use is 2–3 MBB / promo crops.
 */
export async function ocrOfferScreenshots(
  files: File[]
): Promise<Array<{ text: string; confidence: number; fileName: string }>> {
  if (files.length === 0) return [];
  if (files.length === 1) {
    const one = await ocrOfferScreenshot(files[0]);
    return [{ ...one, fileName: files[0].name }];
  }

  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, { logger: () => {} });
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
    });
    const out: Array<{ text: string; confidence: number; fileName: string }> = [];
    for (const file of files) {
      const { data } = await worker.recognize(file);
      out.push({
        text: data.text,
        confidence: data.confidence,
        fileName: file.name,
      });
    }
    return out;
  } finally {
    await worker.terminate();
  }
}

export async function ocrBetScreenshot(file: File, source: ScreenshotSource): Promise<OcrResult> {
  const { text, confidence } = await extractTextFromImage(file);
  const fields = parseBetScreenshot(text, source);
  return {
    text,
    fields,
    summary: summariseOcrFields(fields),
    confidence,
  };
}
