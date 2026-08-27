import { adminBillingStatusLabel } from "@/lib/billing/operator-complimentary";
import {
  compareTrailingWindows,
  cumulativeSeries,
  dailyCountsFromEpochs,
  lastDays,
  shareSlices,
  SERIES_COMPARE_DAYS,
  SERIES_WINDOW_DAYS,
  type DayCount,
  type PeriodCompare,
  type ShareSlice,
} from "@/lib/admin/series";

export type AccountGrowthInput = {
  createdAt: number;
  updatedAt: number;
  plan: string;
  billingStatus: string;
  stripeCustomerId: string | null | undefined;
  admin: boolean;
};

export type WaitlistGrowthInput = {
  createdAt: number;
  confirmedAt: number | null;
  unsubscribedAt: number | null;
};

export type AccountGrowth = {
  signups30: DayCount[];
  signupsCumulative30: DayCount[];
  waitlist30: DayCount[];
  confirmed30: DayCount[];
  paidSignups30: DayCount[];
  planShare: ShareSlice[];
  billingShare: ShareSlice[];
  recencyShare: ShareSlice[];
  roleShare: ShareSlice[];
  week: {
    signups: PeriodCompare;
    waitlist: PeriodCompare;
    confirmed: PeriodCompare;
    paidSignups: PeriodCompare;
  };
  month: {
    signups: PeriodCompare;
    waitlist: PeriodCompare;
    paidSignups: PeriodCompare;
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;

function titleCaseStatus(label: string): string {
  return label
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function billingTone(label: string): ShareSlice["tone"] {
  const key = label.toLowerCase();
  if (key === "complimentary") return "edge";
  if (key === "active") return "success";
  if (key === "trialing") return "brand";
  if (key.includes("past")) return "destructive";
  if (key.includes("cancel")) return "muted";
  if (key === "none" || key === "free") return "muted";
  return "warning";
}

function recencyBucket(updatedAt: number, nowMs: number): string {
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return "Older";
  const age = nowMs - updatedAt;
  if (age <= DAY_MS) return "Last 24 hours";
  if (age <= 7 * DAY_MS) return "2 to 7 days";
  if (age <= 30 * DAY_MS) return "8 to 30 days";
  return "Older";
}

function countBy<T extends string>(
  items: T[],
  keys: T[]
): Record<T, number> {
  const counts = Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
  for (const item of items) {
    counts[item] = (counts[item] ?? 0) + 1;
  }
  return counts;
}

/**
 * Snapshot charts from app_users + waitlist. Paid-plan signups use the
 * account created day for people who now hold Core or Edge, not the day
 * they converted (we do not store conversion history).
 */
export function buildAccountGrowth(
  users: AccountGrowthInput[],
  waitlist: WaitlistGrowthInput[],
  now: Date = new Date()
): AccountGrowth {
  const signups60 = dailyCountsFromEpochs(
    users.map((user) => user.createdAt),
    SERIES_COMPARE_DAYS,
    now
  );
  const waitlist60 = dailyCountsFromEpochs(
    waitlist.map((row) => row.createdAt),
    SERIES_COMPARE_DAYS,
    now
  );
  const confirmed60 = dailyCountsFromEpochs(
    waitlist
      .map((row) => row.confirmedAt)
      .filter((ms): ms is number => ms != null && ms > 0),
    SERIES_COMPARE_DAYS,
    now
  );
  const paidSignups60 = dailyCountsFromEpochs(
    users
      .filter((user) => user.plan === "core" || user.plan === "edge")
      .map((user) => user.createdAt),
    SERIES_COMPARE_DAYS,
    now
  );

  const signups30 = lastDays(signups60, SERIES_WINDOW_DAYS);
  const planCounts = countBy(
    users.map((user) => user.plan),
    ["free", "core", "edge"]
  );
  const billingCounts = new Map<string, number>();
  for (const user of users) {
    const label = titleCaseStatus(adminBillingStatusLabel(user));
    billingCounts.set(label, (billingCounts.get(label) ?? 0) + 1);
  }
  const recencyCounts = countBy(
    users.map((user) => recencyBucket(user.updatedAt, now.getTime())),
    ["Last 24 hours", "2 to 7 days", "8 to 30 days", "Older"]
  );
  const admins = users.filter((user) => user.admin).length;

  return {
    signups30,
    signupsCumulative30: cumulativeSeries(signups30),
    waitlist30: lastDays(waitlist60, SERIES_WINDOW_DAYS),
    confirmed30: lastDays(confirmed60, SERIES_WINDOW_DAYS),
    paidSignups30: lastDays(paidSignups60, SERIES_WINDOW_DAYS),
    planShare: shareSlices([
      { key: "free", label: "Free", value: planCounts.free, tone: "muted" },
      { key: "core", label: "Core", value: planCounts.core, tone: "brand" },
      { key: "edge", label: "Edge", value: planCounts.edge, tone: "edge" },
    ]),
    billingShare: shareSlices(
      [...billingCounts.entries()].map(([label, value]) => ({
        key: label.toLowerCase().replace(/\s+/g, "-"),
        label,
        value,
        tone: billingTone(label),
      }))
    ),
    recencyShare: shareSlices([
      {
        key: "24h",
        label: "Last 24 hours",
        value: recencyCounts["Last 24 hours"],
        tone: "success",
      },
      {
        key: "7d",
        label: "2 to 7 days",
        value: recencyCounts["2 to 7 days"],
        tone: "brand",
      },
      {
        key: "30d",
        label: "8 to 30 days",
        value: recencyCounts["8 to 30 days"],
        tone: "warning",
      },
      {
        key: "older",
        label: "Older",
        value: recencyCounts.Older,
        tone: "muted",
      },
    ]),
    roleShare: shareSlices([
      { key: "admin", label: "Admins", value: admins, tone: "warning" },
      {
        key: "customer",
        label: "Customer",
        value: users.length - admins,
        tone: "muted",
      },
    ]),
    week: {
      signups: compareTrailingWindows(signups60, 7),
      waitlist: compareTrailingWindows(waitlist60, 7),
      confirmed: compareTrailingWindows(confirmed60, 7),
      paidSignups: compareTrailingWindows(paidSignups60, 7),
    },
    month: {
      signups: compareTrailingWindows(signups60, 30),
      waitlist: compareTrailingWindows(waitlist60, 30),
      paidSignups: compareTrailingWindows(paidSignups60, 30),
    },
  };
}
