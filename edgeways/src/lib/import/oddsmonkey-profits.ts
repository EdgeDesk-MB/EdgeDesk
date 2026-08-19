/**
 * Oddsmonkey profits CSV → history drafts (EDGE-68).
 * Flattened ledger: one row is net P&L, not a reconstructed matched ticket.
 */

import { parseCsv } from "@/lib/import/csv";
import { roundMoney } from "@/lib/format-money";
import type { SportValue } from "@/lib/sports";

export const ODDSMONKEY_HEADERS = [
  "eventTime",
  "date",
  "bookmaker",
  "details",
  "profit",
  "overallRunningTotal",
  "monthlyRunningTotal",
  "outcome",
  "sport",
  "event",
  "betType",
  "source",
  "expectedProfit",
  "actualProfit",
] as const;

export type OddsmonkeyBetSource =
  | "none"
  | "manual"
  | "oddsmonkey_oddsmatcher"
  | "oddsmonkey_casino_offer";

export type OddsmonkeyImportDraft = {
  label: string;
  selection: string;
  bookmaker: string | null;
  betType: "qualifying" | "free_snr" | "free_sr" | "risk_free" | "back_only" | "dutch" | "boost";
  purpose: "mug" | null;
  market: string;
  sport: SportValue;
  expectedProfit: number | null;
  actualProfit: number;
  status: "won" | "lost" | "void";
  createdAt: number;
  settledAt: number;
  notes: string | null;
  fingerprint: string;
  importMeta: string;
};

export type OddsmonkeyRowError = {
  rowIndex: number;
  message: string;
};

export type OddsmonkeyParseResult = {
  drafts: OddsmonkeyImportDraft[];
  errors: OddsmonkeyRowError[];
  unmappedBetTypes: string[];
  unmappedSports: string[];
};

const HEADER_SET = new Set<string>(ODDSMONKEY_HEADERS);

export function detectProfitCsvFormat(
  headers: readonly string[]
): "oddsmonkey" | "generic" {
  const normalised = headers.map((h) => h.trim());
  const has = (name: string) => normalised.includes(name);
  if (has("eventTime") && has("overallRunningTotal") && has("expectedProfit")) {
    return "oddsmonkey";
  }
  return "generic";
}

/** DD-MM-YYYY HH:MM:SS, padded spaces allowed. CSV times are UTC. */
export function parseOddsmonkeyDate(raw: string): number | null {
  const s = raw.trim();
  const match = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(s);
  if (!match) return null;
  const [, dd, mm, yyyy, hh, min, ss] = match;
  const ms = Date.UTC(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(hh),
    Number(min),
    Number(ss)
  );
  return Number.isFinite(ms) ? ms : null;
}

export function oddsmonkeyFingerprint(parts: {
  date: string;
  eventTime: string;
  bookmaker: string;
  actualProfit: string;
  event: string;
  outcome: string;
  details: string;
  betType: string;
  expectedProfit: string;
}): string {
  const payload = [
    parts.date,
    parts.eventTime,
    parts.bookmaker,
    parts.actualProfit,
    parts.event,
    parts.outcome,
    parts.details,
    parts.betType,
    parts.expectedProfit,
  ]
    .map((value) => value.trim())
    .join("\u001f");
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash) ^ payload.charCodeAt(i);
  }
  return `om:${(hash >>> 0).toString(16).padStart(8, "0")}:${payload.length}`;
}

type MappedBet = {
  betType: OddsmonkeyImportDraft["betType"];
  purpose: "mug" | null;
  market: string;
  known: boolean;
};

