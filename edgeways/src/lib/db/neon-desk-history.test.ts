/**
 * EDGE-99 regression: history dedupe is scoped per user. The insert must
 * target the (clerk_user_id, dedupe) composite — a revert to bare `dedupe`
 * would reintroduce cross-user collisions and silent row loss on restore.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clerkUserId: "user_a" as string | null,
  capturedValues: undefined as Record<string, unknown> | undefined,
  capturedConflict: undefined as { target: unknown } | undefined,
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
          onConflictDoNothing: (conflict: { target: unknown }) => {
            mocks.capturedConflict = conflict;
            return Promise.resolve();
          },
        };
      },
    }),
  }),
}));

import { insertNeonDeskHistory } from "@/lib/db/neon-desk-history";
import { history as pgHistory } from "@/lib/db/schema.pg";

describe("insertNeonDeskHistory (EDGE-99)", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_a";
    mocks.capturedValues = undefined;
    mocks.capturedConflict = undefined;
  });

  it("targets the (clerk_user_id, dedupe) composite on conflict", async () => {
    await insertNeonDeskHistory({
      dedupe: "bet:1:placed",
      kind: "bet_placed",
      title: "Bet placed",
      createdAt: 1,
    });
    expect(mocks.capturedValues?.clerkUserId).toBe("user_a");
    expect(mocks.capturedConflict?.target).toEqual([
      pgHistory.clerkUserId,
      pgHistory.dedupe,
    ]);
  });

  it("writes nothing when signed out", async () => {
    mocks.clerkUserId = null;
    await insertNeonDeskHistory({
      dedupe: "bet:1:placed",
      kind: "bet_placed",
      title: "Bet placed",
      createdAt: 1,
    });
    expect(mocks.capturedValues).toBeUndefined();
  });
});
