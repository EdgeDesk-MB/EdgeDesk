import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/services/settings-shared";

const mocks = vi.hoisted(() => ({
  settings: {} as AppSettings,
  patches: [] as Array<Record<string, unknown>>,
  alerts: [] as Array<{ key: string }>,
  snapshots: [] as Array<Record<string, unknown>>,
  bets: [] as unknown[],
  accounts: [] as unknown[],
  offers: [] as unknown[],
}));

vi.mock("@/lib/db/neon-desk-settings", () => ({
  getNeonDeskSettings: async () => mocks.settings,
  patchNeonDeskSettings: async (patch: Record<string, unknown>) => {
    mocks.patches.push(patch);
    mocks.settings = { ...mocks.settings, ...patch };
    return mocks.settings;
  },
}));

vi.mock("@/lib/db/neon-desk-ev-snapshots", () => ({
  listNeonAllSnapshots: async () => mocks.snapshots,
}));

vi.mock("@/lib/db/neon-desk", () => ({
  listNeonDeskBets: async () => mocks.bets,
}));

vi.mock("@/lib/db/neon-desk-accounts", () => ({
  listNeonDeskAccounts: async () => mocks.accounts,
  listNeonDeskBalanceTransactions: async () => [],
}));

vi.mock("@/lib/db/neon-desk-offers", () => ({
  listNeonDeskOffers: async () => mocks.offers,
}));

vi.mock("@/lib/db/neon-desk-acca", () => ({
  listNeonAccaRuns: async () => [],
}));
vi.mock("@/lib/db/neon-desk-systems", () => ({
  listNeonSystemRuns: async () => [],
}));
vi.mock("@/lib/db/neon-desk-bet-builder", () => ({
  listNeonBetBuilderRuns: async () => [],
}));
vi.mock("@/lib/db/neon-desk-free-bet-lots", () => ({
  listNeonOpenFreeBetLots: async () => [],
}));

vi.mock("@/lib/services/alerts-inbox", () => ({
  recordAlertsAsync: async (alerts: Array<{ key: string }>) => {
    mocks.alerts.push(...alerts);
    return alerts.length;
  },
}));

vi.mock("@/lib/services/push", () => ({
  sendPush: async () => undefined,
}));

vi.mock("@/lib/offers/weekly-digest-content", () => ({
  buildWeeklyDigest: () => ({ title: "Last week", body: "You captured 90%." }),
}));

vi.mock("@/lib/offers/daily-tasks-digest", () => ({
  buildDailyTasksDigest: () => ({ title: "Your tasks today", body: "One offer expires." }),
  reminderHorizonDays: () => 3,
  selectExpiryDoNextTasks: () => [{ id: "task-1" }],
}));

vi.mock("@/lib/offers/do-next", () => ({
  buildDoNextItems: () => [],
}));

import {
  maybeSendNeonDailyTasksDigest,
  maybeSendNeonWeeklyDigest,
} from "@/lib/db/neon-desk-digests";

const MONDAY_0800 = new Date(2026, 6, 13, 8, 0).getTime();
const MONDAY_0930 = new Date(2026, 6, 13, 9, 30).getTime();
const AFTER_NINE = new Date(2026, 7, 6, 10, 0).getTime();

describe("maybeSendNeonWeeklyDigest", () => {
  beforeEach(() => {
    mocks.settings = { ...DEFAULT_SETTINGS, digestWeekly: true };
    mocks.settings.digestLastSentWeek = null;
    mocks.settings.dailyTasksLastSentDay = null;
    mocks.patches = [];
    mocks.alerts = [];
    mocks.snapshots = [];
    mocks.bets = [];
    mocks.accounts = [];
    mocks.offers = [];
  });

  it("does nothing when the toggle is off", async () => {
    mocks.settings = { ...DEFAULT_SETTINGS, digestWeekly: false };
    expect(await maybeSendNeonWeeklyDigest(MONDAY_0930)).toBe(false);
    expect(mocks.patches).toEqual([]);
  });

  it("does nothing before Monday 09:00", async () => {
    expect(await maybeSendNeonWeeklyDigest(MONDAY_0800)).toBe(false);
    expect(mocks.patches).toEqual([]);
  });

  it("latches and records the inbox once the window opens", async () => {
    expect(await maybeSendNeonWeeklyDigest(MONDAY_0930)).toBe(true);
    expect(mocks.patches[0]).toMatchObject({ digestLastSentWeek: expect.stringMatching(/^2026-W/) });
    expect(mocks.alerts[0]?.key).toMatch(/^digest:2026-W/);
    expect(await maybeSendNeonWeeklyDigest(MONDAY_0930)).toBe(false);
    expect(mocks.alerts).toHaveLength(1);
  });
});

describe("maybeSendNeonDailyTasksDigest", () => {
  beforeEach(() => {
    mocks.settings = { ...DEFAULT_SETTINGS };
    mocks.patches = [];
    mocks.alerts = [];
    mocks.offers = [];
  });

  it("latches the day even when reminders are on and due", async () => {
    expect(await maybeSendNeonDailyTasksDigest(AFTER_NINE)).toBe(true);
    expect(mocks.patches[0]).toEqual({ dailyTasksLastSentDay: "2026-08-06" });
    expect(mocks.alerts[0]?.key).toBe("daily_tasks:2026-08-06");
    expect(await maybeSendNeonDailyTasksDigest(AFTER_NINE)).toBe(false);
  });

  it("does nothing when reminders are off", async () => {
    mocks.settings = { ...DEFAULT_SETTINGS, offerRemindersEnabled: false };
    expect(await maybeSendNeonDailyTasksDigest(AFTER_NINE)).toBe(false);
    expect(mocks.patches).toEqual([]);
  });
});