function mapBetType(raw: string): MappedBet {
  const s = raw.trim();
  if (!s) return { betType: "back_only", purpose: null, market: "win", known: false };
  const key = s.toLowerCase();
  if (key === "normal") {
    return { betType: "back_only", purpose: null, market: "win", known: true };
  }
  if (key === "free snr") {
    return { betType: "free_snr", purpose: null, market: "win", known: true };
  }
  if (key === "free sr") {
    return { betType: "free_sr", purpose: null, market: "win", known: true };
  }
  if (key === "risk free") {
    return { betType: "risk_free", purpose: null, market: "win", known: true };
  }
  if (key === "dutch") {
    return { betType: "dutch", purpose: null, market: "win", known: true };
  }
  if (key === "price boost") {
    return { betType: "boost", purpose: null, market: "win", known: true };
  }
  if (key === "mug punt") {
    return { betType: "back_only", purpose: "mug", market: "win", known: true };
  }
  if (key === "each way") {
    return { betType: "back_only", purpose: null, market: "each_way", known: true };
  }
  if (key === "extra place") {
    return { betType: "back_only", purpose: null, market: "extra_place", known: true };
  }
  const knownNamed = new Set([
    "2up",
    "acca",
    "acca lay at start",
    "acca lay seq",
    "acca lay seq free bet",
    "acca lock-in",
    "acca no lay",
    "advantage play",
    "lucky finder",
    "misc",
    "casino",
    "bingo",
    "balance adjustment",
  ]);
  if (knownNamed.has(key)) {
    return { betType: "back_only", purpose: null, market: "win", known: true };
  }
  return { betType: "back_only", purpose: null, market: "win", known: false };
}

const SPORT_MAP: Record<string, SportValue> = {
  "american football": "american_football",
  baseball: "baseball",
  basketball: "basketball",
  boxing: "boxing",
  cricket: "cricket",
  darts: "darts",
  esports: "esports",
  football: "football",
  golf: "golf",
  greyhounds: "greyhounds",
  "horse racing": "horse_racing",
  "ice hockey": "ice_hockey",
  "motor sport": "motorsport",
  "rugby league": "rugby_league",
  "rugby union": "rugby_union",
  snooker: "snooker",
  tennis: "tennis",
};

const OTHER_SPORTS = new Set([
  "miscellaneous",
  "olympics",
  "politics",
  "virtual sports",
  "bingo",
  "blackjack",
  "casino",
  "roulette",
  "slots",
]);

function mapSport(raw: string): { sport: SportValue; known: boolean } {
  const key = raw.trim().toLowerCase();
  if (!key) return { sport: "other", known: false };
  const mapped = SPORT_MAP[key];
  if (mapped) return { sport: mapped, known: true };
  if (OTHER_SPORTS.has(key)) return { sport: "other", known: true };
  return { sport: "other", known: false };
}

function mapSource(raw: string): { source: OddsmonkeyBetSource; label: string } {
  const key = raw.trim().toLowerCase();
  if (!key || key === "none") return { source: "none", label: "None" };
  if (key === "manual" || key === "manual entry") {
    return { source: "manual", label: "Manual" };
  }
  if (key === "odds" || key === "oddsmatcher") {
    return { source: "oddsmonkey_oddsmatcher", label: "Oddsmatcher" };
  }
  if (key === "casino offer") {
    return { source: "oddsmonkey_casino_offer", label: "Casino offer" };
  }
  return { source: "none", label: raw.trim() || "None" };
}

function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[£$€,\s]/g, "");
  if (cleaned === "") return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function importLabel(event: string, outcome: string): string {
  const eventLabel = event.trim() || "Imported bet";
  const selection = outcome.trim();
  if (!selection || /^bet$/i.test(selection)) return eventLabel;
  return `${eventLabel} · ${selection}`;
}

function headerIndex(headers: string[]): Record<string, number> {
  const index: Record<string, number> = {};
  headers.forEach((raw, i) => {
    const name = raw.trim();
    if (HEADER_SET.has(name) && index[name] == null) index[name] = i;
  });
  return index;
}

function cell(row: string[], index: Record<string, number>, name: string): string {
  const i = index[name];
  if (i == null) return "";
  return row[i] ?? "";
}

