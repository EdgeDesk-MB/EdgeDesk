import { describe, expect, it } from "vitest";
import { DEFAULT_BOOTSTRAP_ADMIN_EMAIL } from "@/lib/admin/emails";
import {
  resendAudienceMembership,
  resendAudienceSegmentIds,
  shouldSyncResendAudience,
} from "./resend-audience-sync";

describe("shouldSyncResendAudience", () => {
  it("needs an email and skips the operator inbox", () => {
    expect(
      shouldSyncResendAudience({
        email: "a@b.com",
        plan: "free",
        billingStatus: "none",
      })
    ).toBe(true);
    expect(
      shouldSyncResendAudience({
        email: null,
        plan: "free",
        billingStatus: "none",
      })
    ).toBe(false);
    expect(
      shouldSyncResendAudience({
        email: DEFAULT_BOOTSTRAP_ADMIN_EMAIL,
        plan: "edge",
        billingStatus: "active",
      })
    ).toBe(false);
  });
});

describe("resendAudienceMembership", () => {
  it("puts free accounts in All users + Free", () => {
    expect(
      resendAudienceMembership({ plan: "free", billingStatus: "none" })
    ).toEqual({ allUsers: true, free: true, paid: false });
    expect(
      resendAudienceMembership({ plan: "free", billingStatus: "canceled" })
    ).toEqual({ allUsers: true, free: true, paid: false });
  });

  it("puts trial in All users only", () => {
    expect(
      resendAudienceMembership({ plan: "edge", billingStatus: "trialing" })
    ).toEqual({ allUsers: true, free: false, paid: false });
  });

  it("puts live and past-due subscribers in Paid", () => {
    expect(
      resendAudienceMembership({ plan: "edge", billingStatus: "active" })
    ).toEqual({ allUsers: true, free: false, paid: true });
    expect(
      resendAudienceMembership({ plan: "core", billingStatus: "past_due" })
    ).toEqual({ allUsers: true, free: false, paid: true });
  });
});

describe("resendAudienceSegmentIds", () => {
  it("reads the three segment env vars", () => {
    expect(
      resendAudienceSegmentIds({
        RESEND_SEGMENT_ALL_USERS: " all ",
        RESEND_SEGMENT_FREE: "free",
        RESEND_SEGMENT_PAID: "paid",
      })
    ).toEqual({ allUsers: "all", free: "free", paid: "paid" });
  });
});
