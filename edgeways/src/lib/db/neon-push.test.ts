/**
 * EDGE-110 regression: hosted push subscriptions are per-desk. Saving claims
 * the endpoint for the signed-in owner (a browser profile re-subscribing
 * under a different login moves the device), and a signed-out request must
 * never write.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clerkUserId: "user_a" as string | null,
  capturedValues: undefined as Record<string, unknown> | undefined,
  capturedConflictSet: undefined as Record<string, unknown> | undefined,
  selectRows: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/db/neon-desk", () => ({
  neonDeskClerkUserId: () => mocks.clerkUserId,
}));

vi.mock("@/lib/db/neon", () => ({
  getNeonDb: () => ({
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        mocks.capturedValues = values;
        return {
          onConflictDoUpdate: (conflict: { set: Record<string, unknown> }) => {
            mocks.capturedConflictSet = conflict.set;
            return Promise.resolve();
          },
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(mocks.selectRows),
      }),
    }),
  }),
}));

vi.mock("@/lib/services/app-users", () => ({
  ensureNeonOperatorSettingsTable: async () => {},
}));

import {
  listNeonPushSubscriptions,
  saveNeonPushSubscription,
} from "@/lib/db/neon-push";

describe("saveNeonPushSubscription (EDGE-110)", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_a";
    mocks.capturedValues = undefined;
    mocks.capturedConflictSet = undefined;
  });

  it("stamps the owning desk on insert and re-claims on conflict", async () => {
    const saved = await saveNeonPushSubscription({
      endpoint: "https://push.example/abc",
      p256dh: "p",
      auth: "a",
      label: "Pixel",
    });
    expect(saved).toBe(true);
    expect(mocks.capturedValues?.clerkUserId).toBe("user_a");
    expect(mocks.capturedConflictSet?.clerkUserId).toBe("user_a");
  });

  it("refuses to write when signed out", async () => {
    mocks.clerkUserId = null;
    const saved = await saveNeonPushSubscription({
      endpoint: "https://push.example/abc",
      p256dh: "p",
      auth: "a",
    });
    expect(saved).toBe(false);
    expect(mocks.capturedValues).toBeUndefined();
  });
});

describe("listNeonPushSubscriptions (EDGE-110)", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_a";
    mocks.selectRows = [];
  });

  it("maps stored rows to the shared subscription shape", async () => {
    mocks.selectRows = [
      {
        id: 7,
        clerkUserId: "user_a",
        endpoint: "https://push.example/abc",
        p256dh: "p",
        auth: "a",
        label: "Pixel",
        createdAt: 1,
        lastOkAt: 2,
      },
    ];
    const subs = await listNeonPushSubscriptions();
    expect(subs).toEqual([
      {
        id: 7,
        endpoint: "https://push.example/abc",
        p256dh: "p",
        auth: "a",
        label: "Pixel",
        createdAt: 1,
        lastOkAt: 2,
      },
    ]);
  });

  it("returns no devices when signed out", async () => {
    mocks.clerkUserId = null;
    expect(await listNeonPushSubscriptions()).toEqual([]);
  });
});
