/**
 * EDGE-214: pure pieces of `npm run seed:agent`. Dev-only Clerk accounts
 * (agent-customer, agent-admin, and agent-new from EDGE-220) so unattended
 * agent runs can replay signed-in, /admin and first-time journeys. Clerk
 * test-mode emails (`+clerk_test`) sign in with the fixed code 424242 on the
 * development instance.
 *
 * Kept free of Clerk and env loading so Vitest can drive it against a temp
 * SQLite file. The runner is `scripts/seed-agent.ts`.
 */
import type Database from "better-sqlite3";
import { matchedBet, type BetMode } from "@/lib/calc/matched";
import { roundPence } from "@/lib/calc/money";
import { settleFromOutcome } from "@/lib/calc/settlement";

export const CLERK_TEST_EMAIL_MARKER = "+clerk_test@";
export const CLERK_TEST_VERIFICATION_CODE = "424242";

export type AgentKey = "customer" | "admin" | "new";

export type AgentAccount = {
  key: AgentKey;
  /** Handle used in AGENTS.md and journey write-ups. */
  handle: "agent-customer" | "agent-admin" | "agent-new";
  email: string;
  firstName: string;
  lastName: string;
  role: "user" | "admin";
  plan: "edge";
  billingStatus: "active";
  /**
   * `history`: completed campaigns plus a live pipeline. `empty`: set-up
   * accounts only, no offers or bets, so first-time journeys start clean.
   */
  desk: "history" | "empty";
  /** Completed offer campaigns to seed (each is a qualifier plus a free bet). */
  campaigns: number;
};

export const DEFAULT_AGENT_CUSTOMER_EMAIL = "agent-customer+clerk_test@example.com";
export const DEFAULT_AGENT_ADMIN_EMAIL = "agent-admin+clerk_test@example.com";
export const DEFAULT_AGENT_NEW_EMAIL = "agent-new+clerk_test@example.com";

/** Heavy history for /history performance work (EDGE-209). */
export const CUSTOMER_CAMPAIGNS = 1200;
export const ADMIN_CAMPAIGNS = 12;

export function agentAccounts(
  env: Record<string, string | undefined> = process.env
): AgentAccount[] {
  return [
    {
      key: "customer",
      handle: "agent-customer",
      email: normaliseEmail(env.AGENT_CUSTOMER_EMAIL) ?? DEFAULT_AGENT_CUSTOMER_EMAIL,
      firstName: "Agent",
      lastName: "Customer",
      role: "user",
      plan: "edge",
      billingStatus: "active",
      desk: "history",
      campaigns: CUSTOMER_CAMPAIGNS,
    },
    {
      key: "admin",
      handle: "agent-admin",
      email: normaliseEmail(env.AGENT_ADMIN_EMAIL) ?? DEFAULT_AGENT_ADMIN_EMAIL,
      firstName: "Agent",
      lastName: "Admin",
      role: "admin",
      plan: "edge",
      billingStatus: "active",
      desk: "history",
      campaigns: ADMIN_CAMPAIGNS,
    },
    {
      key: "new",
      handle: "agent-new",
      email: normaliseEmail(env.AGENT_NEW_EMAIL) ?? DEFAULT_AGENT_NEW_EMAIL,
      firstName: "Agent",
      lastName: "New",
      role: "user",
      plan: "edge",
      billingStatus: "active",
      desk: "empty",
      campaigns: 0,
    },
  ];
}

