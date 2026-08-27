import type { AdminUserRow } from "@/lib/services/app-users";
import type { FeedMonitor } from "@/lib/admin/feeds";
import type { StripeOverview } from "@/lib/admin/stripe-overview";
import type { MaintenanceBanner } from "@/lib/admin/operator-settings";
import type { FeedbackListItem } from "@/lib/feedback/types";

export type AttentionTone = "warning" | "destructive";

export type AttentionItem = {
  key: string;
  label: string;
  value: string;
  sub: string;
  href: string;
  tone: AttentionTone;
};

const TRIAL_ENDING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

export function countTrialsEnding(
  users: AdminUserRow[],
  now: number = Date.now()
): number {
  return users.filter(
    (user) =>
      user.trialEndsAt != null &&
      user.trialEndsAt > now &&
      user.trialEndsAt <= now + TRIAL_ENDING_WINDOW_MS
  ).length;
}

export function countFeedLanesAtRisk(monitor: FeedMonitor): number {
  return [monitor.football, monitor.racing].filter(
    (lane) => lane.state === "warning" || lane.state === "critical"
  ).length;
}

export function countFailedPayments(stripe: StripeOverview): number {
  return stripe.pastDue + stripe.failed.length;
}

/**
 * Tiles for the Overview attention strip. Only items with something to act
 * on are returned; a quiet platform renders no strip at all.
 */
export function buildAttentionItems(input: {
  stripe: StripeOverview;
  users: AdminUserRow[];
  feedMonitor: FeedMonitor;
  banner: MaintenanceBanner;
  untriaged: FeedbackListItem[];
  now?: number;
}): AttentionItem[] {
  const items: AttentionItem[] = [];

  const failed = countFailedPayments(input.stripe);
  if (failed > 0) {
    items.push({
      key: "payments",
      label: "Failed payments",
      value: String(failed),
      sub: "Past due or uncollected",
      href: "/admin/payments",
      tone: "destructive",
    });
  }

  const trials = countTrialsEnding(input.users, input.now);
  if (trials > 0) {
    items.push({
      key: "trials",
      label: "Trials ending",
      value: String(trials),
      sub: "Within 7 days",
      href: "/admin/subscribers",
      tone: "warning",
    });
  }

  const lanes = countFeedLanesAtRisk(input.feedMonitor);
  if (lanes > 0) {
    items.push({
      key: "feeds",
      label: "Feed lanes",
      value: String(lanes),
      sub: "Watch or upgrade",
      href: "/admin/feeds",
      tone: "warning",
    });
  }

  if (input.banner.enabled) {
    items.push({
      key: "banner",
      label: "Maintenance",
      value: "On",
      sub: "Banner is live",
      href: "/admin/releases",
      tone: "warning",
    });
  }

  if (input.untriaged.length > 0) {
    items.push({
      key: "feedback",
      label: "Feedback",
      value: String(input.untriaged.length),
      sub: `Unfiled ${plural(input.untriaged.length, "report")}`,
      href: "/admin/inbox",
      tone: "warning",
    });
  }

  return items;
}
