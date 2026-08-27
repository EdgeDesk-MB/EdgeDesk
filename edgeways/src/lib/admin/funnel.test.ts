import { describe, expect, it } from "vitest";
import { buildAttributionShare, buildWaitlistFunnel } from "@/lib/admin/funnel";
import type { AdminUserRow } from "@/lib/services/app-users";
import type { WaitlistRow } from "@/lib/services/waitlist-store";

function waitlistRow(email: string, overrides: Partial<WaitlistRow> = {}): WaitlistRow {
  return {
    email,
    createdAt: 1,
    confirmedAt: 2,
    unsubscribedAt: null,
    ...overrides,
  } as WaitlistRow;
}

function user(email: string, plan: string, attribution?: string): AdminUserRow {
  return {
    clerkUserId: email,
    email,
    plan,
    onboardingProfile: attribution
      ? { attribution, attributionOther: null }
      : null,
  } as unknown as AdminUserRow;
}

describe("buildWaitlistFunnel", () => {
  it("counts joined, confirmed and paid as a narrowing funnel", () => {
    const waitlist = [
      waitlistRow("a@x.co"),
      waitlistRow("b@x.co"),
      waitlistRow("c@x.co", { confirmedAt: null }),
      waitlistRow("d@x.co", { unsubscribedAt: 3 }),
    ];
    const users = [user("a@x.co", "core"), user("b@x.co", "free")];
    const funnel = buildWaitlistFunnel(waitlist, users);
    expect(funnel).toEqual({ joined: 4, confirmed: 2, paid: 1 });
  });

  it("is zero on empty input", () => {
    expect(buildWaitlistFunnel([], [])).toEqual({ joined: 0, confirmed: 0, paid: 0 });
  });
});

describe("buildAttributionShare", () => {
  it("groups real answers by label and skips skipped/missing", () => {
    const users = [
      user("a@x.co", "free", "reddit"),
      user("b@x.co", "free", "reddit"),
      user("c@x.co", "free", "friend"),
      user("d@x.co", "free", "skipped"),
      user("e@x.co", "free"),
    ];
    const share = buildAttributionShare(users);
    const reddit = share.find((slice) => slice.label === "Reddit");
    const friend = share.find((slice) => slice.label === "A friend");
    expect(reddit?.value).toBe(2);
    expect(friend?.value).toBe(1);
    expect(share.find((slice) => slice.label === "skipped")).toBeUndefined();
  });

  it("is empty when nobody answered", () => {
    expect(buildAttributionShare([user("a@x.co", "free")])).toEqual([]);
  });
});
