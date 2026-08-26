/**
 * EDGE-6: dunning, customer-facing half. Stripe owns the retry cadence
 * (Dashboard → Settings → Billing → Subscriptions: Smart Retries, final
 * action = cancel subscription); when retries exhaust, the existing
 * customer.subscription.deleted handler drops the entitlement — that
 * sequence is exactly what Terms 4.7 describes ("we may retry and then
 * suspend paid features").
 *
 * This module covers what Stripe cannot: on invoice.payment_failed we alert
 * the customer's desk (inbox + push, EDGE-110) and email them; on recovery
 * (invoice.paid) the alert goes quiet. All failures are logged, never
 * thrown — a dunning hiccup must not 500 the webhook and stall entitlement
 * retries.
 */
import "server-only";

import type Stripe from "stripe";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { findAppUserByStripeCustomerId } from "@/lib/services/app-users";
import type { IncomingAlert } from "@/lib/services/alerts-inbox";

export const PAYMENT_FAILED_KIND = "payment_failed";

/** One inbox row per subscription: Stripe retries update it, never stack. */
export function paymentFailedDedupe(subscriptionId: string): string {
  return `${PAYMENT_FAILED_KIND}:${subscriptionId}`;
}

/** Subscription id across Stripe API shapes (2025+ parent vs legacy field). */
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = (
    invoice as unknown as {
      parent?: {
        subscription_details?: { subscription?: string | { id: string } | null } | null;
      } | null;
    }
  ).parent;
  const fromParent = parent?.subscription_details?.subscription;
  if (typeof fromParent === "string") return fromParent;
  if (fromParent && typeof fromParent === "object") return fromParent.id;
  const legacy = (invoice as unknown as { subscription?: string | { id: string } | null })
    .subscription;
  if (typeof legacy === "string") return legacy;
  if (legacy && typeof legacy === "object") return legacy.id;
  return null;
}

function formatGbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

function nextAttemptLine(invoice: Stripe.Invoice): string {
  const at = (invoice as unknown as { next_payment_attempt?: number | null })
    .next_payment_attempt;
  if (!at) return "We'll retry the payment automatically.";
  const when = new Date(at * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
  });
  return `We'll retry automatically on ${when}.`;
}

export function paymentFailedAlert(invoice: Stripe.Invoice): IncomingAlert {
  const subId = invoiceSubscriptionId(invoice);
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  return {
    key: paymentFailedDedupe(subId ?? customerId ?? invoice.id),
    kind: PAYMENT_FAILED_KIND,
    title: `⚠️ Payment failed · ${formatGbp(invoice.amount_due)}`,
    body: `${nextAttemptLine(invoice)} Update your card to keep your plan.`,
    href: "/settings",
  };
}

export function buildPaymentFailedEmail(input: {
  invoice: Stripe.Invoice;
  settingsUrl: string;
}): { subject: string; text: string; html: string } {
  const amount = formatGbp(input.invoice.amount_due);
  const retry = nextAttemptLine(input.invoice);
  const subject = "Your Edgeways payment didn't go through";
  const text = [
    `Your renewal payment of ${amount} didn't go through.`,
    retry,
    "",
    "To keep your plan without interruption, update your card here:",
    input.settingsUrl,
    "",
    "If you've already updated it, there's nothing to do — the retry will use the new card.",
    "",
    "— Edgeways",
  ].join("\n");
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><title>${subject}</title></head>
<body style="margin:0;padding:24px;background:#f4f4f4;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;">
    <tr>
      <td style="padding:24px;">
        <p style="margin:0 0 12px;font-size:15px;line-height:1.5;">Your renewal payment of <strong>${amount}</strong> didn't go through.</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#444444;">${retry}</p>
        <p style="margin:0 0 16px;"><a href="${input.settingsUrl}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-size:14px;padding:10px 18px;border-radius:8px;">Update your card</a></p>
        <p style="margin:0;font-size:13px;line-height:1.5;color:#666666;">If you've already updated it, there's nothing to do — the retry will use the new card.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { subject, text, html };
}

async function emailPaymentFailed(
  email: string,
  invoice: Stripe.Invoice
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://edgeways.app";
  const mail = buildPaymentFailedEmail({
    invoice,
    settingsUrl: `${baseUrl}/settings`,
  });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM?.trim() || "Edgeways <hello@edgeways.app>",
      to: [email],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[dunning] email failed (${res.status}): ${body.slice(0, 300)}`);
  }
}

/** invoice.payment_failed: inbox + push + email the subscription owner. */
export async function notifyPaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  try {
    const customerId =
      typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;
    const owner = await findAppUserByStripeCustomerId(customerId);
    if (!owner) return;

    const alert = paymentFailedAlert(invoice);
    if (isNeonDesk()) {
      const [{ recordNeonAlertsForUser }, { sendPushToUser }] = await Promise.all([
        import("@/lib/db/neon-alerts-inbox"),
        import("@/lib/services/push"),
      ]);
      const recorded = await recordNeonAlertsForUser(owner.clerkUserId, [alert]);
      if (recorded > 0) {
        await sendPushToUser(owner.clerkUserId, alert).catch(() => {});
      }
    } else {
      const { recordAlerts } = await import("@/lib/services/alerts-inbox");
      const { sendPush } = await import("@/lib/services/push");
      if (recordAlerts([alert]) > 0) {
        void sendPush(alert).catch(() => {});
      }
    }

    if (owner.email) {
      await emailPaymentFailed(owner.email, invoice);
    }
  } catch (error) {
    console.error("[dunning] payment_failed notify", error);
  }
}

/** invoice.paid: a recovered payment quiets the failure prompt. */
export async function clearPaymentFailedAlert(
  invoice: Stripe.Invoice
): Promise<void> {
  try {
    const customerId =
      typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
    if (!customerId) return;
    const owner = await findAppUserByStripeCustomerId(customerId);
    if (!owner) return;
    const key = paymentFailedAlert(invoice).key;
    if (isNeonDesk()) {
      const [{ markNeonReadByDedupeForUser }, { dismissPushForUser }] =
        await Promise.all([
          import("@/lib/db/neon-alerts-inbox"),
          import("@/lib/services/push"),
        ]);
      await markNeonReadByDedupeForUser(owner.clerkUserId, key);
      await dismissPushForUser(owner.clerkUserId, [key]).catch(() => {});
    } else {
      const { markReadByDedupe } = await import("@/lib/services/alerts-inbox");
      const { dismissPush } = await import("@/lib/services/push");
      markReadByDedupe(key);
      void dismissPush([key]).catch(() => {});
    }
  } catch (error) {
    console.error("[dunning] clear payment_failed alert", error);
  }
}
