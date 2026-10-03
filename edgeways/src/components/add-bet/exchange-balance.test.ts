import { describe, expect, it } from "vitest";
import {
  exchangeFundingNeed,
  findExchangeBalanceAccount,
  openLaysOnExchange,
} from "./exchange-balance";
import type { SharedLiabilityLay } from "@/lib/calc/shared-liability";
import type { AccountBalance } from "@/lib/services/balances.types";

const exchange = (overrides: Partial<AccountBalance> = {}): AccountBalance =>
  ({
    id: 2,
    name: "Betdaq",
    type: "exchange",
    isActive: 1,
    exchangeId: 7,
    brandColor: null,
    sortOrder: 0,
    createdAt: 0,
    balance: 40,
    freeBets: 0,
    pendingIn: 0,
    ...overrides,
  }) as AccountBalance;

type OpenBet = Parameters<typeof openLaysOnExchange>[0] extends
  | Array<infer T>
  | undefined
  ? T
  : never;

/** An open ledgered lay on Betdaq: Home 20 @ 3, liability 40. */
const openBet = (overrides: Partial<OpenBet> = {}): OpenBet => ({
  id: 1,
  eventId: 9,
  market: "match_odds",
  selection: "home",
  layStake: 20,
  layOdds: 3,
  commission: 0.02,
  status: "open",
  balanceLedgered: 1,
  exchangeId: 7,
  ...overrides,
});

/** The bet being added: Home 20 @ 3.5, liability 50. */
const candidate = (overrides: Partial<SharedLiabilityLay> = {}): SharedLiabilityLay => ({
  id: "add-bet",
  eventId: 9,
  market: "match_odds",
  selection: "home",
  layStake: 20,
  layOdds: 3.5,
  commission: 0.02,
  ...overrides,
});

describe("findExchangeBalanceAccount", () => {
  it("prefers the wallet linked to the selected exchange id", () => {
    const accounts = [
      exchange({ id: 2, name: "Betdaq", exchangeId: 7, balance: 40 }),
      exchange({ id: 3, name: "Smarkets", exchangeId: 8, balance: 10 }),
    ];
    expect(findExchangeBalanceAccount(accounts, 7, "Betdaq")?.balance).toBe(40);
    expect(findExchangeBalanceAccount(accounts, 8, "Smarkets")?.id).toBe(3);
  });

  it("falls back to the venue name when no exchange id match", () => {
    const accounts = [exchange({ exchangeId: null, name: "Betdaq", balance: 12 })];
    expect(findExchangeBalanceAccount(accounts, 7, "Betdaq")?.balance).toBe(12);
  });
});

describe("openLaysOnExchange", () => {
  it("keeps open ledgered lays on the selected wallet only", () => {
    const bets = [
      openBet({ id: 1 }),
      openBet({ id: 2, exchangeId: 8 }),
      openBet({ id: 3, status: "won" }),
      openBet({ id: 4, balanceLedgered: 0 }),
      openBet({ id: 5, layStake: 0 }),
    ];
    expect(openLaysOnExchange(bets, 7).map((l) => l.id)).toEqual([1]);
  });

  it("is empty when no exchange is selected", () => {
    expect(openLaysOnExchange([openBet()], null)).toEqual([]);
  });
});

