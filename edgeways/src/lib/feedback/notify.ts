/**
 * Owner notify for in-app feedback. Resend From is hello@edgeways.app.
 * Do not send To Zoho aliases (sam@ / hello@ / support@): same-domain Resend
 * mail is rejected with 554 ContentRejected. Use FEEDBACK_NOTIFY_TO, or fall
 * back to WAITLIST_NOTIFY_TO (Gmail).
 */
import "server-only";
import type { FeedbackCustomerContext } from "@/lib/feedback/customer-context";
import {
  FEEDBACK_KIND_LABELS,
  formatFeedbackSubject,
  type CreateFeedbackInput,
  type FeedbackKind,
} from "@/lib/feedback/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function feedbackNotifyRecipients(
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const raw = env.FEEDBACK_NOTIFY_TO?.trim() || env.WAITLIST_NOTIFY_TO?.trim() || "";
  return raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0 && EMAIL_RE.test(part));
}

function resendFrom(): string {
  return process.env.RESEND_FROM?.trim() || "Edgeways <hello@edgeways.app>";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function field(
  label: string,
  value: string | null | undefined
): { text: string; html: string } | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return {
    text: `${label}: ${trimmed}`,
    html: `<p style="margin:0 0 8px;font-size:14px;line-height:1.45;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(trimmed)}</p>`,
  };
}

export function buildFeedbackNotifyEmail(input: {
  kind: FeedbackKind;
  summary: string;
  details: string;
  replyEmail?: string | null;
  signedInEmail?: string | null;
  reportId?: number | null;
  diagnostics: CreateFeedbackInput["diagnostics"];
  customer?: FeedbackCustomerContext | null;
}): { subject: string; text: string; html: string; replyTo: string | null } {
  const subject = formatFeedbackSubject(input.kind, input.summary);
  const reply = input.replyEmail?.trim() || null;
  const customerEmail =
    input.customer?.email?.trim() ||
    input.signedInEmail?.trim() ||
    reply ||
    "Not signed in";
  const signedUp =
    input.customer?.signedUpOn && input.customer.accountAge
      ? `${input.customer.signedUpOn} (${input.customer.accountAge})`
      : input.customer?.signedUpOn ||
        (input.customer?.accountAge ? input.customer.accountAge : null);

  const rows = [
    field("Customer", customerEmail),
    field("Subscription", input.customer?.subscription ?? "Unknown"),
    field("Signed up", signedUp),
    field("Subscription started", input.customer?.subscriptionStartedOn),
    field("Trial ends", input.customer?.trialEndsOn),
    field("Experience", input.customer?.experience),
    field("Heard from", input.customer?.heardFrom),
    field("Desk", input.customer?.deskSummary),
    field("Kind", FEEDBACK_KIND_LABELS[input.kind]),
    field("Summary", input.summary.trim()),
  ].filter((row): row is { text: string; html: string } => row != null);

  const details = input.details.trim() || "(none)";
  const footer = [
    reply && reply !== customerEmail ? field("Reply-to", reply) : null,
    input.reportId != null ? field("Inbox row", `#${input.reportId}`) : null,
    field("App", input.diagnostics.appVersion),
    field("Timezone", input.diagnostics.timezone),
    field("User agent", input.diagnostics.userAgent),
  ].filter((row): row is { text: string; html: string } => row != null);

  const text = [
    ...rows.map((row) => row.text),
    "",
    "Details:",
    details,
    "",
    ...footer.map((row) => row.text),
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#f4f4f4;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;">
    <tr>
      <td style="padding:24px 24px 8px;">
        ${rows.map((row) => row.html).join("\n        ")}
        <p style="margin:16px 0 8px;font-size:14px;line-height:1.45;"><strong>Details:</strong></p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(details)}</p>
        <hr style="border:none;border-top:1px solid #ececec;margin:8px 0 16px;" />
        ${footer.map((row) => row.html).join("\n        ")}
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html, replyTo: reply };
}

export async function notifyFeedbackInbox(input: {
  kind: FeedbackKind;
  summary: string;
  details: string;
  replyEmail?: string | null;
  signedInEmail?: string | null;
  reportId?: number | null;
  diagnostics: CreateFeedbackInput["diagnostics"];
  customer?: FeedbackCustomerContext | null;
}): Promise<{ sent: boolean; skippedReason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = feedbackNotifyRecipients();
  const mail = buildFeedbackNotifyEmail(input);

  if (!apiKey) {
    console.info("[feedback] RESEND_API_KEY unset. Owner notify skipped.");
    return { sent: false, skippedReason: "resend_unconfigured" };
  }
  if (to.length === 0) {
    console.info(
      "[feedback] FEEDBACK_NOTIFY_TO / WAITLIST_NOTIFY_TO unset. Owner notify skipped."
    );
    return { sent: false, skippedReason: "notify_unconfigured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom(),
        to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[feedback] Owner notify failed (${res.status}): ${body.slice(0, 300)}`);
      return { sent: false, skippedReason: "resend_error" };
    }
    return { sent: true };
  } catch (err) {
    console.error("[feedback] Owner notify request failed:", err);
    return { sent: false, skippedReason: "resend_error" };
  }
}
