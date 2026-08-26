import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  buildPaymentFailedEmail,
  invoiceSubscriptionId,
  paymentFailedAlert,
  paymentFailedDedupe,
} from "./dunning";

function invoice(partial: Record<string, unknown> = {}): Stripe.Invoice {
  return {
    id: "in_1",
    customer: "cus_1",
    amount_due: 1499,
    ...partial,
  } as unknown as Stripe.Invoice;
}

describe("invoiceSubscriptionId (EDGE-6)", () => {
  it("reads the 2025+ parent.subscription_details shape", () => {
    const inv = invoice({
      parent: { subscription_details: { subscription: "sub_1" } },
    });
    expect(invoiceSubscriptionId(inv)).toBe("sub_1");
  });

  it("reads the legacy invoice.subscription shape", () => {
    expect(invoiceSubscriptionId(invoice({ subscription: "sub_2" }))).toBe("sub_2");
  });

  it("handles expanded objects and missing values", () => {
    expect(
      invoiceSubscriptionId(invoice({ subscription: { id: "sub_3" } }))
    ).toBe("sub_3");
    expect(invoiceSubscriptionId(invoice())).toBeNull();
  });
});

describe("paymentFailedAlert (EDGE-6)", () => {
  it("keys on the subscription so Stripe retries update one row", () => {
    const alert = paymentFailedAlert(
      invoice({ parent: { subscription_details: { subscription: "sub_9" } } })
    );
    expect(alert.key).toBe(paymentFailedDedupe("sub_9"));
    expect(alert.kind).toBe("payment_failed");
    expect(alert.title).toContain("£14.99");
    expect(alert.href).toBe("/settings");
  });

  it("falls back to the customer id when no subscription is linked", () => {
    expect(paymentFailedAlert(invoice()).key).toBe("payment_failed:cus_1");
  });

  it("names the next retry date when Stripe provides one", () => {
    const alert = paymentFailedAlert(
      invoice({ next_payment_attempt: 1_800_000_000 })
    );
    expect(alert.body).toMatch(/retry automatically on \d{1,2} \w+/);
  });

  it("stays vague when no retry is scheduled", () => {
    expect(paymentFailedAlert(invoice()).body).toContain(
      "retry the payment automatically"
    );
  });
});

describe("buildPaymentFailedEmail (EDGE-6)", () => {
  it("links to settings and states the amount", () => {
    const mail = buildPaymentFailedEmail({
      invoice: invoice(),
      settingsUrl: "https://edgeways.app/settings",
    });
    expect(mail.subject).toContain("payment");
    expect(mail.text).toContain("£14.99");
    expect(mail.text).toContain("https://edgeways.app/settings");
    expect(mail.html).toContain("https://edgeways.app/settings");
  });
});
