import { describe, expect, it } from "vitest";
import { DEFAULT_OWNER_ADMIN_EMAIL } from "@/lib/admin/emails";
import {
  entitledTwoupScoutClerkIds,
  legacyDeskPreviewAllowed,
  seedDeskPreviewsFromUsers,
} from "./desk-previews";

describe("seedDeskPreviewsFromUsers", () => {
  it("allowlists the owner for 2UP and admins for the inbox", () => {
    const seeded = seedDeskPreviewsFromUsers([
      { clerkUserId: "owner", owner: true, admin: true },
      { clerkUserId: "ops", owner: false, admin: true },
      { clerkUserId: "punter", owner: false, admin: false },
    ]);
    expect(seeded.twoup_scout).toEqual({
      mode: "allowlist",
      clerkUserIds: ["owner"],
    });
    expect(seeded.offer_inbox).toEqual({
      mode: "allowlist",
      clerkUserIds: ["owner", "ops"],
    });
  });
});

describe("legacyDeskPreviewAllowed", () => {
  it("keeps the built-in owner and admin gates", () => {
    expect(
      legacyDeskPreviewAllowed("twoup_scout", { email: DEFAULT_OWNER_ADMIN_EMAIL })
    ).toBe(true);
    expect(
      legacyDeskPreviewAllowed("twoup_scout", { email: "punters@example.com" })
    ).toBe(false);
    expect(
      legacyDeskPreviewAllowed("offer_inbox", {
        email: "ops@example.com",
        role: "admin",
      })
    ).toBe(true);
    expect(
      legacyDeskPreviewAllowed("offer_inbox", {
        email: "punters@example.com",
        role: "user",
      })
    ).toBe(false);
  });
});

describe("entitledTwoupScoutClerkIds", () => {
  it("keeps live Edge rows only", () => {
    expect(
      entitledTwoupScoutClerkIds([
        { clerkUserId: "e", plan: "edge", billingStatus: "active" },
        { clerkUserId: "t", plan: "edge", billingStatus: "trialing" },
        { clerkUserId: "c", plan: "core", billingStatus: "active" },
        { clerkUserId: "x", plan: "edge", billingStatus: "canceled" },
      ])
    ).toEqual(["e", "t"]);
  });
});