function normaliseEmail(value: string | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

/**
 * Refuse anything that could reach production or a real desk. Returns the
 * reasons so the runner can print every problem at once.
 */
export function seedRefusals(
  env: Record<string, string | undefined>,
  accounts: AgentAccount[] = agentAccounts(env)
): string[] {
  const reasons: string[] = [];
  const secret = env.CLERK_SECRET_KEY?.trim() ?? "";
  if (!secret) {
    reasons.push("CLERK_SECRET_KEY is not set.");
  } else if (!secret.startsWith("sk_test_")) {
    reasons.push("CLERK_SECRET_KEY is not a development key (sk_test_). Refusing to touch a live Clerk instance.");
  }
  const publishable = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  if (publishable && !publishable.startsWith("pk_test_")) {
    reasons.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not a development key (pk_test_).");
  }
  if (env.EDGEWAYS_DESK_BACKEND?.trim().toLowerCase() === "neon") {
    reasons.push("EDGEWAYS_DESK_BACKEND=neon. The agent seed only writes the local SQLite desk.");
  }
  if (env.DATABASE_URL?.trim()) {
    reasons.push("DATABASE_URL is set, so the app reads accounts from Postgres. The agent seed only writes local SQLite.");
  }
  if (env.EDGEWAYS_DB_PATH?.trim()) {
    reasons.push("EDGEWAYS_DB_PATH is set. The agent seed resets per-login desk files and will not touch an override file.");
  }
  for (const account of accounts) {
    if (!account.email.includes(CLERK_TEST_EMAIL_MARKER)) {
      reasons.push(`${account.handle} email must be a Clerk test address (name+clerk_test@domain).`);
    }
  }
  for (let i = 0; i < accounts.length; i += 1) {
    for (let j = i + 1; j < accounts.length; j += 1) {
      if (accounts[i]!.email === accounts[j]!.email) {
        reasons.push(`${accounts[i]!.handle} and ${accounts[j]!.handle} need different emails.`);
      }
    }
  }
  return reasons;
}

/** Clerk `unsafeMetadata` so the 18+ gate and legal consent are already done. */
export function agentClerkMetadata(now: number): Record<string, unknown> {
  return {
    ageConfirmed: true,
    ageConfirmedAt: now,
    legalAccepted: true,
    legalAcceptedAt: now,
    agentTestAccount: true,
  };
}

/**
 * Empty every table in an agent's own desk file. Reference rows (exchanges,
 * casino library) come back when the app bootstrap next opens the file.
 */
export function resetDeskFile(sqlite: Database.Database): void {
  const tables = sqlite
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
    )
    .all() as { name: string }[];
  const hasSequence = Boolean(
    sqlite
      .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sqlite_sequence'`)
      .get()
  );
  sqlite.transaction(() => {
    for (const { name } of tables) {
      sqlite.exec(`DELETE FROM "${name.replace(/"/g, '""')}"`);
    }
    if (hasSequence) sqlite.exec(`DELETE FROM sqlite_sequence`);
  })();
}

/** Insert or refresh the local `app_users` row (role, plan, consent). */
export function upsertAgentAppUser(
  sqlite: Database.Database,
  input: {
    clerkUserId: string;
    account: AgentAccount;
    legalVersion: string;
    now: number;
  }
): void {
  const { clerkUserId, account, legalVersion, now } = input;
  sqlite
    .prepare(
      `INSERT INTO app_users (clerk_user_id, email, created_at, updated_at, plan, billing_status,
         role, onboarding_profile, legal_accepted_at, legal_version)
       VALUES (@clerkUserId, @email, @now, @now, @plan, @billingStatus, @role, NULL, @now, @legalVersion)
       ON CONFLICT(clerk_user_id) DO UPDATE SET
         email = excluded.email,
         updated_at = excluded.updated_at,
         plan = excluded.plan,
         billing_status = excluded.billing_status,
         stripe_customer_id = NULL,
         stripe_subscription_id = NULL,
         trial_ends_at = NULL,
         cancel_at = NULL,
         role = excluded.role,
         legal_accepted_at = excluded.legal_accepted_at,
         legal_version = excluded.legal_version`
    )
    .run({
      clerkUserId,
      email: account.email,
      now,
      plan: account.plan,
      billingStatus: account.billingStatus,
      role: account.role,
      legalVersion,
    });
}

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const COMMISSION = 0.02;

const BOOKIES = [
  "Bet365",
  "William Hill",
  "Sky Bet",
  "Paddy Power",
  "Betfred",
  "Coral",
  "Ladbrokes",
  "BetVictor",
] as const;

const FIXTURES = [
  ["Arsenal", "Chelsea"],
  ["Liverpool", "Everton"],
  ["Man City", "Tottenham"],
  ["Newcastle", "Aston Villa"],
  ["Brighton", "West Ham"],
  ["Leeds", "Sunderland"],
  ["Celtic", "Rangers"],
  ["Real Madrid", "Barcelona"],
] as const;

const OFFER_SHAPES = [
  { qual: 10, free: 30, title: "Bet £10 get £30 in free bets" },
  { qual: 25, free: 25, title: "Bet £25 get £25 free bet" },
  { qual: 10, free: 10, title: "Bet £10 get £10 reload" },
  { qual: 20, free: 20, title: "Bet £20 get £20 free bet" },
  { qual: 5, free: 5, title: "Weekly club: bet £5 get £5" },
] as const;

