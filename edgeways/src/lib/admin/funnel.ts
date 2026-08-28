import {
  shareSlices,
  type ShareSlice,
} from "@/lib/admin/series";
import type { PlanId } from "@/lib/entitlements/plans";
import {
  joinBritishList,
  ONBOARDING_HEARD,
  ONBOARDING_WHY,
  type OnboardingHeardId,
  type OnboardingProfile,
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

const EXPERIENCE_LABEL = new Map<string, string>([
  ["beginner", "New to matched betting"],
  ["spreadsheet", "Spreadsheets"],
  ["finder", "Offer finder"],
  ["long_time", "Long time"],
]);
const WHY_LABEL = new Map<string, string>(
  ONBOARDING_WHY.map((row) => [row.id, row.label])
);
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

export type OnboardingCompletion = {
  answered: number;
  pending: number;
  total: number;
};

export function buildOnboardingCompletion(
  users: AdminUserRow[]
): OnboardingCompletion {
  const answered = users.filter((user) => user.onboardingProfile).length;
  return {
    answered,
    pending: users.length - answered,
    total: users.length,
  };
}

export function buildOnboardingCompletionShare(
  users: AdminUserRow[]
): ShareSlice[] {
  const { answered, pending, total } = buildOnboardingCompletion(users);
  if (total === 0) return [];
  return shareSlices([
    { key: "answered", label: "Answered", value: answered, tone: "success" },
    { key: "pending", label: "Not yet", value: pending, tone: "muted" },
  ]);
}

/**
 * Donut of onboardingProfile.experience across accounts that finished setup.
 */
export function buildExperienceShare(users: AdminUserRow[]): ShareSlice[] {
  const counts = new Map<string, number>();
  for (const user of users) {
    const experience = user.onboardingProfile?.experience;
    if (!experience) continue;
    counts.set(experience, (counts.get(experience) ?? 0) + 1);
  }
  const items = [...counts.entries()]
    .map(([id, value]) => ({
      key: id,
      label: EXPERIENCE_LABEL.get(id) ?? id,
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

/**
 * Ranked counts of whyHere picks. Multi-select, so totals can exceed the
 * number of accounts that answered.
 */
export function buildWhyHereShare(users: AdminUserRow[]): ShareSlice[] {
  const counts = new Map<string, number>();
  for (const user of users) {
    const whyHere = user.onboardingProfile?.whyHere;
    if (!whyHere) continue;
    for (const id of whyHere) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const items = [...counts.entries()]
    .map(([id, value]) => ({
      key: id,
      label: WHY_LABEL.get(id) ?? id,
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

export type OnboardingAnswerRow = {
  clerkUserId: string;
  email: string | null;
  admin: boolean;
  plan: PlanId;
  experienceLabel: string;
  whyHereLabels: string[];
  attributionLabel: string;
  savedAt: number;
  profile: OnboardingProfile;
};

function attributionDisplay(profile: OnboardingProfile): string {
  if (profile.attribution === "skipped") return "Skipped";
  const label = HEARD_LABEL.get(profile.attribution) ?? "Other";
  if (profile.attribution === "other" && profile.attributionOther) {
    return `${label}: ${profile.attributionOther}`;
  }
  return label;
}

function experienceDisplay(profile: OnboardingProfile): string {
  return EXPERIENCE_LABEL.get(profile.experience) ?? profile.experience;
}

function whyHereDisplay(profile: OnboardingProfile): string[] {
  const labels = profile.whyHere.map((id) => WHY_LABEL.get(id) ?? id);
  if (profile.whyHereOther) labels.push(profile.whyHereOther);
  return labels;
}

export function onboardingProfileSummary(profile: OnboardingProfile): string {
  const why = joinBritishList(whyHereDisplay(profile));
  return `${experienceDisplay(profile)}. ${why}. ${attributionDisplay(profile)}.`;
}

export function buildOnboardingAnswerRows(
  users: AdminUserRow[]
): OnboardingAnswerRow[] {
  return users
    .filter((user): user is AdminUserRow & { onboardingProfile: OnboardingProfile } =>
      Boolean(user.onboardingProfile)
    )
    .map((user) => {
      const profile = user.onboardingProfile;
      return {
        clerkUserId: user.clerkUserId,
        email: user.email,
        admin: user.admin,
        plan: user.plan,
        experienceLabel: experienceDisplay(profile),
        whyHereLabels: whyHereDisplay(profile),
        attributionLabel: attributionDisplay(profile),
        savedAt: profile.savedAt,
        profile,
      };
    })
    .sort((a, b) => b.savedAt - a.savedAt);
}
