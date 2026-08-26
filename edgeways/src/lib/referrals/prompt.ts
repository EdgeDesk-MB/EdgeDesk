/** Homepage Refer a friend prompt. Dismiss is device-local, keyed by Clerk user. */

const DISMISSED_KEY = "edgeways:referral-prompt-dismissed";
const SNOOZED_KEY = "edgeways:referral-prompt-snoozed";

export const REFERRAL_PITCH =
  "They get 50% off their first paid month. You get £10 credit towards your bill when their first payment lands.";

export function referralPromptStorageKey(userId?: string | null): string {
  const id = userId?.trim();
  return id ? `${DISMISSED_KEY}:${id}` : DISMISSED_KEY;
}

export function referralPromptSnoozeKey(userId?: string | null): string {
  const id = userId?.trim();
  return id ? `${SNOOZED_KEY}:${id}` : SNOOZED_KEY;
}

function readFlag(storage: "local" | "session", key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const store = storage === "local" ? localStorage : sessionStorage;
    return store.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(storage: "local" | "session", key: string): void {
  if (typeof window === "undefined") return;
  try {
    const store = storage === "local" ? localStorage : sessionStorage;
    store.setItem(key, "1");
  } catch {
    /* private mode */
  }
}

export function isReferralPromptDismissed(userId?: string | null): boolean {
  if (typeof window === "undefined") return true;
  const key = referralPromptStorageKey(userId);
  if (readFlag("local", key)) return true;
  return readFlag("session", key);
}

export function markReferralPromptDismissed(userId?: string | null): void {
  const key = referralPromptStorageKey(userId);
  writeFlag("local", key);
  writeFlag("session", key);
}

export function isReferralPromptSnoozed(userId?: string | null): boolean {
  if (typeof window === "undefined") return true;
  return readFlag("session", referralPromptSnoozeKey(userId));
}

export function snoozeReferralPrompt(userId?: string | null): void {
  writeFlag("session", referralPromptSnoozeKey(userId));
}

export function isReferralPromptHidden(userId?: string | null): boolean {
  return isReferralPromptDismissed(userId) || isReferralPromptSnoozed(userId);
}

export function shouldOpenReferralPrompt(input: {
  pathname: string;
  signedIn: boolean;
  publicDemo: boolean;
  suppressed: boolean;
  hidden: boolean;
}): boolean {
  if (input.publicDemo) return false;
  if (!input.signedIn) return false;
  if (input.suppressed) return false;
  if (input.hidden) return false;
  return input.pathname === "/desk" || input.pathname === "/desk/";
}
