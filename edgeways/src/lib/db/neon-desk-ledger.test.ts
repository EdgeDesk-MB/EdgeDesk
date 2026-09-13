import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountRow, BetRow, EventRow } from "@/lib/db/schema";

const mocks = vi.hoisted(() => ({
  clerkUserId: "user_live" as string | null,
  accounts: [] as AccountRow[],
  txs: [] as Array<Record<string, unknown>>,
  patches: [] as Array<{ id: number; patch: Record<string, unknown> }>,
  ensureCalls: [] as Array<{ name: string; kind: string; clerk?: string | null }>,
  claimed: new Set<number>(),
  settlementClaimed: new Set<number>(),
  insertError: null as Error | null,
}));

function account(
  partial: Partial<AccountRow> & Pick<AccountRow, "id" | "name" | "type">
): AccountRow {
  return {
    exchangeId: null,
    fundedByAccountId: null,
    brandColor: null,
    owner: "me",
    isActive: 1,
    accessStatus: "available",
    notes: null,
    wrRemaining: 0,
    wrMinOdds: null,
    wrType: "stake",
    health: null,
    healthUpdatedAt: null,
    createdAt: 1,
    ...partial,
  };
}

function bet(partial: Partial<BetRow>): BetRow {
  return {
    id: 10,
    eventId: null,
    label: "Arsenal",
    market: "match_odds",
    selection: "home",
    betType: "qualifying",
    bookmaker: "Bet365",
    exchangeId: 1,
    backStake: 10,
    backOdds: 2,
    layStake: 9.8,
    layOdds: 2.02,
    commission: 0.02,
    earlyPayout: 0,
    refundAmount: null,
    refundRetention: null,
    legs: null,
    triggerText: null,
    triggerRule: null,
    status: "open",
    expectedProfit: 0.1,
    actualProfit: null,
    notes: null,
    balanceLedgered: 0,
    balanceSettled: 0,
    createdAt: 1,
    settledAt: null,
    offerId: null,
    quickLogged: null,
    source: null,
    purpose: null,
    sport: "football",
    importFingerprint: null,
    importMeta: null,
    ...partial,
  };
}

vi.mock("@/lib/db/neon-desk", () => ({
  neonDeskClerkUserId: () => mocks.clerkUserId,
  claimNeonBetPlacementLedger: async (id: number) => {
    if (mocks.claimed.has(id)) return false;
    mocks.claimed.add(id);
    mocks.patches.push({ id, patch: { balanceLedgered: 1 } });
    return true;
  },
  claimNeonBetSettlementLedger: async (id: number) => {
    if (mocks.settlementClaimed.has(id)) return false;
    mocks.settlementClaimed.add(id);
    mocks.patches.push({ id, patch: { balanceSettled: 1 } });
    return true;
  },
  patchNeonDeskBet: async (id: number, patch: Record<string, unknown>) => {
    mocks.patches.push({ id, patch });
    if (patch.balanceLedgered === 0) mocks.claimed.delete(id);
    if (patch.balanceSettled === 0) mocks.settlementClaimed.delete(id);
    return bet({ id, ...patch });
  },
}));

