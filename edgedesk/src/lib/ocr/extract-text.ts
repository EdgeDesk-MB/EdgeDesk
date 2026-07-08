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

export async function extractTextFromImage(file: File | string): Promise<{ text: string; confidence: number }> {
  const { createWorker, PSM } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger: () => {},
  });
  try {
    // Sparse text / column layout — reads Odds/Stake/Returns stacks more reliably than default.
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    });
    const { data } = await worker.recognize(file);
    return { text: data.text, confidence: data.confidence };
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
