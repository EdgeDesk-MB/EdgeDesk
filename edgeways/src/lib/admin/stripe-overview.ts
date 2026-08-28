import "server-only";
import type Stripe from "stripe";
import { readExcludedAccountIds } from "@/lib/admin/exclude-accounts-server";
import {
  isExcludedStripeCustomer,
  stripeSkipSets,
} from "@/lib/admin/exclude-accounts";
import { SERIES_COMPARE_DAYS } from "@/lib/admin/series";
import type {
  StripeChartInvoice,
  StripeChartRefund,
} from "@/lib/admin/stripe-charts";
import { formatGbp } from "@/lib/format-money";
import { getStripe, stripeMode, type StripeMode } from "@/lib/billing/stripe-server";
import { listAppUsers } from "@/lib/services/app-users";

export type StripeOverview = {
  configured: boolean;
  mode: StripeMode | null;
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
  invoicePoints: StripeChartInvoice[];
  refundPoints: StripeChartRefund[];
  subscriptionCreatedAt: number[];
  /** Customer ids Stripe still lists, for the desk/Stripe drift check. */
  stripeCustomerIds: string[];
};

function penceToGbp(pence: number | null | undefined): string {
  return formatGbp((pence ?? 0) / 100);
}

/** Deep link into the Stripe dashboard for an invoice, mode-aware. */
export function stripeInvoiceUrl(id: string, mode: StripeMode | null): string {
  const base = "https://dashboard.stripe.com";
  return mode === "test" ? `${base}/test/invoices/${id}` : `${base}/invoices/${id}`;
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

async function listCreatedSince<T extends { id: string }>(
  fetchPage: (params: {
    limit: number;
    created: { gte: number };
    starting_after?: string;
  }) => Promise<{ data: T[]; has_more: boolean }>,
  gteSec: number,
  maxPages = 5
): Promise<T[]> {
  const items: T[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < maxPages; page += 1) {
    const batch = await fetchPage({
      limit: 100,
      created: { gte: gteSec },
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    items.push(...batch.data);
    if (!batch.has_more || batch.data.length === 0) break;
    startingAfter = batch.data[batch.data.length - 1]!.id;
  }
  return items;
}

function stripeCustomerId(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === "string" && id ? id : null;
  }
  return null;
}

export async function loadStripeOverview(): Promise<StripeOverview> {
  const [users, excludedIds] = await Promise.all([
    listAppUsers(),
    readExcludedAccountIds(),
  ]);
  const { skipCustomerIds, skipEmails } = stripeSkipSets(users, excludedIds);
  const founding = users.filter(
    (user) => user.founding && !excludedIds.includes(user.clerkUserId)
  ).length;
  const empty: StripeOverview = {
    configured: false,
    mode: null,
    mrrLabel: "—",
    active: 0,
    trialing: 0,
    pastDue: 0,
    canceled: 0,
    founding,
    invoices: [],
    refunds: [],
    failed: [],
    invoicePoints: [],
    refundPoints: [],
    subscriptionCreatedAt: [],
    stripeCustomerIds: [],
  };

  try {
    const stripe = getStripe();
    const gteSec = Math.floor(
      (Date.now() - SERIES_COMPARE_DAYS * 24 * 60 * 60 * 1000) / 1000
    );
    const [subs, invoices, refunds, invoiceWindow, refundWindow] =
      await Promise.all([
        listAllSubscriptions(stripe),
        stripe.invoices.list({ limit: 20 }),
        stripe.refunds.list({ limit: 20 }),
        listCreatedSince((params) => stripe.invoices.list(params), gteSec),
        listCreatedSince((params) => stripe.refunds.list(params), gteSec),
      ]);

    let mrrPence = 0;
    let active = 0;
    let trialing = 0;
    let pastDue = 0;
    let canceled = 0;

    for (const sub of subs) {
      if (
        isExcludedStripeCustomer({
          customerId: stripeCustomerId(sub.customer),
          email: null,
          skipCustomerIds,
          skipEmails,
        })
      ) {
        continue;
      }
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

    const visibleInvoices = invoices.data.filter(
      (invoice) =>
        !isExcludedStripeCustomer({
          customerId: stripeCustomerId(invoice.customer),
          email: invoice.customer_email,
          skipCustomerIds,
          skipEmails,
        })
    );
    const visibleInvoiceWindow = invoiceWindow.filter(
      (invoice) =>
        !isExcludedStripeCustomer({
          customerId: stripeCustomerId(invoice.customer),
          email: invoice.customer_email,
          skipCustomerIds,
          skipEmails,
        })
    );
    const visibleSubs = subs.filter(
      (sub) =>
        !isExcludedStripeCustomer({
          customerId: stripeCustomerId(sub.customer),
          email: null,
          skipCustomerIds,
          skipEmails,
        })
    );

    const failed = visibleInvoices.filter(
      (invoice) =>
        invoice.status === "open" ||
        invoice.status === "uncollectible" ||
        (invoice.status !== "paid" && invoice.attempted)
    );

    return {
      configured: true,
      mode: stripeMode(),
      mrrLabel: penceToGbp(Math.round(mrrPence)),
      active,
      trialing,
      pastDue,
      canceled,
      founding,
      invoices: visibleInvoices.slice(0, 12).map((invoice) => ({
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
      invoicePoints: visibleInvoiceWindow.map((invoice) => ({
        createdAt: (invoice.created ?? 0) * 1000,
        amountPence: invoice.amount_paid ?? 0,
        paid: invoice.status === "paid",
      })),
      refundPoints: refundWindow.map((refund) => ({
        createdAt: (refund.created ?? 0) * 1000,
        amountPence: refund.amount ?? 0,
      })),
      subscriptionCreatedAt: visibleSubs.map((sub) => (sub.created ?? 0) * 1000),
      stripeCustomerIds: [
        ...new Set(
          visibleSubs
            .map((sub) => sub.customer)
            .filter((id): id is string => typeof id === "string")
        ),
      ],
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stripe is not configured.";
    return { ...empty, message };
  }
}
