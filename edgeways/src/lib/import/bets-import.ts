/**
 * Spreadsheet → settled-bet drafts (E3 import). Pure mapping + validation;
 * the API route does the inserting. Imported rows are history only: they
 * carry source="import", never touch balances, and never create EV locks.
 */

export const IMPORT_FIELDS = [
  "date",
  "label",
  "bookmaker",
  "betType",
  "backStake",
  "backOdds",
  "profit",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  date: "Date",
  label: "Label",
  bookmaker: "Bookmaker",
  betType: "Bet type",
  backStake: "Back stake",
  backOdds: "Back odds",
  profit: "Profit",
};

/** Column index per field; -1 = not mapped. date + profit are required. */
export type ImportMapping = Record<ImportField, number>;

export interface ImportedBetDraft {
  label: string;
  bookmaker: string | null;
  betType: "qualifying" | "free_snr" | "free_sr" | "risk_free" | "back_only";
  backStake: number;
  backOdds: number;
  actualProfit: number;
  status: "won" | "lost" | "void";
  createdAt: number;
  settledAt: number;
}

export interface ImportRowError {
  rowIndex: number;
  message: string;
}

export interface ImportParseResult {
  drafts: ImportedBetDraft[];
  errors: ImportRowError[];
}

/** Guess a mapping from header names; unmatched fields stay -1. */
export function guessMapping(headers: string[]): ImportMapping {
  const mapping = Object.fromEntries(IMPORT_FIELDS.map((f) => [f, -1])) as ImportMapping;
  headers.forEach((raw, i) => {
    const h = raw.trim().toLowerCase();
    const assign = (field: ImportField) => {
      if (mapping[field] === -1) mapping[field] = i;
    };
    if (/^date|placed|settled/.test(h)) assign("date");
    else if (/label|name|description|event|selection|bet\b/.test(h)) assign("label");
    else if (/bookie|bookmaker|site|account/.test(h)) assign("bookmaker");
    else if (/type|category/.test(h)) assign("betType");
    else if (/stake|risk/.test(h)) assign("backStake");
    else if (/odds|price/.test(h)) assign("backOdds");
    else if (/profit|p&l|pnl|return|net/.test(h)) assign("profit");
  });
  return mapping;
}

/** dd/mm/yyyy (UK spreadsheets), yyyy-mm-dd, or anything Date.parse takes. */
export function parseImportDate(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const uk = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (uk) {
    const [, d, m, y] = uk;
    const year = Number(y!.length === 2 ? `20${y}` : y);
    const ms = new Date(year, Number(m) - 1, Number(d), 12, 0).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const iso = Date.parse(s);
  return Number.isFinite(iso) ? iso : null;
}

function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[£$€,\s]/g, "");
  if (cleaned === "") return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeBetType(raw: string): ImportedBetDraft["betType"] {
  const s = raw.trim().toLowerCase();
  if (/snr|stake not returned/.test(s)) return "free_snr";
  if (/\bsr\b|stake returned/.test(s)) return "free_sr";
  if (/free/.test(s)) return "free_snr";
  if (/risk/.test(s)) return "risk_free";
  if (/qual|matched/.test(s)) return "qualifying";
  return "back_only";
}

/**
 * Map data rows (header row already removed) into drafts. Bad rows land in
 * `errors` with a reason - reported, never silently dropped.
 */
export function mapImportRows(
  rows: string[][],
  mapping: ImportMapping
): ImportParseResult {
  const drafts: ImportedBetDraft[] = [];
  const errors: ImportRowError[] = [];

  const cell = (row: string[], field: ImportField): string =>
    mapping[field] >= 0 ? (row[mapping[field]] ?? "") : "";

  rows.forEach((row, rowIndex) => {
    const dateMs = parseImportDate(cell(row, "date"));
    if (dateMs == null) {
      errors.push({ rowIndex, message: `Unreadable date "${cell(row, "date")}"` });
      return;
    }
    const profit = parseMoney(cell(row, "profit"));
    if (profit == null) {
      errors.push({ rowIndex, message: `Unreadable profit "${cell(row, "profit")}"` });
      return;
    }
    const backStake = parseMoney(cell(row, "backStake")) ?? 0;
    const backOdds = parseMoney(cell(row, "backOdds")) ?? 0;
    const bookmaker = cell(row, "bookmaker").trim() || null;
    const label =
      cell(row, "label").trim() ||
      `Imported bet${bookmaker ? ` · ${bookmaker}` : ""}`;

    drafts.push({
      label,
      bookmaker,
      betType: normalizeBetType(cell(row, "betType")),
      backStake,
      backOdds,
      actualProfit: profit,
      status: profit > 0.005 ? "won" : profit < -0.005 ? "lost" : "void",
      createdAt: dateMs,
      settledAt: dateMs,
    });
  });

  return { drafts, errors };
}
