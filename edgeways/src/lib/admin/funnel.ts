import {
  shareSlices,
  type ShareSlice,
} from "@/lib/admin/series";
import {
  ONBOARDING_HEARD,
  type OnboardingHeardId,
} from "@/lib/onboarding-profile";
import type { AdminUserRow } from "@/lib/services/app-users";
import type { WaitlistRow } from "@/lib/services/waitlist-store";

export type WaitlistFunnel = {
  joined: number;
  confirmed: number;
  paid: number;
};

/**
 * Joined → confirmed → paid. `joined` is every waitlist row; `confirmed`
 * excludes unsubscribed; `paid` is waitlist emails that reached Core/Edge.
 * Each stage is a subset of the one before, so the bars read as a funnel.
 */
export function buildWaitlistFunnel(
  waitlist: WaitlistRow[],
  users: AdminUserRow[]
): WaitlistFunnel {
  const joined = waitlist.length;
  const confirmed = waitlist.filter(
    (row) => row.confirmedAt && !row.unsubscribedAt
  ).length;
  const paidEmails = new Set(
    users
      .filter((user) => user.plan === "core" || user.plan === "edge")
      .map((user) => user.email?.toLowerCase())
      .filter((email): email is string => Boolean(email))
  );
  const paid = waitlist.filter(
    (row) => row.confirmedAt && paidEmails.has(row.email.toLowerCase())
  ).length;
  return { joined, confirmed, paid };
}

const HEARD_LABEL = new Map<string, string>(
  ONBOARDING_HEARD.map((row) => [row.id, row.label])
);

const HEARD_TONES = [
  "brand",
  "edge",
  "success",
  "warning",
  "profit",
  "destructive",
  "muted",
] as const;

/**
 * Donut of onboardingProfile.attribution across accounts that answered.
 * "skipped" and missing profiles are left out so the chart only shows real
 * answers; "other" folds in attributionOther free text.
 */
export function buildAttributionShare(users: AdminUserRow[]): ShareSlice[] {
  const counts = new Map<string, number>();
  for (const user of users) {
    const attribution = user.onboardingProfile?.attribution;
    if (!attribution || attribution === "skipped") continue;
    counts.set(attribution, (counts.get(attribution) ?? 0) + 1);
  }
  const items = [...counts.entries()]
    .map(([id, value]) => ({
      key: id,
      label: HEARD_LABEL.get(id as OnboardingHeardId) ?? "Other",
      value,
    }))
    .sort((a, b) => b.value - a.value);
  return shareSlices(
    items.map((item, index) => ({
      ...item,
      tone: HEARD_TONES[index % HEARD_TONES.length] ?? "muted",
    }))
  );
}
