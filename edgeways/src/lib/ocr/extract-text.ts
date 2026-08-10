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

/** Prefer OCR dumps that keep stake / free-bet / bookie wording intact. */
function scoreOfferOcrText(text: string): number {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 12) return 0;
  let score = Math.min(t.length, 1200) / 300;
  if (/£\s*\d|\bE\s*\d{1,3}\b|\b\d+\s*free\s*bets?\b/i.test(t)) score += 4;
  if (/\bbet\s+(?:£|E|€)?\s*\d+/i.test(t)) score += 3;
  if (/\bfree\s*bets?\b|\bfre\s*bet\b/i.test(t)) score += 3;
  if (/\b(?:opt[- ]?in|min(?:imum)?\s+odds|multiples?|horse\s*racing)\b/i.test(t)) {
    score += 2;
  }
  if (/\b(?:who can take part|terms?\s*(?:&|and)\s*conditions|remaining steps)\b/i.test(t)) {
    score -= 1;
  }
  // Penalise dense garbage with almost no money tokens.
  const moneyHits = (t.match(/£\s*\d|\bE\d{1,3}\b/g) ?? []).length;
  if (moneyHits === 0 && t.length > 200) score -= 2;
  return score;
}

/**
 * Free client-side OCR for offer / promo screenshots.
 * Upscales and tries auto + sparse layouts, keeping the dump that best
 * preserves stake / free-bet wording (dense T&Cs columns often shred PSM.AUTO).
 */
export async function ocrOfferScreenshot(
  file: File
): Promise<{ text: string; confidence: number }> {
  const upscaled = await upscaleImageForOcr(file, 2);
  const jobs: Array<Promise<{ text: string; confidence: number }>> = [
    extractTextFromImage(file, "auto"),
    extractTextFromImage(file, "sparse"),
  ];
  if (upscaled !== file) {
    jobs.push(extractTextFromImage(upscaled, "auto"));
    jobs.push(extractTextFromImage(upscaled, "sparse"));
  }
  const results = await Promise.all(jobs);
  results.sort((a, b) => scoreOfferOcrText(b.text) - scoreOfferOcrText(a.text));
  return results[0] ?? { text: "", confidence: 0 };
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
  // Each file uses the multi-layout picker (worker-per-pass inside extract).
  const out: Array<{ text: string; confidence: number; fileName: string }> = [];
  for (const file of files) {
    const one = await ocrOfferScreenshot(file);
    out.push({ ...one, fileName: file.name });
  }
  return out;
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
