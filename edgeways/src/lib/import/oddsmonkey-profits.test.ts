import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  detectProfitCsvFormat,
  parseOddsmonkeyDate,
  parseOddsmonkeyProfits,
} from "@/lib/import/oddsmonkey-profits";

const fixture = readFileSync(
  path.resolve(process.cwd(), "../docs/strategy/fixtures/oddsmonkey-profits-sample.csv"),
  "utf8"
);

describe("Oddsmonkey date parser", () => {
  it("reads padded DD-MM-YYYY HH:MM:SS as UTC", () => {
    expect(parseOddsmonkeyDate(" 16-08-2026 08:33:00 ")).toBe(
      Date.UTC(2026, 7, 16, 8, 33, 0)
    );
    expect(parseOddsmonkeyDate("16-08-2026")).toBeNull();
  });
});

describe("Oddsmonkey profits CSV", () => {
  it("detects the profits export headers", () => {
    expect(
      detectProfitCsvFormat([
        "eventTime",
        "date",
        "overallRunningTotal",
        "expectedProfit",
      ])
    ).toBe("oddsmonkey");
    expect(detectProfitCsvFormat(["Date", "Profit", "Bookmaker"])).toBe("generic");
  });

  it("parses the two-row fixture without rebuilding a matched ticket", () => {
    const result = parseOddsmonkeyProfits(fixture);
    expect(result.errors).toEqual([]);
    expect(result.drafts).toHaveLength(2);

    const manual = result.drafts[0]!;
    expect(manual.label).toBe("Event");
    expect(manual.selection).toBe("");
    expect(manual.bookmaker).toBe("10bet");
    expect(manual.betType).toBe("back_only");
    expect(manual.actualProfit).toBe(9.67);
    expect(manual.expectedProfit).toBe(10);
    expect(manual.sport).toBe("football");
    expect(manual.notes).toContain("Imported from Oddsmonkey · Manual");
    expect(manual.createdAt).toBe(Date.UTC(2026, 7, 16, 8, 33, 0));

    const football = result.drafts[1]!;
    expect(football.label).toBe("Benfica v AGF Aarhus · Benfica");
    expect(football.selection).toBe("Benfica");
    expect(football.bookmaker).toBe("partypoker");
    expect(football.actualProfit).toBe(0);
    expect(football.expectedProfit).toBe(0);
    expect(football.notes).toContain("Oddsmatcher");
    expect(football.notes).toContain("Note");
    expect(football.createdAt).toBe(Date.UTC(2026, 7, 16, 9, 10, 0));
    expect(JSON.parse(football.importMeta).kickoff).toBe(
      Date.UTC(2026, 7, 20, 19, 0, 0)
    );
    expect(football.fingerprint).not.toBe(manual.fingerprint);
  });
});