vi.mock("@/lib/db/neon-desk-ensure-venue", () => ({
  ensureNeonVenueAccount: async (
    name: string,
    kind: "bookie" | "exchange",
    clerkUserId?: string | null
  ) => {
    mocks.ensureCalls.push({ name, kind, clerk: clerkUserId });
    const existing = mocks.accounts.find(
      (a) => a.type === kind && a.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return { account: existing, exchange: null, created: false };
    const row = account({
      id: 100 + mocks.accounts.length,
      name,
      type: kind,
      exchangeId: kind === "exchange" ? 1 : null,
    });
    mocks.accounts.push(row);
    return { account: row, exchange: null, created: true };
  },
}));

vi.mock("@/lib/db/neon-desk-accounts", () => ({
  listNeonDeskAccounts: async () => mocks.accounts,
  listNeonDeskBalanceTransactions: async () => mocks.txs,
  listNeonExchanges: async () => [
    {
      id: 1,
      name: "Betfair",
      commissionPct: 2,
      brandColor: "#3f3f46",
      backColor: "#a6d8ff",
      layColor: "#fac9d1",
      isDefault: 1,
      createdAt: 1,
    },
  ],
  insertNeonDeskTransaction: async (values: Record<string, unknown>) => {
    if (mocks.insertError) throw mocks.insertError;
    mocks.txs.push(values);
    return { id: mocks.txs.length, ...values };
  },
  patchNeonDeskAccount: async (id: number, patch: Record<string, unknown>) => {
    const row = mocks.accounts.find((a) => a.id === id);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  },
  deleteNeonDeskFreeBetUsageForBet: async (betId: number) => {
    const idx = mocks.txs.findIndex(
      (t) => t.betId === betId && t.category === "free_bet" && Number(t.amount ?? 0) < 0
    );
    if (idx < 0) return false;
    mocks.txs.splice(idx, 1);
    return true;
  },
  purgeNeonDeskTransactionsForBet: async () => {},
  purgeNeonDeskSettlementTransactionsForBet: async (betId: number) => {
    mocks.txs = mocks.txs.filter((t) => {
      if (t.betId !== betId) return true;
      return t.category !== "bet_settlement";
    });
  },
  purgeNeonDeskPlacementTransactionsForBet: async (betId: number) => {
    mocks.txs = mocks.txs.filter((t) => {
      if (t.betId !== betId) return true;
      const category = t.category;
      const amount = Number(t.amount ?? 0);
      const placement =
        category === "bet_stake" || (category === "free_bet" && amount < 0);
      return !placement;
    });
  },
}));

vi.mock("@/lib/db/neon-desk-history", () => ({
  insertNeonDeskHistory: async () => {},
}));

import {
  awardNeonPlaceFreeBetIfDue,
  awardNeonPlaceFreeBetsDue,
  awardNeonUnconditionalFreeBetIfDue,
  awardNeonUnconditionalFreeBetsDue,
  healNeonDeskLedgers,
  healNeonOpenBetPlacements,
  ledgerNeonBetPlacement,
  ledgerNeonBetSettlement,
  reledgerNeonOpenBetPlacement,
} from "./neon-desk-ledger";

function raceEvent(partial: Partial<EventRow> = {}): EventRow {
  return {
    id: 54,
    sport: "horse_racing",
    externalId: "rac_haydock",
    competition: "Haydock",
    homeTeam: "Betfair Be Friendly Handicap Stakes",
    awayTeam: "4:15",
    startTime: 1,
    status: "finished",
    homeScore: 1,
    awayScore: 0,
    minute: 0,
    homeLed2: 0,
    awayLed2: 0,
    source: "api",
    goals: JSON.stringify({
      kind: "horse_racing",
      winner: "Poatan (IRE)",
      runners: [
        { horse: "Poatan (IRE)", position: 1 },
        { horse: "Trilby (GB)", position: 2 },
        { horse: "Elara May (GB)", position: 3 },
        { horse: "Jer Batt (IRE)", position: 4 },
        { horse: "Marching Mac (IRE)", position: 5 },
      ],
    }),
    ftHomeScore: null,
    ftAwayScore: null,
    matchEnding: null,
    period: null,
    htHomeScore: null,
    htAwayScore: null,
    lineups: null,
    tapeFetchedAt: null,
    simScript: null,
    simStartedAt: null,
    resultPostedAt: null,
    createdAt: 1,
    ...partial,
  };
}

describe("ledgerNeonBetPlacement", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.accounts = [];
    mocks.txs = [];
    mocks.patches = [];
    mocks.claimed.clear();
    mocks.settlementClaimed.clear();
    mocks.insertError = null;
    mocks.ensureCalls = [];
  });

  it("debits back stake and lay liability on a qualifying bet", async () => {
    mocks.accounts.push(
      account({ id: 30, name: "Bet365", type: "bookie" }),
      account({ id: 31, name: "Betfair", type: "exchange", exchangeId: 1 })
    );
    await expect(ledgerNeonBetPlacement(bet({}))).resolves.toBe(true);
    expect(mocks.txs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: 30,
          amount: -10,
          category: "bet_stake",
          betId: 10,
        }),
        expect.objectContaining({
          accountId: 31,
          amount: -9.8 * (2.02 - 1),
          category: "bet_stake",
          betId: 10,
        }),
      ])
    );
    expect(mocks.patches).toContainEqual({
      id: 10,
      patch: { balanceLedgered: 1 },
    });
  });

  it("debits the Betdaq exchange wallet for an exchange-as-back no-lay", async () => {
    mocks.accounts.push(
      account({ id: 40, name: "Betdaq", type: "exchange", exchangeId: 2 })
    );
    await expect(
      ledgerNeonBetPlacement(
        bet({ bookmaker: "Betdaq", exchangeId: null, backStake: 300, backOdds: 2.8 })
      )
    ).resolves.toBe(true);
    expect(mocks.ensureCalls).not.toContainEqual(
      expect.objectContaining({ name: "Betdaq", kind: "bookie" })
    );
    expect(mocks.txs).toEqual([
      expect.objectContaining({
        accountId: 40,
        amount: -300,
        category: "bet_stake",
        note: "Back stake - Arsenal",
      }),
    ]);
  });

  it("debits a free-bet usage row instead of cash on a free bet", async () => {
    mocks.accounts.push(account({ id: 30, name: "Bet365", type: "bookie" }));
    await ledgerNeonBetPlacement(bet({ betType: "free_snr", exchangeId: null }));
    expect(mocks.txs).toEqual([
      expect.objectContaining({
        accountId: 30,
        amount: -10,
        category: "free_bet",
        betId: 10,
        note: "Free bet used - Arsenal",
      }),
    ]);
    expect(mocks.patches).toContainEqual({
      id: 10,
      patch: { balanceLedgered: 1 },
    });
  });

  it("debits free-bet legs on a dutch ticket", async () => {
    mocks.accounts.push(account({ id: 30, name: "Bet365", type: "bookie" }));
    await ledgerNeonBetPlacement(
      bet({
        betType: "dutch",
        exchangeId: null,
        backStake: 0,
        legs: JSON.stringify([
          { label: "Home", market: "match_odds", selection: "home", odds: 2, stake: 8, freeBet: "snr", bookmaker: "Bet365" },
          { label: "Away", market: "match_odds", selection: "away", odds: 3.5, stake: 5, bookmaker: "Bet365" },
        ]),
      })
    );
    expect(mocks.txs).toEqual([
      expect.objectContaining({
        accountId: 30,
        amount: -8,
        category: "free_bet",
        note: "Free bet used - Arsenal (Home)",
      }),
    ]);
  });

  it("burns outstanding WR on a cash back stake", async () => {
    mocks.accounts.push(
      account({ id: 30, name: "Bet365", type: "bookie", wrRemaining: 40, wrType: "stake" })
    );
    await ledgerNeonBetPlacement(bet({ exchangeId: null, backStake: 10 }));
    expect(mocks.accounts[0]?.wrRemaining).toBe(30);
  });

  it("is idempotent when another worker already claimed the placement", async () => {
    mocks.accounts.push(account({ id: 30, name: "Bet365", type: "bookie" }));
    mocks.claimed.add(10);
    mocks.txs.push({
      accountId: 30,
      amount: -10,
      category: "bet_stake",
      betId: 10,
    });
    await expect(ledgerNeonBetPlacement(bet({ exchangeId: null }))).resolves.toBe(true);
    expect(mocks.txs).toHaveLength(1);
  });

  it("creates wallets for a customer clerk even when ALS is a different user", async () => {
    mocks.clerkUserId = "user_als";
    await expect(ledgerNeonBetPlacement(bet({}), "user_customer")).resolves.toBe(true);
    expect(mocks.ensureCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Bet365", kind: "bookie", clerk: "user_customer" }),
        expect.objectContaining({ name: "Betfair", kind: "exchange", clerk: "user_customer" }),
      ])
    );
    expect(mocks.txs).toHaveLength(2);
  });
});