/** Deterministic PRNG so every run seeds the same desk. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type DeskSeedSummary = {
  accounts: number;
  offers: number;
  settledBets: number;
  openBets: number;
};

type SeedBet = {
  label: string;
  betType: BetMode;
  bookmaker: string;
  backStake: number;
  backOdds: number;
  layOdds: number;
};

/** Bank, exchange and bookie accounts with deposits, which is what setup leaves behind. */
function seedDeskAccounts(sqlite: Database.Database, openedAt: number): number {
  const insertAccount = sqlite.prepare(
    `INSERT INTO accounts (name, type, is_active, access_status, wr_remaining, wr_type, created_at)
     VALUES (?, ?, 1, 'available', 0, 'stake', ?)`
  );
  const insertTx = sqlite.prepare(
    `INSERT INTO balance_transactions (account_id, amount, category, note, created_at)
     VALUES (?, ?, 'top_up', ?, ?)`
  );
  const bankId = insertAccount.run("Agent Bank", "bank", openedAt).lastInsertRowid;
  insertTx.run(bankId, 2000, "Starting bankroll", openedAt);
  const exchangeAccountId = insertAccount.run("Betfair", "exchange", openedAt).lastInsertRowid;
  insertTx.run(exchangeAccountId, 750, "Exchange float", openedAt);
  for (const bookie of BOOKIES) {
    const id = insertAccount.run(bookie, "bookie", openedAt).lastInsertRowid;
    insertTx.run(id, 50, "Deposit", openedAt);
  }
  return BOOKIES.length + 2;
}

/**
 * Seed the agent-new desk: past setup (bank, exchange, bookies funded) with
 * no offers, bets or events, so realised profit is £0 and Home shows the
 * first-time welcome. Assumes an empty, bootstrapped desk file.
 */
export function seedEmptyAgentDesk(
  sqlite: Database.Database,
  input: { now?: number } = {}
): DeskSeedSummary {
  const now = input.now ?? Date.now();
  const accounts = seedDeskAccounts(sqlite, now - DAY);
  return { accounts, offers: 0, settledBets: 0, openBets: 0 };
}

/**
 * Seed one agent desk: bank, bookies, exchange, completed campaigns spread
 * over the last 18 months, and a live pipeline for today. Assumes an empty,
 * bootstrapped desk file (see `resetDeskFile`).
 */
