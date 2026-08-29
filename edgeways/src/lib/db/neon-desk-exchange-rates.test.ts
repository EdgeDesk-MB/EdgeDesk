import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clerkUserId: "user_live" as string | null,
  inserted: undefined as Record<string, unknown> | undefined,
  conflictSet: undefined as Record<string, unknown> | undefined,
  clearedDefault: false,
}));

vi.mock("@/lib/db/neon-desk", () => ({
  neonDeskClerkUserId: () => mocks.clerkUserId,
}));

vi.mock("@/lib/db/neon-desk-accounts", () => ({
  listNeonExchanges: () =>
    Promise.resolve([
      {
        id: 2,
        name: "Betdaq",
        commissionPct: 2,
        brandColor: "#7b2d8b",
        backColor: "#fce38f",
        layColor: "#b5e5c4",
        isDefault: 0,
        createdAt: 1,
      },
    ]),
  insertNeonExchange: vi.fn(),
}));

vi.mock("@/lib/db/neon", () => ({
  getNeonDb: () => ({
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([]),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => {
          mocks.clearedDefault = true;
          return Promise.resolve();
        },
      }),
    }),
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        mocks.inserted = values;
        return {
          onConflictDoUpdate: (args: { set: Record<string, unknown> }) => {
            mocks.conflictSet = args.set;
            return Promise.resolve();
          },
        };
      },
    }),
  }),
}));

import {
  setNeonDeskDefaultExchange,
  upsertNeonDeskExchangeRate,
} from "@/lib/db/neon-desk-exchange-rates";

describe("hosted desk exchange overlay", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.inserted = undefined;
    mocks.conflictSet = undefined;
    mocks.clearedDefault = false;
  });

  it("writes 0% instead of dropping it as empty", async () => {
    await upsertNeonDeskExchangeRate(1, 0);
    expect(mocks.inserted).toMatchObject({
      clerkUserId: "user_live",
      exchangeId: 1,
      commissionPct: 0,
    });
    expect(mocks.conflictSet).toMatchObject({ commissionPct: 0 });
  });

  it("marks Betdaq default for this desk without touching the shared catalog", async () => {
    await setNeonDeskDefaultExchange(2);
    expect(mocks.clearedDefault).toBe(true);
    expect(mocks.inserted).toMatchObject({
      clerkUserId: "user_live",
      exchangeId: 2,
      isDefault: 1,
    });
    expect(mocks.conflictSet).toMatchObject({ isDefault: 1 });
  });
});
