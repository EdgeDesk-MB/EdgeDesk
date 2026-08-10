/**
 * Client-safe feedback kinds, labels, and report formatting.
 * Submissions are stored locally and optionally emailed via mailto.
 */

export const FEEDBACK_KINDS = ["bug", "idea", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = {
  bug: "Bug",
  idea: "Idea",
  other: "Other",
};

/** Inbox that receives "Send via email" reports. */
export const FEEDBACK_TO_EMAIL = "samhayter.design@gmail.com";

export type FeedbackDiagnostics = {
  appVersion: string;
  userAgent: string;
  href: string;
  timezone: string;
};

export type FeedbackDraft = {
  kind: FeedbackKind;
  summary: string;
  details: string;
  replyEmail?: string | null;
  diagnostics: FeedbackDiagnostics;
};

export function isFeedbackKind(value: unknown): value is FeedbackKind {
  return typeof value === "string" && (FEEDBACK_KINDS as readonly string[]).includes(value);
}

export function formatFeedbackSubject(kind: FeedbackKind, summary: string): string {
  const label = FEEDBACK_KIND_LABELS[kind];
  const trimmed = summary.trim().replace(/\s+/g, " ");
  const short = trimmed.length > 80 ? `${trimmed.slice(0, 77)}…` : trimmed;
  return `[Edgeways] ${label}: ${short}`;
}

/** Plain-text body for mailto / clipboard. */
export function formatFeedbackBody(draft: FeedbackDraft): string {
  const lines = [
    `Kind: ${FEEDBACK_KIND_LABELS[draft.kind]}`,
    `Summary: ${draft.summary.trim()}`,
    "",
    "Details:",
    draft.details.trim() || "(none)",
    "",
    "Diagnostics:",
    `App: ${draft.diagnostics.appVersion}`,
    `Page: ${draft.diagnostics.href}`,
    `Timezone: ${draft.diagnostics.timezone}`,
    `User agent: ${draft.diagnostics.userAgent}`,
  ];
  const reply = draft.replyEmail?.trim();
  if (reply) {
    lines.push(`Reply-to: ${reply}`);
  }
  return lines.join("\n");
}

export function buildFeedbackMailto(draft: FeedbackDraft): string {
  const subject = formatFeedbackSubject(draft.kind, draft.summary);
  const body = formatFeedbackBody(draft);
  const params = new URLSearchParams({ subject, body });
  return `mailto:${FEEDBACK_TO_EMAIL}?${params.toString()}`;
}
