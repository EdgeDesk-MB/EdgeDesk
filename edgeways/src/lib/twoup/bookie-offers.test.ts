import { describe, expect, it } from "vitest";
import {
  addEpScope,
  catalogAllowsOneUp,
  catalogAllowsTwoUp,
  catalogKindForBookie,
  defaultEpLeadBy,
  earlyPayoutPaidWhenCopy,
  epLeadUnit,
  footballBooksForLead,
  formatBookieScopeNote,
  formatEpRule,
  formatEpScopeChip,
  withExplicitFootballEpLabel,
  normalizeBookieScopes,
  parseTwoupBookieSelection,
  pickPreferredBookie,
  removeEpScope,
  resolveBookieScopesMigration,
  seedTwoupBookieSelection,
  setEpScopeLead,
  toggleBookieKind,
  upsertEpScope,
} from "./bookie-offers";

const footballTwoUp = {
  bookie: "Coral",
  surface: "early_payout" as const,
  sport: "football" as const,
  leadBy: 2,
};
const footballOneUp = {
  bookie: "Betano",
  surface: "early_payout" as const,
  sport: "football" as const,
  leadBy: 1,
};

describe("twoup bookie catalog", () => {
  it("treats high-street books as 2UP and Betano as 1UP", () => {
    expect(catalogKindForBookie("bet365")).toBe("2up");
    expect(catalogAllowsTwoUp("Coral")).toBe(true);
    expect(catalogAllowsOneUp("Betano")).toBe(true);
    expect(catalogAllowsTwoUp("Betano")).toBe(false);
    expect(catalogKindForBookie("Midnite")).toBe("both");
  });

  it("seeds wallets as football 2UP / 1UP scopes", () => {
    expect(seedTwoupBookieSelection(["Coral", "Betano", "Mystery Book"])).toEqual({
      scopes: [footballTwoUp, footballOneUp],
    });
  });

  it("toggles a wallet onto 2UP without dropping 1UP", () => {
    const next = toggleBookieKind(
      {
        scopes: [footballTwoUp, footballOneUp],
      },
      "Midnite",
      "2up",
      true
    );
    expect(footballBooksForLead(next, 2)).toEqual(["Coral", "Midnite"]);
    expect(footballBooksForLead(next, 1)).toEqual(["Betano"]);
  });

  it("prefers a marked 2UP book over a leftover default", () => {
    expect(pickPreferredBookie("PubCasino", ["Coral", "Ladbrokes"])).toBe("Coral");
    expect(pickPreferredBookie("Coral", ["Coral", "Ladbrokes"])).toBe("Coral");
    expect(pickPreferredBookie("Coral", ["Coral", "Ladbrokes"], "Coral")).toBe("Ladbrokes");
  });

  it("migrates the old twoUp / oneUp payload", () => {
    expect(parseTwoupBookieSelection({ twoUp: "Coral" })).toBeNull();
    expect(parseTwoupBookieSelection({ twoUp: ["Coral"], oneUp: ["Betano"] })).toEqual({
      scopes: [footballTwoUp, footballOneUp],
    });
  });

  it("parses scoped payloads and baseball lead-by-five", () => {
    const setup = parseTwoupBookieSelection({
      scopes: [
        { bookie: "bet365", sport: "football", leadBy: 2 },
        { bookie: "bet365", sport: "baseball", leadBy: 5 },
      ],
    });
    expect(setup?.scopes).toEqual([
      { bookie: "bet365", surface: "early_payout", sport: "football", leadBy: 2 },
      { bookie: "bet365", surface: "early_payout", sport: "baseball", leadBy: 5 },
    ]);
    expect(formatEpRule("baseball", 5)).toBe("5 runs ahead");
    expect(
      formatEpScopeChip({
        bookie: "bet365",
        surface: "early_payout",
        sport: "baseball",
        leadBy: 5,
      })
    ).toBe("Baseball · 5 runs ahead");
    expect(formatEpRule("football", 2)).toBe("2UP");
    expect(defaultEpLeadBy("baseball")).toBe(5);
  });

  it("adds and removes a non-football scope without touching football", () => {
    const seeded = seedTwoupBookieSelection(["Coral"]);
    const withBaseball = addEpScope(seeded, {
      bookie: "Coral",
      sport: "baseball",
      leadBy: 5,
    });
    expect(footballBooksForLead(withBaseball, 2)).toEqual(["Coral"]);
    expect(withBaseball.scopes).toHaveLength(2);
    expect(
      removeEpScope(withBaseball, { bookie: "Coral", sport: "baseball", leadBy: 5 }).scopes
    ).toEqual([footballTwoUp]);
  });

  it("replaces a non-football lead on the same bookie and sport", () => {
    const setup = upsertEpScope(
      { scopes: [{ bookie: "Coral", sport: "baseball", leadBy: 5 }] },
      { bookie: "Coral", sport: "baseball", leadBy: 4 }
    );
    expect(setup.scopes).toEqual([
      { bookie: "Coral", surface: "early_payout", sport: "baseball", leadBy: 4 },
    ]);
  });

  it("edits a scoped lead in place", () => {
    const setup = {
      scopes: [
        footballTwoUp,
        { bookie: "Coral", surface: "early_payout" as const, sport: "baseball" as const, leadBy: 5 },
      ],
    };
    expect(
      setEpScopeLead(setup, { bookie: "Coral", sport: "baseball", leadBy: 5 }, 6).scopes
    ).toEqual([
      footballTwoUp,
      { bookie: "Coral", surface: "early_payout", sport: "baseball", leadBy: 6 },
    ]);
  });

  it("defaults a missing surface to early payout and keeps racing rows", () => {
    expect(
      normalizeBookieScopes([
        { bookie: "Coral", sport: "football", leadBy: 2 },
        { bookie: "Coral", surface: "racing", sport: "football", leadBy: 1 },
      ])
    ).toEqual([
      footballTwoUp,
      { bookie: "Coral", surface: "racing", sport: "football", leadBy: 1 },
    ]);
    expect(
      footballBooksForLead(
        {
          scopes: [{ bookie: "Coral", surface: "racing", sport: "football", leadBy: 2 }],
        },
        2
      )
    ).toEqual([]);
  });

  it("migrates localStorage v1 once and does not re-seed after a clear", () => {
    const fromLegacy = resolveBookieScopesMigration({
      settingsScopes: [],
      localStorageRaw: JSON.stringify({ twoUp: ["Coral"], oneUp: ["Betano"] }),
      alreadyMigrated: false,
    });
    expect(fromLegacy).toEqual({
      scopes: [footballTwoUp, footballOneUp],
      shouldPersist: true,
      dropLocalStorage: true,
      markMigrated: true,
    });
    expect(
      resolveBookieScopesMigration({
        settingsScopes: [],
        localStorageRaw: null,
        alreadyMigrated: true,
        allowSeed: true,
        walletNames: ["Coral"],
      })
    ).toEqual({
      scopes: [],
      shouldPersist: false,
      dropLocalStorage: false,
      markMigrated: true,
    });
    expect(
      resolveBookieScopesMigration({
        settingsScopes: [],
        localStorageRaw: JSON.stringify({ scopes: [] }),
        alreadyMigrated: false,
        allowSeed: true,
        walletNames: ["Coral", "Betano"],
      }).scopes
    ).toEqual([footballTwoUp, footballOneUp]);
  });
});

