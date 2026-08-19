/**
 * Client-safe feedback kinds, labels, and report formatting.
 * Submissions go to the hosted inbox (Neon) and email notify, then Linear later.
 */

export const FEEDBACK_KINDS = ["bug", "idea", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = {
  bug: "Bug",
  idea: "Idea",
  other: "Other",
};

export type FeedbackDiagnostics = {
  appVersion: string;
  userAgent: string;
  href: string;
  timezone: string;
  signedInEmail?: string | null;
};

export type CreateFeedbackInput = {
  kind: FeedbackKind;
  summary: string;
  details: string;
  replyEmail?: string | null;
  diagnostics: FeedbackDiagnostics;
};

export type FeedbackListItem = {
  id: number;
  kind: FeedbackKind;
  summary: string;
  details: string;
  replyEmail: string | null;
  diagnostics: FeedbackDiagnostics;
  createdAt: number;
  linearIssueId: string | null;
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

export function parseDiagnostics(raw: string): FeedbackDiagnostics {
  try {
    const parsed = JSON.parse(raw) as Partial<FeedbackDiagnostics>;
    return {
      appVersion: typeof parsed.appVersion === "string" ? parsed.appVersion : "unknown",
      userAgent: typeof parsed.userAgent === "string" ? parsed.userAgent : "unknown",
      href: typeof parsed.href === "string" ? parsed.href : "",
      timezone: typeof parsed.timezone === "string" ? parsed.timezone : "unknown",
      signedInEmail:
        typeof parsed.signedInEmail === "string" && parsed.signedInEmail.trim()
          ? parsed.signedInEmail.trim()
          : null,
    };
  } catch {
    return {
      appVersion: "unknown",
      userAgent: "unknown",
      href: "",
      timezone: "unknown",
      signedInEmail: null,
    };
  }
}

export function toFeedbackListItem(row: {
  id: number;
  kind: string;
  summary: string;
  details: string;
  replyEmail: string | null;
  diagnosticsJson: string;
  createdAt: number;
  linearIssueId: string | null;
}): FeedbackListItem {
  return {
    id: row.id,
    kind: isFeedbackKind(row.kind) ? row.kind : "other",
    summary: row.summary,
    details: row.details,
    replyEmail: row.replyEmail,
    diagnostics: parseDiagnostics(row.diagnosticsJson),
    createdAt: Number(row.createdAt),
    linearIssueId: row.linearIssueId,
  };
}
