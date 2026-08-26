/**
 * EDGE-110 regression: the hosted alerts inbox is per-user. Inserts must
 * carry clerk_user_id and the upsert must target the (clerk_user_id, dedupe)
 * composite - a revert to bare `dedupe` would collide across customers
 * (result_settled:12 is a different bet for every desk).
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
          onConflictDoUpdate: (conflict: { target: unknown }) => {
            mocks.capturedConflict = conflict;
            return Promise.resolve();
          },
        };
      },
    }),
  }),
}));

import {
  recordNeonAlerts,
  recordNeonAlertsForUser,
} from "@/lib/db/neon-alerts-inbox";
import { alertsInbox as pgAlertsInbox } from "@/lib/db/schema.pg";

describe("recordNeonAlertsForUser (EDGE-110)", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_a";
    mocks.capturedValues = undefined;
    mocks.capturedConflict = undefined;
  });

  it("stamps the owner and targets the (clerk_user_id, dedupe) composite", async () => {
    const recorded = await recordNeonAlertsForUser("user_b", [
      { key: "result_settled:12", kind: "result_settled", title: "Bet won" },
    ]);
    expect(recorded).toBe(1);
    expect(mocks.capturedValues?.clerkUserId).toBe("user_b");
    expect(mocks.capturedValues?.dedupe).toBe("result_settled:12");
    expect(mocks.capturedConflict?.target).toEqual([
      pgAlertsInbox.clerkUserId,
      pgAlertsInbox.dedupe,
    ]);
  });

  it("skips alerts without a key or title", async () => {
    const recorded = await recordNeonAlertsForUser("user_b", [
      { key: "", kind: "k", title: "t" },
      { key: "k", kind: "k", title: "" },
    ]);
    expect(recorded).toBe(0);
    expect(mocks.capturedValues).toBeUndefined();
  });
});

describe("recordNeonAlerts (desk-scoped)", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_a";
    mocks.capturedValues = undefined;
    mocks.capturedConflict = undefined;
  });

  it("records under the signed-in desk", async () => {
    await recordNeonAlerts([{ key: "k1", kind: "kind", title: "Title" }]);
    expect(mocks.capturedValues?.clerkUserId).toBe("user_a");
  });

  it("writes nothing when signed out", async () => {
    mocks.clerkUserId = null;
    const recorded = await recordNeonAlerts([
      { key: "k1", kind: "kind", title: "Title" },
    ]);
    expect(recorded).toBe(0);
    expect(mocks.capturedValues).toBeUndefined();
  });
});