describe("early payout add-bet copy", () => {
  it("defaults football to paid when 2 goals ahead", () => {
    expect(earlyPayoutPaidWhenCopy("football", 2)).toBe("Paid when 2 goals ahead");
    expect(earlyPayoutPaidWhenCopy("football", 1)).toBe("Paid when 1 goal ahead");
    expect(earlyPayoutPaidWhenCopy("baseball", 5)).toBe("Paid when 5 runs ahead");
    expect(epLeadUnit("darts")).toEqual({ singular: "set", plural: "sets" });
    expect(defaultEpLeadBy("darts")).toBe(1);
    expect(formatEpRule("darts", 2)).toBe("2 sets ahead");
  });

  it("tags a 1UP football label once", () => {
    expect(withExplicitFootballEpLabel("BallyBet away", 1)).toBe("BallyBet away · 1UP");
    expect(withExplicitFootballEpLabel("Away 1UP", 1)).toBe("Away 1UP");
    expect(withExplicitFootballEpLabel("Away", 2)).toBe("Away");
  });
});

describe("scope-generated account note", () => {
  it("lists each scoped sport once, in the order scopes were added", () => {
    const setup = {
      scopes: [
        { bookie: "BallyBet", surface: "early_payout" as const, sport: "football" as const, leadBy: 2 },
        {
          bookie: "BallyBet",
          surface: "early_payout" as const,
          sport: "american_football" as const,
          leadBy: 1,
        },
        { bookie: "BallyBet", surface: "early_payout" as const, sport: "darts" as const, leadBy: 1 },
      ],
    };
    expect(formatBookieScopeNote(setup, "BallyBet")).toBe(
      "Pays early for Football, American football, Darts."
    );
  });

  it("is empty once a bookie has no scopes, so a prior auto-note clears with them", () => {
    expect(formatBookieScopeNote({ scopes: [] }, "BallyBet")).toBe("");
  });
});
