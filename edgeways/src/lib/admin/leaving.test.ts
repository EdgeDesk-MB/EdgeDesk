import { describe, expect, it } from "vitest";
import { buildLeavingRows } from "@/lib/admin/leaving";
import type { AdminUserRow } from "@/lib/services/app-users";

const NOW = Date.UTC(2026, 7, 27, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function user(overrides: Partial<AdminUserRow>): AdminUserRow {
  return {
    clerkUserId: "user_1",
    email: "a@b.co",
    plan: "core",
    trialEndsAt: null,
    cancelAt: null,
    ...overrides,
  } as AdminUserRow;
}

describe("buildLeavingRows", () => {
  it("is empty when nobody is leaving", () => {
    expect(buildLeavingRows([user({})], NOW)).toEqual([]);
  });

  it("includes trials ending within 7 days", () => {
    const rows = buildLeavingRows(
      [user({ clerkUserId: "a", trialEndsAt: NOW + 3 * DAY })],
      NOW
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ reason: "Trial ending", at: NOW + 3 * DAY });
  });

  it("excludes trials beyond 7 days or already past", () => {
    const rows = buildLeavingRows(
      [
        user({ clerkUserId: "a", trialEndsAt: NOW + 8 * DAY }),
        user({ clerkUserId: "b", trialEndsAt: NOW - DAY }),
      ],
      NOW
    );
    expect(rows).toEqual([]);
  });

  it("includes scheduled cancels in the future", () => {
    const rows = buildLeavingRows(
      [user({ clerkUserId: "a", cancelAt: NOW + 10 * DAY })],
      NOW
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ reason: "Cancel scheduled" });
  });

  it("prefers trial ending over cancel when both set, and sorts soonest first", () => {
    const rows = buildLeavingRows(
      [
        user({ clerkUserId: "a", cancelAt: NOW + 2 * DAY }),
        user({ clerkUserId: "b", trialEndsAt: NOW + 1 * DAY, cancelAt: NOW + 5 * DAY }),
      ],
      NOW
    );
    expect(rows.map((row) => row.clerkUserId)).toEqual(["b", "a"]);
    expect(rows[0]?.reason).toBe("Trial ending");
  });
});