describe("ledgerNeonBetSettlement", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.accounts = [
      account({ id: 30, name: "Bet365", type: "bookie" }),
      account({ id: 31, name: "Betfair", type: "exchange", exchangeId: 1 }),
    ];
    mocks.txs = [];
    mocks.patches = [];
    mocks.claimed.clear();
    mocks.settlementClaimed.clear();
    mocks.insertError = null;
    mocks.ensureCalls = [];
  });

  it("credits the bookie payout when the back wins", async () => {
    await expect(
      ledgerNeonBetSettlement(
        bet({ status: "won", balanceLedgered: 1, actualProfit: 0.4 })
      )
    ).resolves.toBe(true);
    expect(mocks.txs).toContainEqual(
      expect.objectContaining({
        accountId: 30,
        amount: 20,
        category: "bet_settlement",
      })
    );
    expect(mocks.patches).toContainEqual({
      id: 10,
      patch: { balanceSettled: 1 },
    });
  });

  it("heals placement then pays out when the bet was never ledgered", async () => {
    // Worked: £10 back @ 2.00, £9.80 lay @ 2.02. Placement must debit before
    // the £20 bookie credit, otherwise settle would invent cash.
    await expect(
      ledgerNeonBetSettlement(bet({ status: "won", balanceLedgered: 0, actualProfit: 0.4 }))
    ).resolves.toBe(true);
    expect(mocks.txs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: 30,
          amount: -10,
          category: "bet_stake",
        }),
        expect.objectContaining({
          accountId: 31,
          amount: -9.8 * (2.02 - 1),
          category: "bet_stake",
        }),
        expect.objectContaining({
          accountId: 30,
          amount: 20,
          category: "bet_settlement",
        }),
      ])
    );
    expect(mocks.patches).toContainEqual({
      id: 10,
      patch: { balanceSettled: 1 },
    });
  });

  it("does not invent money when there is no bookie or exchange to attach to", async () => {
    await expect(
      ledgerNeonBetSettlement(
        bet({
          status: "won",
          balanceLedgered: 0,
          bookmaker: "",
          exchangeId: null,
        })
      )
    ).resolves.toBe(false);
    expect(mocks.txs).toEqual([]);
  });

  it("debits the qualifying stake then credits a refund-if free bet after a loss", async () => {
    // Worked: £100 back lost, £100 money-back FB. Placement was skipped at
    // save time; settle must still debit the bookie then award the promo.
    await expect(
      ledgerNeonBetSettlement(
        bet({
          status: "lost",
          betType: "risk_free",
          exchangeId: null,
          backStake: 100,
          backOdds: 4.5,
          layStake: 65,
          layOdds: 4.7,
          commission: 0,
          actualProfit: -35,
          balanceLedgered: 0,
          triggerText: "Bet £100 get £100 free bet if bet loses",
          label: "Goodwood 1:25",
        })
      )
    ).resolves.toBe(true);
    expect(mocks.txs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: 30,
          amount: -100,
          category: "bet_stake",
          betId: 10,
        }),
        expect.objectContaining({
          accountId: 30,
          amount: 100,
          category: "free_bet",
          betId: 10,
          note: "Free bet promo - Bet lost — money-back free bet (Goodwood 1:25)",
        }),
      ])
    );
  });

  it("still pays out when a concurrent heal already claimed placement", async () => {
    mocks.claimed.add(10);
    mocks.txs.push({
      accountId: 30,
      amount: -10,
      category: "bet_stake",
      betId: 10,
    });
    await expect(
      ledgerNeonBetSettlement(
        bet({ status: "won", balanceLedgered: 0, exchangeId: null, actualProfit: 0.4 })
      )
    ).resolves.toBe(true);
    expect(mocks.txs).toContainEqual(
      expect.objectContaining({
        accountId: 30,
        amount: 20,
        category: "bet_settlement",
      })
    );
  });

  it("credits the bookie payout only once when two workers settle the same win", async () => {
    // Worked: Millwall home £200 at 1.96. Payout = 200 × 1.96 = £392.
    // Feed sync and dashboard heal both saw balanceSettled=0 and both
    // credited £392, 0.5s apart. One worker must win the claim.
    const millwall = bet({
      status: "won",
      balanceLedgered: 1,
      exchangeId: null,
      backStake: 200,
      backOdds: 1.96,
      label: "Match odds home",
      actualProfit: -4,
    });
    const [first, second] = await Promise.all([
      ledgerNeonBetSettlement(millwall),
      ledgerNeonBetSettlement(millwall),
    ]);
    expect(first).toBe(true);
    expect(second).toBe(true);
    const payouts = mocks.txs.filter((t) => t.category === "bet_settlement");
    expect(payouts).toHaveLength(1);
    expect(payouts[0]).toEqual(
      expect.objectContaining({
        accountId: 30,
        amount: 392,
        category: "bet_settlement",
        note: "Bookie payout (back won) - Match odds home",
      })
    );
  });

  it("does not write a second payout when settlement was already claimed", async () => {
    mocks.settlementClaimed.add(10);
    await expect(
      ledgerNeonBetSettlement(
        bet({ status: "won", balanceLedgered: 1, exchangeId: null, actualProfit: 0.4 })
      )
    ).resolves.toBe(true);
    expect(mocks.txs).toEqual([]);
  });

  it("unclaims settlement when the payout write fails so a later heal can credit once", async () => {
    mocks.insertError = new Error("neon write failed");
    await expect(
      ledgerNeonBetSettlement(
        bet({ status: "won", balanceLedgered: 1, exchangeId: null, actualProfit: 0.4 })
      )
    ).rejects.toThrow("neon write failed");
    expect(mocks.txs.filter((t) => t.category === "bet_settlement")).toEqual([]);
    expect(mocks.settlementClaimed.has(10)).toBe(false);
    expect(mocks.patches).toContainEqual({
      id: 10,
      patch: { balanceSettled: 0 },
    });
  });

  it("restores a free-bet usage debit on void instead of inventing a credit", async () => {
    mocks.txs.push({
      accountId: 30,
      amount: -10,
      category: "free_bet",
      betId: 10,
    });
    await expect(
      ledgerNeonBetSettlement(
        bet({
          status: "void",
          betType: "free_snr",
          exchangeId: null,
          balanceLedgered: 1,
        })
      )
    ).resolves.toBe(true);
    expect(mocks.txs).toEqual([]);
    expect(mocks.patches).toContainEqual({
      id: 10,
      patch: { balanceSettled: 1 },
    });
  });

  it("does not credit a refund-if free bet when the back wins", async () => {
    await awardNeonUnconditionalFreeBetIfDue(
      bet({
        status: "won",
        betType: "risk_free",
        triggerText: "Bet £100 get £100 free bet if bet loses",
      })
    );
    expect(mocks.txs).toEqual([]);
  });

  it("credits a risk-free refund from refundAmount when trigger text is missing", async () => {
    // Refund-If from Add bet stores betType + refundAmount, not parsed trigger text.
    await expect(
      awardNeonUnconditionalFreeBetIfDue(
        bet({
          status: "lost",
          betType: "risk_free",
          triggerText: null,
          triggerRule: null,
          refundAmount: 61.84,
          backStake: 61.84,
          bookmaker: "Bet365",
          balanceLedgered: 1,
        })
      )
    ).resolves.toBe(true);
    expect(mocks.txs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: 30,
          amount: 61.84,
          category: "free_bet",
          betId: 10,
        }),
      ])
    );
  });
});