describe("exchangeFundingNeed", () => {
  const need = (
    accounts: AccountBalance[] | undefined,
    lay: SharedLiabilityLay,
    open: SharedLiabilityLay[] = []
  ) => exchangeFundingNeed(accounts, 7, "Betdaq", lay, open);

  it("is short when the selected exchange cash is below the cash required", () => {
    // Balance 40. Liability 50 is short; liability 40 exactly fits.
    expect(need([exchange()], candidate()).needsFunding).toBe(true);
    expect(need([exchange()], candidate({ layOdds: 3 })).needsFunding).toBe(false);
  });

  it("is short when there is no wallet for the selected exchange", () => {
    expect(need([], candidate()).needsFunding).toBe(true);
  });

  it("is fine when there is no liability or no exchange selected", () => {
    expect(need([exchange()], candidate({ layStake: 0 })).needsFunding).toBe(false);
    expect(
      exchangeFundingNeed([exchange()], null, "", candidate()).needsFunding
    ).toBe(false);
  });

  it("counts only the increase when editing the lay already held", () => {
    // Bet 1 holds 40 of the balance already, so going 40 -> 50 needs 10.
    const open = openLaysOnExchange([openBet({ id: 1 })], 7);
    const edited = need([exchange()], candidate({ id: 1 }), open);
    expect(edited.cashRequired).toBe(10);
    expect(edited.needsFunding).toBe(false);
  });

  it("needs the full liability when the held lay is elsewhere or unledgered", () => {
    const otherExchange = openLaysOnExchange([openBet({ id: 1, exchangeId: 8 })], 7);
    const unledgered = openLaysOnExchange([openBet({ id: 1, balanceLedgered: 0 })], 7);
    const settled = openLaysOnExchange([openBet({ id: 1, status: "won" })], 7);
    for (const open of [otherExchange, unledgered, settled]) {
      const checked = need([exchange()], candidate({ id: 1 }), open);
      expect(checked.cashRequired).toBe(50);
      expect(checked.needsFunding).toBe(true);
    }
  });

  it("does not warn when another result of the market shares the liability", () => {
    // Held: lay home 100 @ 2.0 (100.00). New: lay away 100 @ 3.0 (200.00).
    //   home wins: -100.00 + 100 x 0.98 = -2.00
    //   away wins: -200.00 + 100 x 0.98 = -102.00  <- worst
    // Reserve 100.00 -> 102.00, so the new lay locks 2.00 of its 200.00.
    const open = openLaysOnExchange(
      [openBet({ id: 1, selection: "home", layStake: 100, layOdds: 2 })],
      7
    );
    const checked = need(
      [exchange()],
      candidate({ selection: "away", layStake: 100, layOdds: 3 }),
      open
    );
    expect(checked.grossLiability).toBe(200);
    expect(checked.cashRequired).toBe(2);
    expect(checked.sharedSaving).toBe(198);
    expect(checked.shared).toBe(true);
    expect(checked.needsFunding).toBe(false);
  });

  it("still warns when sharing covers only part of the liability", () => {
    // Held: lay home 20 @ 3.0 (40.00). New: lay away 100 @ 3.0 (200.00).
    //   away wins: -200.00 + 20 x 0.98 = -180.40  <- worst
    // Reserve 40.00 -> 180.40, so 140.40 more is needed against a 40.00 wallet.
    const open = openLaysOnExchange([openBet({ id: 1, selection: "home" })], 7);
    const checked = need(
      [exchange()],
      candidate({ selection: "away", layStake: 100, layOdds: 3 }),
      open
    );
    expect(checked.cashRequired).toBe(140.4);
    expect(checked.shared).toBe(true);
    expect(checked.needsFunding).toBe(true);
  });

  it("does not share a market where several selections can win", () => {
    // Two runners can both place, so both place lays can lose.
    const open = openLaysOnExchange(
      [openBet({ id: 1, market: "place", selection: "Runner A" })],
      7
    );
    const checked = need(
      [exchange()],
      candidate({ market: "place", selection: "Runner B" }),
      open
    );
    expect(checked.cashRequired).toBe(50);
    expect(checked.shared).toBe(false);
    expect(checked.needsFunding).toBe(true);
  });

  it("does not share when no event is linked yet", () => {
    const open = openLaysOnExchange([openBet({ id: 1, selection: "home" })], 7);
    const checked = need([exchange()], candidate({ eventId: null, selection: "away" }), open);
    expect(checked.cashRequired).toBe(50);
    expect(checked.shared).toBe(false);
  });
});