export function parseOddsmonkeyProfits(text: string): OddsmonkeyParseResult {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return { drafts: [], errors: [], unmappedBetTypes: [], unmappedSports: [] };
  }
  const headers = rows[0] ?? [];
  if (detectProfitCsvFormat(headers) !== "oddsmonkey") {
    return {
      drafts: [],
      errors: [{ rowIndex: 0, message: "Not an Oddsmonkey profits export." }],
      unmappedBetTypes: [],
      unmappedSports: [],
    };
  }
  const index = headerIndex(headers);
  const drafts: OddsmonkeyImportDraft[] = [];
  const errors: OddsmonkeyRowError[] = [];
  const unmappedBetTypes = new Set<string>();
  const unmappedSports = new Set<string>();

  rows.slice(1).forEach((row, offset) => {
    const rowIndex = offset + 1;
    const dateRaw = cell(row, index, "date");
    const loggedAt = parseOddsmonkeyDate(dateRaw);
    if (loggedAt == null) {
      errors.push({ rowIndex, message: `Unreadable date "${dateRaw.trim()}"` });
      return;
    }
    const actualRaw = cell(row, index, "actualProfit") || cell(row, index, "profit");
    const actualProfit = parseMoney(actualRaw);
    if (actualProfit == null) {
      errors.push({ rowIndex, message: `Unreadable profit "${actualRaw.trim()}"` });
      return;
    }
    const expectedRaw = cell(row, index, "expectedProfit");
    const expectedProfit = parseMoney(expectedRaw);
    const event = cell(row, index, "event").trim();
    const outcome = cell(row, index, "outcome").trim();
    const details = cell(row, index, "details").trim();
    const betTypeRaw = cell(row, index, "betType");
    const sportRaw = cell(row, index, "sport");
    const mappedType = mapBetType(betTypeRaw);
    const mappedSport = mapSport(sportRaw);
    if (!mappedType.known && betTypeRaw.trim()) unmappedBetTypes.add(betTypeRaw.trim());
    if (!mappedSport.known && sportRaw.trim()) unmappedSports.add(sportRaw.trim());
    const source = mapSource(cell(row, index, "source"));
    const eventTimeRaw = cell(row, index, "eventTime");
    const kickoff = parseOddsmonkeyDate(eventTimeRaw);
    const fingerprint = oddsmonkeyFingerprint({
      date: dateRaw,
      eventTime: eventTimeRaw,
      bookmaker: cell(row, index, "bookmaker"),
      actualProfit: actualRaw,
      event,
      outcome,
      details,
      betType: betTypeRaw,
      expectedProfit: expectedRaw,
    });
    const notes = [`Imported from Oddsmonkey · ${source.label}`, details || null]
      .filter(Boolean)
      .join("\n");
    const importMeta = JSON.stringify({
      platform: "oddsmonkey",
      omBetType: betTypeRaw.trim() || null,
      omBetSource: source.source,
      omSourceRaw: cell(row, index, "source").trim() || null,
      omSportRaw: sportRaw.trim() || null,
      kickoff,
      selection: outcome || null,
    });
    let status: OddsmonkeyImportDraft["status"] = "won";
    if (actualProfit < -0.004) status = "lost";
    else if (actualProfit > 0.004) status = "won";
    else status = "won";

    drafts.push({
      label: importLabel(event, outcome).slice(0, 200),
      selection: /^bet$/i.test(outcome) ? "" : outcome.slice(0, 200),
      bookmaker: cell(row, index, "bookmaker").trim() || null,
      betType: mappedType.betType,
      purpose: mappedType.purpose,
      market: mappedType.market,
      sport: mappedSport.sport,
      expectedProfit:
        expectedProfit == null ? null : roundMoney(expectedProfit),
      actualProfit: roundMoney(actualProfit),
      status,
      createdAt: loggedAt,
      settledAt: loggedAt,
      notes,
      fingerprint,
      importMeta,
    });
  });

  return {
    drafts,
    errors,
    unmappedBetTypes: [...unmappedBetTypes].sort(),
    unmappedSports: [...unmappedSports].sort(),
  };
}

export function oddsmonkeyPreview(result: OddsmonkeyParseResult): {
  rows: number;
  skipped: number;
  profitSum: number;
  from: number | null;
  to: number | null;
} {
  const times = result.drafts.map((row) => row.createdAt);
  return {
    rows: result.drafts.length,
    skipped: result.errors.length,
    profitSum: roundMoney(
      result.drafts.reduce((sum, row) => sum + row.actualProfit, 0)
    ),
    from: times.length ? Math.min(...times) : null,
    to: times.length ? Math.max(...times) : null,
  };
}
