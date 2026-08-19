import { describe, expect, it } from "vitest";
import {
  buildReceiptFromOffer,
  buildSubscribeReceipt,
  receiptNextStep,
  receiptReference,
} from "@/lib/billing/receipt-view";

describe("subscribe receipt", () => {
  it("shows Edge trial with nothing due today", () => {
    const receipt = buildSubscribeReceipt({
      id: "cs_test_abcdefghijklmnopqrstuvwxyz",
      amount_total: 0,
      created: Date.UTC(2026, 7, 15) / 1000,
      customer_details: { email: "sam@example.com" },
      metadata: { plan: "edge", interval: "month" },
    });
    expect(receipt).not.toBeNull();
    expect(receipt!.planName).toBe("Edge");
    expect(receipt!.intervalLabel).toBe("Monthly");
    expect(receipt!.paidToday).toBe("£0");
    expect(receipt!.nextCharge).toBe("£24.99/mo");
    expect(receipt!.nextChargeOn).toBeNull();
    expect(receipt!.trialNote).toBe("14 days of Edge, then list price");
    expect(receipt!.email).toBe("sam@example.com");
    expect(receipt!.dateLabel).toBe("15 Aug 2026");
    expect(receipt!.headline).toBe("Your 14 days start now");
    expect(receipt!.nextStep).toBe("Add your bank and bookies to start");
    expect(receipt!.reference).toBeTruthy();
  });

  it("paints an Edge slip from the plan before Stripe returns", () => {
    const receipt = buildReceiptFromOffer("edge", "month");
    expect(receipt.paidToday).toBe("£0");
    expect(receipt.reference).toBeNull();
    expect(receipt.headline).toBe("Your 14 days start now");
  });

  it("shows Core yearly without a trial", () => {
    const receipt = buildSubscribeReceipt({
      id: "cs_test_coreyear",
      amount_total: 9990,
      created: 1,
      metadata: { plan: "core", interval: "year" },
    });
    expect(receipt).not.toBeNull();
    expect(receipt!.planName).toBe("Core");
    expect(receipt!.intervalLabel).toBe("Yearly");
    expect(receipt!.paidToday).toBe("£99.90");
    expect(receipt!.nextCharge).toBe("£99.90/yr");
    expect(receipt!.trialNote).toBeNull();
    expect(receipt!.headline).toBe("Core is live");
    expect(receipt!.nextStep).toBe("Add your bank and bookies to start");
  });

  it("treats Edge with money due today as paid, not a trial", () => {
    const receipt = buildSubscribeReceipt({
      id: "cs_test_edgepaid",
      amount_total: 2499,
      created: 1,
      metadata: { plan: "edge", interval: "month" },
    });
    expect(receipt).not.toBeNull();
    expect(receipt!.headline).toBe("Edge is live");
    expect(receipt!.trialNote).toBeNull();
    expect(receipt!.paidToday).toBe("£24.99");
    expect(receipt!.nextCharge).toBe("£24.99/mo");
  });

  it("prints the Stripe first-charge calendar date when the subscription is expanded", () => {
    const trialEnd = Date.UTC(2026, 7, 30) / 1000;
    const receipt = buildSubscribeReceipt({
      id: "cs_test_trialdate",
      amount_total: 0,
      created: Date.UTC(2026, 7, 16) / 1000,
      metadata: { plan: "edge", interval: "month" },
      subscription: { trial_end: trialEnd, current_period_end: trialEnd },
    });
    expect(receipt).not.toBeNull();
    expect(receipt!.nextCharge).toBe("£24.99/mo");
    expect(receipt!.nextChargeOn).toBe("30 Aug 2026");
  });

  it("uses current_period_end when there is no trial", () => {
    const periodEnd = Date.UTC(2027, 7, 16) / 1000;
    const receipt = buildSubscribeReceipt({
      id: "cs_test_coredate",
      amount_total: 9990,
      created: Date.UTC(2026, 7, 16) / 1000,
      metadata: { plan: "core", interval: "year" },
      subscription: { trial_end: null, current_period_end: periodEnd },
    });
    expect(receipt!.nextChargeOn).toBe("16 Aug 2027");
  });

  it("shortens the Stripe session id for the slip", () => {
    expect(receiptReference("cs_test_abcdefghij")).toBe("ABCDEFGHIJ");
  });

  it("tells an onboarding checkout to close the extra tab", () => {
    expect(receiptNextStep()).toBe("Add your bank and bookies to start");
    expect(receiptNextStep("setup")).toBe(
      "Close this tab and continue setup in the other one."
    );
  });
});
