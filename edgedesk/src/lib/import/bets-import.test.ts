import { describe, expect, it } from "vitest";
import {
  guessMapping,
  mapImportRows,
  parseImportDate,
  type ImportMapping,
} from "./bets-import";

const FULL_MAPPING: ImportMapping = {
  date: 0,
  label: 1,
  bookmaker: 2,
  betType: 3,
  backStake: 4,
  backOdds: 5,
  profit: 6,
};

describe("guessMapping", () => {
  it("matches common spreadsheet headers", () => {
    const m = guessMapping(["Date", "Bet", "Bookmaker", "Type", "Stake", "Odds", "Profit"]);
    expect(m).toEqual(FULL_MAPPING);
  });

  it("leaves unmatched fields at -1", () => {
    const m = guessMapping(["When", "Thing"]);
    expect(m.date).toBe(-1);
    expect(m.profit).toBe(-1);
  });
});

describe("parseImportDate", () => {
  it("reads UK dd/mm/yyyy as midday local", () => {
    const ms = parseImportDate("14/07/2026")!;
    const d = new Date(ms);
    expect([d.getDate(), d.getMonth() + 1, d.getFullYear()]).toEqual([14, 7, 2026]);
  });

  it("reads ISO and rejects garbage", () => {
    expect(parseImportDate("2026-07-14")).not.toBeNull();
    expect(parseImportDate("not a date")).toBeNull();
    expect(parseImportDate("")).toBeNull();
  });
});

describe("mapImportRows", () => {
  it("builds settled drafts with status from the profit sign", () => {
    const { drafts, errors } = mapImportRows(
      [
        ["14/07/2026", "Bet365 qual", "Bet365", "Qualifying", "£50.00", "4.5", "-2.30"],
        ["15/07/2026", "FB convert", "Bet365", "Free bet SNR", "50", "5.0", "£38.00"],
        ["16/07/2026", "Void one", "Coral", "", "10", "2.0", "0"],
      ],
      FULL_MAPPING
    );
    expect(errors).toEqual([]);
    expect(drafts).toHaveLength(3);
    expect(drafts[0]).toMatchObject({
      label: "Bet365 qual",
      bookmaker: "Bet365",
      betType: "qualifying",
      backStake: 50,
      backOdds: 4.5,
      actualProfit: -2.3,
      status: "lost",
    });
    expect(drafts[1]).toMatchObject({ betType: "free_snr", status: "won", actualProfit: 38 });
    expect(drafts[2]).toMatchObject({ status: "void", betType: "back_only" });
  });

  it("reports bad rows instead of silently dropping them", () => {
    const { drafts, errors } = mapImportRows(
      [
        ["not a date", "x", "", "", "", "", "5"],
        ["14/07/2026", "x", "", "", "", "", "??"],
        ["14/07/2026", "good", "", "", "", "", "1.50"],
      ],
      FULL_MAPPING
    );
    expect(drafts).toHaveLength(1);
    expect(errors).toEqual([
      { rowIndex: 0, message: 'Unreadable date "not a date"' },
      { rowIndex: 1, message: 'Unreadable profit "??"' },
    ]);
  });

  it("defaults a label and handles unmapped optional columns", () => {
    const mapping: ImportMapping = { ...FULL_MAPPING, label: -1, backStake: -1, backOdds: -1, betType: -1 };
    const { drafts } = mapImportRows([["14/07/2026", "", "Coral", "", "", "", "2.00"]], mapping);
    expect(drafts[0]).toMatchObject({
      label: "Imported bet · Coral",
      backStake: 0,
      backOdds: 0,
      betType: "back_only",
    });
  });
});