export function seedAgentDesk(
  sqlite: Database.Database,
  input: { campaigns: number; now?: number; seed?: number }
): DeskSeedSummary {
  const now = input.now ?? Date.now();
  const rand = mulberry32(input.seed ?? 214);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;
  const oddsBetween = (lo: number, hi: number) =>
    Math.round((lo + rand() * (hi - lo)) * 20) / 20;

  const exchange = sqlite
    .prepare(`SELECT id FROM exchanges WHERE lower(name) = 'betfair' LIMIT 1`)
    .get() as { id: number } | undefined;
  const exchangeId = exchange?.id ?? null;

  const historyDays = 540;
  const accounts = seedDeskAccounts(sqlite, now - (historyDays + 7) * DAY);

  const insertOffer = sqlite.prepare(
    `INSERT INTO offers (title, bookmaker, status, expected_profit, expires_at, created_at, completed_at, sport)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'football')`
  );
  const updateOfferExpected = sqlite.prepare(`UPDATE offers SET expected_profit = ? WHERE id = ?`);
  const insertSnapshot = sqlite.prepare(
    `INSERT INTO offer_ev_snapshots (offer_id, version, locked_at, expected_profit, basis,
       realized_profit, capture_pct, settled_at, mistake_tag)
     VALUES (?, 1, ?, ?, 'estimated', ?, ?, ?, NULL)`
  );
  const insertBet = sqlite.prepare(
    `INSERT INTO bets (label, market, selection, bet_type, bookmaker, exchange_id, back_stake, back_odds,
       lay_stake, lay_odds, commission, status, expected_profit, actual_profit, balance_ledgered,
       balance_settled, created_at, settled_at, offer_id, sport)
     VALUES (@label, 'match_odds', '', @betType, @bookmaker, @exchangeId, @backStake, @backOdds,
       @layStake, @layOdds, @commission, @status, @expectedProfit, @actualProfit, 1,
       @balanceSettled, @createdAt, @settledAt, @offerId, 'football')`
  );

  const placeBet = (
    bet: SeedBet,
    offerId: number | bigint,
    createdAt: number,
    settle: { won: boolean; at: number } | null
  ): { expected: number; actual: number } => {
    const matched = matchedBet({
      mode: bet.betType,
      backStake: bet.backStake,
      backOdds: bet.backOdds,
      layOdds: bet.layOdds,
      commission: COMMISSION,
    });
    const outcome = settle
      ? settleFromOutcome(
          {
            market: "match_odds",
            selection: "",
            betType: bet.betType,
            backStake: bet.backStake,
            backOdds: bet.backOdds,
            layStake: matched.layStake,
            layOdds: bet.layOdds,
            commission: COMMISSION,
          },
          settle.won
        )
      : null;
    const expected = roundPence(matched.guaranteed);
    const actual = outcome ? roundPence(outcome.profit) : 0;
    insertBet.run({
      label: bet.label,
      betType: bet.betType,
      bookmaker: bet.bookmaker,
      exchangeId,
      backStake: bet.backStake,
      backOdds: bet.backOdds,
      layStake: matched.layStake,
      layOdds: bet.layOdds,
      commission: COMMISSION,
      status: outcome ? outcome.status : "open",
      expectedProfit: expected,
      actualProfit: outcome ? actual : null,
      balanceSettled: outcome ? 1 : 0,
      createdAt,
      settledAt: settle ? settle.at : null,
      offerId,
    });
    return { expected, actual };
  };

  const fixtureLabel = () => {
    const [home, away] = pick(FIXTURES);
    return `${home} v ${away} - ${rand() < 0.5 ? home : away}`;
  };

  let settledBets = 0;
  const campaigns = Math.max(0, Math.floor(input.campaigns));
  for (let i = 0; i < campaigns; i += 1) {
    const shape = pick(OFFER_SHAPES);
    const bookie = pick(BOOKIES);
    // Newest campaign starts 4 days back so its free bet settles before now.
    const daysAgo = campaigns === 1 ? 4 : 4 + Math.floor(((historyDays - 4) * (campaigns - 1 - i)) / (campaigns - 1));
    const qualAt = now - daysAgo * DAY - Math.floor(rand() * 12) * HOUR;
    const freeAt = qualAt + Math.floor(1 + rand() * 2) * DAY;

    const qualOdds = oddsBetween(1.8, 3.5);
    const freeOdds = oddsBetween(4, 8);
    const qualifier: SeedBet = {
      label: `${fixtureLabel()} (qualifier)`,
      betType: "qualifying",
      bookmaker: bookie,
      backStake: shape.qual,
      backOdds: qualOdds,
      layOdds: Math.round((qualOdds + 0.02 + rand() * 0.1) * 100) / 100,
    };
    const freeBet: SeedBet = {
      label: `${fixtureLabel()} (free bet)`,
      betType: "free_snr",
      bookmaker: bookie,
      backStake: shape.free,
      backOdds: freeOdds,
      layOdds: Math.round((freeOdds + 0.05 + rand() * 0.3) * 100) / 100,
    };

    const offerId = insertOffer.run(
      shape.title, bookie, "completed", null, null, qualAt - HOUR, freeAt + 2 * HOUR
    ).lastInsertRowid;
    const q = placeBet(qualifier, offerId, qualAt, { won: rand() < 1 / qualOdds, at: qualAt + 2 * HOUR });
    const f = placeBet(freeBet, offerId, freeAt, { won: rand() < 1 / freeOdds, at: freeAt + 2 * HOUR });
    settledBets += 2;

    const expected = roundPence(q.expected + f.expected);
    const realized = roundPence(q.actual + f.actual);
    updateOfferExpected.run(expected, offerId);
    insertSnapshot.run(
      offerId,
      qualAt - HOUR,
      expected,
      realized,
      expected !== 0 ? realized / expected : null,
      freeAt + 2 * HOUR
    );
  }

  // Live pipeline: two active offers with an open qualifier, one planned.
  let openBets = 0;
  const today = now - 2 * HOUR;
  for (const [title, bookie] of [
    ["Bet £20 get £20 free bet", "Sky Bet"],
    ["Bet £10 get £30 in free bets", "Bet365"],
  ] as const) {
    const offerId = insertOffer.run(title, bookie, "active", null, now + 2 * DAY, today - HOUR, null)
      .lastInsertRowid;
    const odds = oddsBetween(2, 3);
    const q = placeBet(
      {
        label: `${fixtureLabel()} (qualifier)`,
        betType: "qualifying",
        bookmaker: bookie,
        backStake: title.startsWith("Bet £20") ? 20 : 10,
        backOdds: odds,
        layOdds: Math.round((odds + 0.04) * 100) / 100,
      },
      offerId,
      today,
      null
    );
    updateOfferExpected.run(q.expected, offerId);
    insertSnapshot.run(offerId, today - HOUR, q.expected, null, null, null);
    openBets += 1;
  }
  insertOffer.run("Midweek reload: bet £10 get £5", "William Hill", "planned", 3.75, now + 5 * DAY, today, null);

  return {
    accounts,
    offers: campaigns + 3,
    settledBets,
    openBets,
  };
}
