import { describe, expect, it } from "vitest";
import { DEFAULT_BOOTSTRAP_ADMIN_EMAIL } from "@/lib/admin/emails";
import {
  buildNewCustomerNotifyEmail,
  buildNewUserNotifyEmail,
  buildPaidInvoiceNotifyEmail,
  ownerGrowthNotifyRecipients,
  shouldNotifyCustomer,
  shouldNotifyNewUser,
  shouldNotifyPaidInvoice,
} from "./owner-growth-notify";

describe("ownerGrowthNotifyRecipients", () => {
  it("prefers SIGNUP_NOTIFY_TO", () => {
    expect(
      ownerGrowthNotifyRecipients({
        SIGNUP_NOTIFY_TO: "growth@example.com",
        FEEDBACK_NOTIFY_TO: "feedback@example.com",
        WAITLIST_NOTIFY_TO: "waitlist@example.com",
      })
    ).toEqual(["growth@example.com"]);
  });

  it("falls back to FEEDBACK_NOTIFY_TO then WAITLIST_NOTIFY_TO", () => {
    expect(
      ownerGrowthNotifyRecipients({
        FEEDBACK_NOTIFY_TO: "Feedback@Example.com",
        WAITLIST_NOTIFY_TO: "waitlist@example.com",
      })
    ).toEqual(["feedback@example.com"]);
    expect(
      ownerGrowthNotifyRecipients({
        WAITLIST_NOTIFY_TO: "Owner@Example.com, nope",
      })
    ).toEqual(["owner@example.com"]);
  });
});

describe("shouldNotifyNewUser", () => {
  it("only fires on first create, and skips the operator inbox", () => {
    expect(shouldNotifyNewUser({ isNew: true, email: "a@b.com" })).toBe(true);
    expect(shouldNotifyNewUser({ isNew: false, email: "a@b.com" })).toBe(false);
    expect(
      shouldNotifyNewUser({
        isNew: true,
        email: DEFAULT_BOOTSTRAP_ADMIN_EMAIL,
      })
    ).toBe(false);
  });
});

describe("shouldNotifyCustomer / paid invoice", () => {
  it("skips the operator inbox and zero-amount invoices", () => {
    expect(shouldNotifyCustomer({ email: "a@b.com" })).toBe(true);
    expect(
      shouldNotifyCustomer({ email: DEFAULT_BOOTSTRAP_ADMIN_EMAIL })
    ).toBe(false);
    expect(shouldNotifyPaidInvoice({ amountPaid: 1999, email: "a@b.com" })).toBe(
      true
    );
    expect(shouldNotifyPaidInvoice({ amountPaid: 0, email: "a@b.com" })).toBe(
      false
    );
    expect(
      shouldNotifyPaidInvoice({
        amountPaid: 1999,
        email: DEFAULT_BOOTSTRAP_ADMIN_EMAIL,
      })
    ).toBe(false);
  });
});

describe("owner growth email copy", () => {
  it("builds subjects for user, trial, and paid", () => {
    expect(
      buildNewUserNotifyEmail({
        email: "new@example.com",
        clerkUserId: "user_1",
      }).subject
    ).toBe("New user: new@example.com");
    expect(
      buildNewCustomerNotifyEmail({
        kind: "trial",
        email: "new@example.com",
        plan: "edge",
        status: "trialing",
        subscriptionId: "sub_1",
      }).subject
    ).toBe("New trial: new@example.com");
    expect(
      buildPaidInvoiceNotifyEmail({
        email: "new@example.com",
        amountPaid: 1999,
        currency: "gbp",
        invoiceId: "in_1",
      }).subject
    ).toBe("Paid £19.99: new@example.com");
  });
});