describe("awardNeonUnconditionalFreeBetsDue", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.accounts = [account({ id: 30, name: "Bet365", type: "bookie" })];
    mocks.txs = [];
    mocks.patches = [];
    mocks.claimed.clear();
    mocks.settlementClaimed.clear();
    mocks.insertError = null;
    mocks.ensureCalls = [];
  });

  it("debits the qualifying stake before a snapshot promo on a never-ledgered loss", async () => {
    // Worked: result already set, cash never moved. Dashboard award must not
    // credit +£100 FB while leaving the bookie at £0.
    await expect(
      awardNeonUnconditionalFreeBetsDue(
        [
          bet({
            status: "lost",
            betType: "risk_free",
            exchangeId: null,
            backStake: 100,
            backOdds: 4.5,
            layStake: 65,
            layOdds: 4.7,
            commission: 0,
            actualProfit: -35,
            balanceLedgered: 0,
            balanceSettled: 1,
            triggerText: "Bet £100 get £100 free bet if bet loses",
            label: "Goodwood 1:25",
          }),
        ],
        []
      )
    ).resolves.toBe(1);
    expect(mocks.txs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: 30,
          amount: -100,
          category: "bet_stake",
          betId: 10,
        }),
        expect.objectContaining({
          accountId: 30,
          amount: 100,
          category: "free_bet",
          betId: 10,
        }),
      ])
    );
  });
});

