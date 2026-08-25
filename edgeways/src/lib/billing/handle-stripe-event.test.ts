import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { preferredLiveSubscription } from "@/lib/billing/handle-stripe-event";

function sub(
  id: string,
  status: string,
  created: number
): Stripe.Subscription {
  return { id, status, created } as Stripe.Subscription;
}

describe("preferredLiveSubscription (EDGE-82)", () => {
  it("keeps a live incoming subscription", () => {
    const incoming = sub("sub_new", "active", 200);
    const others = [sub("sub_old", "active", 100)];
    expect(preferredLiveSubscription(incoming, others).id).toBe("sub_new");
  });

  it("switches to the other live sub when the incoming one canceled", () => {
    const incoming = sub("sub_old", "canceled", 100);
    const others = [sub("sub_old", "canceled", 100), sub("sub_new", "trialing", 200)];
    expect(preferredLiveSubscription(incoming, others).id).toBe("sub_new");
  });

  it("prefers the newest live sub when several exist", () => {
    const incoming = sub("sub_old", "canceled", 100);
    const others = [
      sub("sub_a", "active", 150),
      sub("sub_b", "past_due", 300),
      sub("sub_c", "active", 250),
    ];
    expect(preferredLiveSubscription(incoming, others).id).toBe("sub_b");
  });

  it("keeps the canceled incoming sub when nothing else is live", () => {
    const incoming = sub("sub_only", "canceled", 100);
    const others = [
      sub("sub_only", "canceled", 100),
      sub("sub_gone", "incomplete_expired", 90),
    ];
    expect(preferredLiveSubscription(incoming, others).id).toBe("sub_only");
  });
});
