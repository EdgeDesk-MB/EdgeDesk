/**
 * Client-side OCR via Tesseract.js (free, no API key).
 * First run downloads ~2MB of language data in the browser.
 */
import type { BetOcrFields, ScreenshotSource } from "./types";
import { parseBetScreenshot, summariseOcrFields } from "./parse-bet-screenshot";

export interface OcrResult {
  text: string;
  fields: BetOcrFields;
  summary: string[];
  confidence: number;
}

export type OcrLayout = "sparse" | "auto" | "block";

export async function extractTextFromImage(
  file: File | string | Buffer,
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

/** OCR for race-result tables (Sporting Life / ATR Full Result screenshots). */
export async function ocrRaceResultScreenshot(
  file: File
): Promise<{ text: string; confidence: number }> {
  // Try block layout first (better for tables), fall back to auto if thin.
  const block = await extractTextFromImage(file, "block");
  if (block.text.replace(/\s/g, "").length >= 40) return block;
  return extractTextFromImage(file, "auto");
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