describe("awardNeonPlaceFreeBetIfDue", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.accounts = [account({ id: 30, name: "Betfair Sportsbook", type: "bookie" })];
    mocks.txs = [];
    mocks.patches = [];
    mocks.claimed.clear();
    mocks.settlementClaimed.clear();
    mocks.insertError = null;
    mocks.ensureCalls = [];
  });

  const placeBet = (partial: Partial<BetRow> = {}): BetRow =>
    bet({
      bookmaker: "Betfair Sportsbook",
      selection: "Trilby",
      status: "lost",
      exchangeId: null,
      backStake: 20,
      actualProfit: -0.56,
      balanceLedgered: 1,
      balanceSettled: 1,
      eventId: 54,
      label: "Haydock · Bet £20 get £20 free bet (2nd, 3rd, 4th)",
      triggerRule: JSON.stringify({
        v: 2,
        betWin: null,
        effects: [{ kind: "free_bet_award", amount: 20, positions: [2, 3, 4] }],
      }),
      triggerText: "Bet £20 get £20 FB if 2, 3, 4",
      ...partial,
    });

  it("credits £20 when the selection finishes 2nd on a 2nd–4th place-refund", async () => {
    // Worked: £20 qualifier, Trilby 2nd (needed 2nd–4th). Win market loses;
    // promo must still mint a £20 free-bet lot on Betfair Sportsbook.
    await expect(awardNeonPlaceFreeBetIfDue(placeBet(), raceEvent())).resolves.toBe(
      true
    );
    expect(mocks.txs).toEqual([
      expect.objectContaining({
        accountId: 30,
        amount: 20,
        category: "free_bet",
        betId: 10,
        note: "Free bet promo - Finished 2nd (Haydock · Bet £20 get £20 free bet (2nd, 3rd, 4th))",
      }),
    ]);
  });

  it("does not credit a winner-only result before placings land", async () => {
    await expect(
      awardNeonPlaceFreeBetIfDue(
        placeBet(),
        raceEvent({
          goals: JSON.stringify({
            kind: "horse_racing",
            winner: "Poatan (IRE)",
            runners: [{ horse: "Poatan (IRE)", position: 1 }],
          }),
        })
      )
    ).resolves.toBe(false);
    expect(mocks.txs).toEqual([]);
  });

  it("does not credit a 5th-place finish", async () => {
    await expect(
      awardNeonPlaceFreeBetIfDue(placeBet({ selection: "Marching Mac" }), raceEvent())
    ).resolves.toBe(false);
    expect(mocks.txs).toEqual([]);
  });
});

