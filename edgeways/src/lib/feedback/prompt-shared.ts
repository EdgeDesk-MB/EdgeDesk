/**
 * Beta feedback prompt rules. Client-safe pure logic for the slim desk
 * banner that nudges early users towards /feedback. Dismissal and
 * post-submit suppression live in localStorage; submissions themselves
 * land in the hosted inbox (Neon) and PostHog via the feedback API.
 */

export const FEEDBACK_PROMPT_DISMISS_KEY = "ew_beta_feedback_dismissed_at";
export const FEEDBACK_SUBMITTED_KEY = "ew_beta_feedback_submitted_at";

/** A dismissed banner stays hidden for a fortnight. */
export const FEEDBACK_PROMPT_DISMISS_MS = 14 * 24 * 60 * 60 * 1000;
/** Sending feedback hides the prompt for a month. */
export const FEEDBACK_SUBMITTED_SUPPRESS_MS = 30 * 24 * 60 * 60 * 1000;

export function readPromptTimestamp(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function withinWindow(now: number, at: number | null, windowMs: number): boolean {
  return at != null && now - at < windowMs;
}

export function betaFeedbackPromptVisible(input: {
  pathname: string;
  signedIn: boolean;
  demoActive: boolean;
  dismissedAt: number | null;
  submittedAt: number | null;
  now: number;
}): boolean {
  if (!input.signedIn || input.demoActive) return false;
  if (input.pathname.startsWith("/feedback")) return false;
  if (withinWindow(input.now, input.dismissedAt, FEEDBACK_PROMPT_DISMISS_MS)) {
    return false;
  }
  if (withinWindow(input.now, input.submittedAt, FEEDBACK_SUBMITTED_SUPPRESS_MS)) {
    return false;
  }
  return true;
}
