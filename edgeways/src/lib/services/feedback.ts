/**
 * Local feedback / bug-report inbox. Submissions stay on-device; the UI
 * can also open a mailto so the user can send a copy to the maintainer.
 */
import "server-only";
import { desc, eq, isNull } from "drizzle-orm";
import { db, feedbackReports, type FeedbackReportRow } from "@/lib/db";
import {
  type FeedbackDiagnostics,
  type FeedbackKind,
  isFeedbackKind,
} from "@/lib/feedback/types";

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

function parseDiagnostics(raw: string): FeedbackDiagnostics {
  try {
    const parsed = JSON.parse(raw) as Partial<FeedbackDiagnostics>;
    return {
      appVersion: typeof parsed.appVersion === "string" ? parsed.appVersion : "unknown",
      userAgent: typeof parsed.userAgent === "string" ? parsed.userAgent : "unknown",
      href: typeof parsed.href === "string" ? parsed.href : "",
      timezone: typeof parsed.timezone === "string" ? parsed.timezone : "unknown",
    };
  } catch {
    return {
      appVersion: "unknown",
      userAgent: "unknown",
      href: "",
      timezone: "unknown",
    };
  }
}

function toListItem(row: FeedbackReportRow): FeedbackListItem {
  const kind = isFeedbackKind(row.kind) ? row.kind : "other";
  return {
    id: row.id,
    kind,
    summary: row.summary,
    details: row.details,
    replyEmail: row.replyEmail,
    diagnostics: parseDiagnostics(row.diagnosticsJson),
    createdAt: row.createdAt,
    linearIssueId: row.linearIssueId,
  };
}

export function createFeedbackReport(
  input: CreateFeedbackInput,
  now = Date.now()
): FeedbackListItem {
  if (!isFeedbackKind(input.kind)) throw new Error("Invalid feedback kind");
  const summary = input.summary.trim();
  const details = input.details.trim();
  if (!summary) throw new Error("Summary is required");
  if (!details) throw new Error("Details are required");

  const reply = input.replyEmail?.trim() || null;
  const row = db
    .insert(feedbackReports)
    .values({
      kind: input.kind,
      summary,
      details,
      replyEmail: reply,
      diagnosticsJson: JSON.stringify(input.diagnostics),
      createdAt: now,
    })
    .returning()
    .get();

  return toListItem(row);
}

export function listFeedbackReports(limit = 20): FeedbackListItem[] {
  const capped = Math.min(Math.max(1, Math.floor(limit)), 100);
  const rows = db
    .select()
    .from(feedbackReports)
    .orderBy(desc(feedbackReports.createdAt))
    .limit(capped)
    .all();
  return rows.map(toListItem);
}

/** Reports not yet filed to Linear (idempotency key is linear_issue_id). */
export function listUntriagedFeedbackReports(): FeedbackListItem[] {
  const rows = db
    .select()
    .from(feedbackReports)
    .where(isNull(feedbackReports.linearIssueId))
    .orderBy(feedbackReports.createdAt)
    .all();
  return rows.map(toListItem);
}

/** Record the Linear issue a report was filed as, so it is never filed twice. */
export function markFeedbackReportFiled(id: number, linearIssueId: string): void {
  const issue = linearIssueId.trim();
  if (!issue) throw new Error("Linear issue id is required");
  db.update(feedbackReports)
    .set({ linearIssueId: issue })
    .where(eq(feedbackReports.id, id))
    .run();
}
