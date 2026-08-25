/**
 * Session draft for /setup so a refresh or Checkout tab-return keeps answers.
 * Keyed by Clerk user. Cleared on a successful Finish.
 */

import {
  ONBOARDING_EXPERIENCE,
  ONBOARDING_HEARD,
  ONBOARDING_WHY,
  type OnboardingExperienceId,
  type OnboardingHeardId,
  type OnboardingWhyId,
} from "@/lib/onboarding-profile";

export const SETUP_DRAFT_KEY = "ew-setup-draft";

export type SetupDraftBookie = { name: string; balance: string };

export type SetupDraft = {
  v: 1;
  stepId: string;
  bankName: string;
  bankBalance: string;
  bookies: SetupDraftBookie[];
  stake: string;
  defaultBookie: string;
  defaultExchangeName: string;
  defaultSport: string;
  appearance: "light" | "dark" | null;
  experience: OnboardingExperienceId | null;
  whyHere: OnboardingWhyId[];
  attribution: OnboardingHeardId | "skipped" | null;
  attributionOther: string;
  monthlyTarget: number;
};

const EXPERIENCE_IDS = new Set<string>(ONBOARDING_EXPERIENCE.map((row) => row.id));
const WHY_IDS = new Set<string>(ONBOARDING_WHY.map((row) => row.id));
const HEARD_IDS = new Set<string>(ONBOARDING_HEARD.map((row) => row.id));

export function setupDraftStorageKey(
  userId?: string | null,
  variant: "page" | "dialog" = "page"
): string {
  const id = userId?.trim();
  return id ? `${SETUP_DRAFT_KEY}:${variant}:${id}` : `${SETUP_DRAFT_KEY}:${variant}`;
}

function asString(value: unknown, max = 200): string {
  if (typeof value !== "string") return "";
  return value.slice(0, max);
}

function parseBookies(raw: unknown): SetupDraftBookie[] {
  if (!Array.isArray(raw) || raw.length === 0) return [{ name: "", balance: "" }];
  const rows = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      return { name: asString(row.name, 80), balance: asString(row.balance, 24) };
    })
    .filter((row): row is SetupDraftBookie => row != null);
  return rows.length > 0 ? rows : [{ name: "", balance: "" }];
}

export function parseSetupDraft(raw: unknown): SetupDraft | null {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.v !== 1) return null;
  const experience =
    row.experience == null
      ? null
      : EXPERIENCE_IDS.has(String(row.experience))
        ? (row.experience as OnboardingExperienceId)
        : null;
  const whyHere = Array.isArray(row.whyHere)
    ? row.whyHere
        .map((id) => String(id))
        .filter((id): id is OnboardingWhyId => WHY_IDS.has(id))
    : [];
  const attribution =
    row.attribution === "skipped" || HEARD_IDS.has(String(row.attribution))
      ? (row.attribution as OnboardingHeardId | "skipped")
      : row.attribution == null
        ? null
        : null;
  const appearance =
    row.appearance === "light" || row.appearance === "dark" ? row.appearance : null;
  const monthly =
    typeof row.monthlyTarget === "number" && Number.isFinite(row.monthlyTarget)
      ? Math.max(0, row.monthlyTarget)
      : 0;
  return {
    v: 1,
    stepId: asString(row.stepId, 40),
    bankName: asString(row.bankName, 80),
    bankBalance: asString(row.bankBalance, 24),
    bookies: parseBookies(row.bookies),
    stake: asString(row.stake, 24) || "10",
    defaultBookie: asString(row.defaultBookie, 80),
    defaultExchangeName: asString(row.defaultExchangeName, 80),
    defaultSport: asString(row.defaultSport, 40),
    appearance,
    experience,
    whyHere,
    attribution,
    attributionOther: asString(row.attributionOther, 200),
    monthlyTarget: monthly,
  };
}

export function readSetupDraft(
  userId?: string | null,
  variant: "page" | "dialog" = "page"
): SetupDraft | null {
  try {
    return parseSetupDraft(sessionStorage.getItem(setupDraftStorageKey(userId, variant)));
  } catch {
    return null;
  }
}

export function writeSetupDraft(
  draft: SetupDraft,
  userId?: string | null,
  variant: "page" | "dialog" = "page"
) {
  try {
    sessionStorage.setItem(setupDraftStorageKey(userId, variant), JSON.stringify(draft));
  } catch {
    /* private mode */
  }
}

export function clearSetupDraft(
  userId?: string | null,
  variant: "page" | "dialog" = "page"
) {
  try {
    sessionStorage.removeItem(setupDraftStorageKey(userId, variant));
  } catch {
    /* ignore */
  }
}

export function setupDraftIsDirty(draft: Pick<
  SetupDraft,
  | "bankName"
  | "bankBalance"
  | "bookies"
  | "experience"
  | "whyHere"
  | "attribution"
>): boolean {
  if (draft.experience) return true;
  if (draft.whyHere.length > 0) return true;
  if (draft.attribution && draft.attribution !== "skipped") return true;
  if (draft.bankName.trim() || draft.bankBalance.trim()) return true;
  return draft.bookies.some((row) => row.name.trim() || row.balance.trim());
}

export function isSetupConflictError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("409:");
}

export function setupSaveErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (text.startsWith("409:")) return "That account is already on the desk.";
  if (/^\d{3}:/.test(text)) return "Could not save this step. Try again.";
  return text;
}

export function findExistingSetupAccount(
  accounts: readonly { id: number; name: string; type: string }[],
  type: "bank" | "bookie",
  name: string
): number | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  return (
    accounts.find(
      (row) => row.type === type && row.name.trim().toLowerCase() === needle
    )?.id ?? null
  );
}
