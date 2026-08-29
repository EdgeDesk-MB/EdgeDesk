/**
 * Follow writes must be per-login and idempotent. A missing conflict target
 * would duplicate rows or throw when the customer tracks the same race twice.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clerkUserId: "user_live" as string | null,
  inserted: undefined as Record<string, unknown> | undefined,
  conflictTarget: undefined as unknown,
  deletedWhere: false,
}));

vi.mock("@/lib/db/neon-desk", () => ({
  neonDeskClerkUserId: () => mocks.clerkUserId,
  listNeonDeskBets: () => Promise.resolve([]),
}));

vi.mock("@/lib/db/neon-events", () => ({
  listNeonEvents: () => Promise.resolve([]),
}));

vi.mock("@/lib/db/neon", () => ({
  getNeonDb: () => ({
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        mocks.inserted = values;
        return {
          onConflictDoNothing: (conflict: { target: unknown }) => {
            mocks.conflictTarget = conflict.target;
            return Promise.resolve();
          },
        };
      },
    }),
    delete: () => ({
      where: () => {
        mocks.deletedWhere = true;
        return Promise.resolve();
      },
    }),
  }),
}));

import { followNeonEvent, unfollowNeonEvent } from "@/lib/db/neon-desk-tracked-events";
import { deskTrackedEvents } from "@/lib/db/schema.pg";

describe("desk tracked events", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.inserted = undefined;
    mocks.conflictTarget = undefined;
    mocks.deletedWhere = false;
  });

  it("follows a fixture for this login only", async () => {
    await followNeonEvent(42);
    expect(mocks.inserted).toMatchObject({
      clerkUserId: "user_live",
      eventId: 42,
    });
    expect(mocks.conflictTarget).toEqual([
      deskTrackedEvents.clerkUserId,
      deskTrackedEvents.eventId,
    ]);
  });

  it("does not write when signed out", async () => {
    mocks.clerkUserId = null;
    await followNeonEvent(42);
    expect(mocks.inserted).toBeUndefined();
  });

  it("unfollows without throwing", async () => {
    await unfollowNeonEvent(42);
    expect(mocks.deletedWhere).toBe(true);
  });
});
