import { describe, expect, it } from "vitest";
import { buildStripeDrift, stripeDriftNote } from "@/lib/admin/stripe-drift";
import type { AdminUserRow } from "@/lib/services/app-users";

function user(overrides: Partial<AdminUserRow>): AdminUserRow {
  return {
    clerkUserId: "user_1",
    email: "a@b.co",
    plan: "free",
    stripeCustomerId: null,
    ...overrides,
  } as AdminUserRow;
}

describe("buildStripeDrift", () => {
  it("is zero when both sides agree", () => {
    const users = [
      user({ clerkUserId: "a", plan: "core", stripeCustomerId: "cus_1" }),
      user({ clerkUserId: "b", plan: "free" }),
    ];
    expect(buildStripeDrift(users, ["cus_1"])).toEqual({
      stripeOnly: 0,
      deskOnly: 0,
    });
  });

  it("flags Stripe customers with no desk", () => {
    const users = [user({ clerkUserId: "a", plan: "core", stripeCustomerId: "cus_1" })];
    expect(buildStripeDrift(users, ["cus_1", "cus_2", "cus_3"]).stripeOnly).toBe(2);
  });

  it("flags paid accounts with no Stripe customer", () => {
    const users = [
      user({ clerkUserId: "a", plan: "edge" }),
      user({ clerkUserId: "b", plan: "core", stripeCustomerId: "cus_1" }),
      user({ clerkUserId: "c", plan: "free" }),
    ];
    expect(buildStripeDrift(users, ["cus_1"]).deskOnly).toBe(1);
  });

  it("ignores free accounts with no Stripe customer", () => {
    const users = [user({ clerkUserId: "a", plan: "free" })];
    expect(buildStripeDrift(users, []).deskOnly).toBe(0);
  });
});

describe("stripeDriftNote", () => {
  it("is null when there is no drift", () => {
    expect(stripeDriftNote({ stripeOnly: 0, deskOnly: 0 })).toBeNull();
  });

  it("joins both sides with a dot separator", () => {
    expect(stripeDriftNote({ stripeOnly: 2, deskOnly: 1 })).toBe(
      "2 Stripe customers with no desk · 1 paid account with no Stripe customer"
    );
  });

  it("pluralises correctly", () => {
    expect(stripeDriftNote({ stripeOnly: 1, deskOnly: 0 })).toBe(
      "1 Stripe customer with no desk"
    );
  });
});