describe("awardNeonPlaceFreeBetsDue", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.accounts = [account({ id: 30, name: "Betfair Sportsbook", type: "bookie" })];
    mocks.txs = [];
    mocks.patches = [];
    mocks.claimed.clear();
    mocks.settlementClaimed.clear();
    mocks.insertError = null;
    mocks.ensureCalls = [];
  });

  it("skips a bet that already has a promo credit", async () => {
    await expect(
      awardNeonPlaceFreeBetsDue(
        [
          bet({
            bookmaker: "Betfair Sportsbook",
            selection: "Trilby",
            status: "lost",
            exchangeId: null,
            eventId: 54,
            balanceLedgered: 1,
            triggerRule: JSON.stringify({
              v: 2,
              betWin: null,
              effects: [{ kind: "free_bet_award", amount: 20, positions: [2, 3, 4] }],
            }),
          }),
        ],
        [raceEvent()],
        [{ betId: 10, category: "free_bet", amount: 20 }]
      )
    ).resolves.toBe(0);
    expect(mocks.txs).toEqual([]);
  });
});

describe("healNeonOpenBetPlacements", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.accounts = [account({ id: 30, name: "Bet365", type: "bookie" })];
    mocks.txs = [];
    mocks.patches = [];
    mocks.claimed.clear();
    mocks.settlementClaimed.clear();
    mocks.insertError = null;
    mocks.ensureCalls = [];
  });

  it("ledgers open bets that never moved cash, and skips already-ledgered rows", async () => {
    const open = bet({ exchangeId: null });
    const done = bet({ id: 11, balanceLedgered: 1, exchangeId: null });
    const settled = bet({
      id: 12,
      status: "won",
      balanceLedgered: 0,
      exchangeId: null,
    });
    await expect(healNeonOpenBetPlacements([open, done, settled])).resolves.toBe(1);
    expect(mocks.txs).toEqual([
      expect.objectContaining({ betId: 10, amount: -10, category: "bet_stake" }),
    ]);
  });
});

