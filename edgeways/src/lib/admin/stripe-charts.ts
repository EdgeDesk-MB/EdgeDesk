import { formatGbp } from "@/lib/format-money";
import {
  compareTrailingWindows,
  dailyCountsFromEpochs,
  dailySumsFromEpochValues,
  lastDays,
  shareSlices,
  SERIES_COMPARE_DAYS,
  SERIES_WINDOW_DAYS,
  type DayCount,
  type PeriodCompare,
  type ShareSlice,
} from "@/lib/admin/series";

export type StripeChartInvoice = {
  createdAt: number;
  amountPence: number;
  paid: boolean;
};

export type StripeChartRefund = {
  createdAt: number;
  amountPence: number;
};

export type StripeStatusCounts = {
  active: number;
  trialing: number;
  pastDue: number;
  canceled: number;
};

export type StripeCharts = {
  paidVolume30: DayCount[];
  paidCount30: DayCount[];
  refundVolume30: DayCount[];
  newSubs30: DayCount[];
  statusShare: ShareSlice[];
  week: {
    paidVolume: PeriodCompare;
    paidCount: PeriodCompare;
    refunds: PeriodCompare;
    newSubs: PeriodCompare;
  };
  month: {
    paidVolume: PeriodCompare;
    newSubs: PeriodCompare;
  };
};

export function formatPenceGbp(pence: number): string {
  return formatGbp(pence / 100);
}

export function chartsFromStripeOverview(
  stripe: {
    invoicePoints: StripeChartInvoice[];
    refundPoints: StripeChartRefund[];
    subscriptionCreatedAt: number[];
    active: number;
    trialing: number;
    pastDue: number;
    canceled: number;
  },
  now: Date = new Date()
): StripeCharts {
  return buildStripeCharts(
    {
      invoices: stripe.invoicePoints,
      refunds: stripe.refundPoints,
      subscriptionCreatedAt: stripe.subscriptionCreatedAt,
      status: {
        active: stripe.active,
        trialing: stripe.trialing,
        pastDue: stripe.pastDue,
        canceled: stripe.canceled,
      },
    },
    now
  );
}

export function buildStripeCharts(
  input: {
    invoices: StripeChartInvoice[];
    refunds: StripeChartRefund[];
    subscriptionCreatedAt: number[];
    status: StripeStatusCounts;
  },
  now: Date = new Date()
): StripeCharts {
  const paid = input.invoices.filter((invoice) => invoice.paid);
  const paidVolume60 = dailySumsFromEpochValues(
    paid.map((invoice) => ({ at: invoice.createdAt, value: invoice.amountPence })),
    SERIES_COMPARE_DAYS,
    now
  );
  const paidCount60 = dailyCountsFromEpochs(
    paid.map((invoice) => invoice.createdAt),
    SERIES_COMPARE_DAYS,
    now
  );
  const refund60 = dailySumsFromEpochValues(
    input.refunds.map((refund) => ({
      at: refund.createdAt,
      value: refund.amountPence,
    })),
    SERIES_COMPARE_DAYS,
    now
  );
  const newSubs60 = dailyCountsFromEpochs(
    input.subscriptionCreatedAt,
    SERIES_COMPARE_DAYS,
    now
  );

  return {
    paidVolume30: lastDays(paidVolume60, SERIES_WINDOW_DAYS),
    paidCount30: lastDays(paidCount60, SERIES_WINDOW_DAYS),
    refundVolume30: lastDays(refund60, SERIES_WINDOW_DAYS),
    newSubs30: lastDays(newSubs60, SERIES_WINDOW_DAYS),
    statusShare: shareSlices([
      { key: "active", label: "Active", value: input.status.active, tone: "success" },
      {
        key: "trialing",
        label: "Trialing",
        value: input.status.trialing,
        tone: "brand",
      },
      {
        key: "past_due",
        label: "Past due",
        value: input.status.pastDue,
        tone: "destructive",
      },
      {
        key: "canceled",
        label: "Cancelled",
        value: input.status.canceled,
        tone: "muted",
      },
    ]),
    week: {
      paidVolume: compareTrailingWindows(paidVolume60, 7),
      paidCount: compareTrailingWindows(paidCount60, 7),
      refunds: compareTrailingWindows(refund60, 7),
      newSubs: compareTrailingWindows(newSubs60, 7),
    },
    month: {
      paidVolume: compareTrailingWindows(paidVolume60, 30),
      newSubs: compareTrailingWindows(newSubs60, 30),
    },
  };
}

export function buildFoundingShare(
  founding: number,
  totalAccounts: number
): ShareSlice[] {
  return shareSlices([
    { key: "founding", label: "Founding", value: founding, tone: "warning" },
    {
      key: "standard",
      label: "Standard",
      value: Math.max(0, totalAccounts - founding),
      tone: "muted",
    },
  ]);
}
