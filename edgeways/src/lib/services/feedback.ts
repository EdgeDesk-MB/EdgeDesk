/**
 * Product feedback inbox. Persist to the shared store (Neon, not the
 * user's desk), then email the owner. Linear filing stays a later step.
 */
import "server-only";
import { captureServerEvent } from "@/lib/analytics/server-capture";
import { getDeskActor } from "@/lib/db/desk-scope";
import { loadFeedbackCustomerContext } from "@/lib/feedback/customer-context";
import {
  createFeedbackReport,
  listFeedbackReports,
  listUntriagedFeedbackReports,
  markFeedbackReportFiled,
} from "@/lib/feedback/inbox-store";
import { notifyFeedbackInbox } from "@/lib/feedback/notify";
import type { CreateFeedbackInput, FeedbackListItem } from "@/lib/feedback/types";

export type { CreateFeedbackInput, FeedbackListItem };
export {
  createFeedbackReport,
  listFeedbackReports,
  listUntriagedFeedbackReports,
  markFeedbackReportFiled,
};

export async function submitFeedback(
  input: CreateFeedbackInput & { signedInEmail?: string | null }
): Promise<{ report: FeedbackListItem | null; emailed: boolean }> {
  const diagnostics = {
    ...input.diagnostics,
    signedInEmail: input.signedInEmail?.trim() || input.diagnostics.signedInEmail || null,
  };

  let report: FeedbackListItem | null = null;
  let persistError: unknown;
  try {
    report = await createFeedbackReport({
      kind: input.kind,
      summary: input.summary,
      details: input.details,
      replyEmail: input.replyEmail,
      diagnostics,
    });
  } catch (err) {
    persistError = err;
    console.error("[feedback] Persist failed:", err);
  }

  const actor = getDeskActor();
  const customer = await loadFeedbackCustomerContext({
    clerkUserId: actor.clerkUserId,
    email: input.signedInEmail ?? actor.email,
  });

  const notify = await notifyFeedbackInbox({
    kind: input.kind,
    summary: input.summary,
    details: input.details,
    replyEmail: input.replyEmail,
    signedInEmail: diagnostics.signedInEmail,
    reportId: report?.id ?? null,
    diagnostics,
    customer,
  });

  if (!report && !notify.sent) {
    throw persistError instanceof Error
      ? persistError
      : new Error("Could not send feedback");
  }

  // Mirror the submission into product analytics so responses can be
  // read next to usage. Best-effort, never blocks the caller.
  captureServerEvent(
    actor.clerkUserId ?? diagnostics.signedInEmail ?? "",
    "feedback_submitted",
    {
      kind: input.kind,
      has_reply_email: Boolean(input.replyEmail),
      report_id: report?.id ?? null,
      emailed: notify.sent,
    }
  );

  return { report, emailed: notify.sent };
}