describe("healNeonDeskLedgers", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.accounts = [account({ id: 30, name: "Bet365", type: "bookie" })];
    mocks.txs = [];
    mocks.patches = [];
    mocks.claimed.clear();
    mocks.settlementClaimed.clear();
    mocks.insertError = null;
    mocks.ensureCalls = [];
  });

  it("cash-settles a result that was saved before placement ledgered", async () => {
    const settled = bet({
      id: 12,
      status: "won",
      balanceLedgered: 0,
      exchangeId: null,
      actualProfit: 10,
    });
    await expect(healNeonDeskLedgers([settled])).resolves.toBe(1);
    expect(mocks.txs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ betId: 12, amount: -10, category: "bet_stake" }),
        expect.objectContaining({ betId: 12, amount: 20, category: "bet_settlement" }),
      ])
    );
  });
});

describe("reledgerNeonOpenBetPlacement", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.accounts = [account({ id: 30, name: "Bet365", type: "bookie" })];
    mocks.txs = [];
    mocks.patches = [];
    mocks.claimed.clear();
    mocks.settlementClaimed.clear();
    mocks.insertError = null;
    mocks.ensureCalls = [];
  });

  it("replaces the stake debit when an open bet's stake is edited", async () => {
    mocks.txs.push({
      accountId: 30,
      amount: -10,
      category: "bet_stake",
      betId: 10,
    });
    mocks.claimed.add(10);
    await reledgerNeonOpenBetPlacement(bet({ backStake: 25, exchangeId: null }));
    expect(mocks.txs).toEqual([
      expect.objectContaining({
        accountId: 30,
        amount: -25,
        category: "bet_stake",
        betId: 10,
      }),
    ]);
  });
});
