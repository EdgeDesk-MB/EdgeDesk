import { describe, expect, it } from "vitest";
import { toSqliteBetRow } from "@/lib/db/neon-desk-map";

describe("toSqliteBetRow", () => {
  it("drops the hosted owner and maps import fields through", () => {
    const row = toSqliteBetRow({
      id: 12,
      eventId: null,
      label: "Man Utd",
      market: "match_odds",
      selection: "home",
      betType: "qualifying",
      bookmaker: "Bet365",
      exchangeId: null,
      backStake: 10,
      backOdds: 2.1,
      layStake: 9.5,
      layOdds: 2.12,
      commission: 0.02,
      earlyPayout: 0,
      refundAmount: null,
      refundRetention: null,
      legs: null,
      triggerText: null,
      triggerRule: null,
      status: "open",
      expectedProfit: 0.4,
      actualProfit: null,
      notes: null,
      balanceLedgered: 0,
      balanceSettled: 0,
      createdAt: 1_700_000_000_000,
      settledAt: null,
      offerId: null,
      quickLogged: null,
      source: null,
      purpose: null,
      sport: "football",
      clerkUserId: "user_abc",
      importFingerprint: null,
      importMeta: null,
    });

    expect(row.id).toBe(12);
    expect(row.label).toBe("Man Utd");
    expect(row.sport).toBe("football");
    expect(row.importFingerprint).toBeNull();
    expect(row.importMeta).toBeNull();
    expect(row).not.toHaveProperty("clerkUserId");
  });

  it("carries import fingerprint and metadata for idempotent re-import", () => {
    const row = toSqliteBetRow({
      id: 13,
      eventId: null,
      label: "Benfica v AGF Aarhus",
      market: "win",
      selection: "Benfica",
      betType: "back_only",
      bookmaker: "partypoker",
      exchangeId: null,
      backStake: 0,
      backOdds: 0,
      layStake: 0,
      layOdds: 0,
      commission: 0,
      earlyPayout: 0,
      refundAmount: null,
      refundRetention: null,
      legs: null,
      triggerText: null,
      triggerRule: null,
      status: "void",
      expectedProfit: 0,
      actualProfit: 0,
      notes: "Note",
      balanceLedgered: 1,
      balanceSettled: 1,
      createdAt: 1_786_900_000_000,
      settledAt: 1_786_900_000_000,
      offerId: null,
      quickLogged: null,
      source: "import",
      purpose: null,
      sport: "football",
      clerkUserId: "user_abc",
      importFingerprint: "om-abc123",
      importMeta: '{"platform":"oddsmonkey","omBetType":"Normal"}',
    });

    expect(row.importFingerprint).toBe("om-abc123");
    expect(row.importMeta).toBe('{"platform":"oddsmonkey","omBetType":"Normal"}');
    expect(row.source).toBe("import");
  });
});
