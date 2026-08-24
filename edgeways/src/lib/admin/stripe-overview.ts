import "server-only";
import type Stripe from "stripe";
import { formatGbp } from "@/lib/format-money";
import { getStripe } from "@/lib/billing/stripe-server";
import { listAppUsers } from "@/lib/services/app-users";

export type StripeOverview = {
  configured: boolean;
  message?: string;
  mrrLabel: string;
  active: number;
  trialing: number;
  pastDue: number;
  canceled: number;
  founding: number;
  invoices: Array<{
    id: string;
    email: string | null;
    amountLabel: string;
    status: string;
    createdAt: number;
  }>;
  refunds: Array<{
    id: string;
    amountLabel: string;
    status: string;
    createdAt: number;
  }>;
  failed: Array<{
    id: string;
    email: string | null;
    amountLabel: string;
    status: string;
    createdAt: number;
  }>;
};

function penceToGbp(pence: number | null | undefined): string {
  return formatGbp((pence ?? 0) / 100);
}

/** Page through every subscription so MRR/counts stay right past 100 subs. */
async function listAllSubscriptions(
  stripe: ReturnType<typeof getStripe>
): Promise<Stripe.Subscription[]> {
  const subs: Stripe.Subscription[] = [];
  let startingAfter: string | undefined;
  // 10 pages x 100 = 1000 subs is far beyond launch scale; stop there.
  for (let page = 0; page < 10; page += 1) {
    const batch = await stripe.subscriptions.list({
      status: "all",
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    subs.push(...batch.data);
    if (!batch.has_more || batch.data.length === 0) break;
    startingAfter = batch.data[batch.data.length - 1]!.id;
  }
  return subs;
}

export async function loadStripeOverview(): Promise<StripeOverview> {
  const users = await listAppUsers();
  const founding = users.filter((user) => user.founding).length;
  const empty: StripeOverview = {
    configured: false,
    mrrLabel: "—",
    active: 0,
    trialing: 0,
    pastDue: 0,
    canceled: 0,
    founding,
    invoices: [],
    refunds: [],
    failed: [],
  };

  try {
    const stripe = getStripe();
    const [subs, invoices, refunds] = await Promise.all([
      listAllSubscriptions(stripe),
      stripe.invoices.list({ limit: 20 }),
      stripe.refunds.list({ limit: 20 }),
    ]);

    let mrrPence = 0;
    let active = 0;
    let trialing = 0;
    let pastDue = 0;
    let canceled = 0;

    for (const sub of subs) {
      if (sub.status === "active") active += 1;
      else if (sub.status === "trialing") trialing += 1;
      else if (sub.status === "past_due") pastDue += 1;
      else if (sub.status === "canceled") canceled += 1;

      if (sub.status === "active" || sub.status === "trialing") {
        for (const item of sub.items.data) {
          const amount = item.price?.unit_amount ?? 0;
          const qty = item.quantity ?? 1;
          const interval = item.price?.recurring?.interval;
          const yearly = interval === "year" ? amount / 12 : amount;
          mrrPence += yearly * qty;
        }
      }
    }

    const failed = invoices.data.filter(
      (invoice) =>
        invoice.status === "open" ||
        invoice.status === "uncollectible" ||
        (invoice.status !== "paid" && invoice.attempted)
    );

    return {
      configured: true,
      mrrLabel: penceToGbp(Math.round(mrrPence)),
      active,
      trialing,
      pastDue,
      canceled,
      founding,
      invoices: invoices.data.slice(0, 12).map((invoice) => ({
        id: invoice.id,
        email: invoice.customer_email,
        amountLabel: penceToGbp(invoice.amount_paid || invoice.amount_due),
        status: invoice.status ?? "unknown",
        createdAt: (invoice.created ?? 0) * 1000,
      })),
      refunds: refunds.data.slice(0, 12).map((refund) => ({
        id: refund.id,
        amountLabel: penceToGbp(refund.amount),
        status: refund.status ?? "unknown",
        createdAt: (refund.created ?? 0) * 1000,
      })),
      failed: failed.slice(0, 12).map((invoice) => ({
        id: invoice.id,
        email: invoice.customer_email,
        amountLabel: penceToGbp(invoice.amount_due),
        status: invoice.status ?? "open",
        createdAt: (invoice.created ?? 0) * 1000,
      })),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stripe is not configured.";
    return { ...empty, message };
  }
}
