/**
 * Owner pings when someone creates an account or becomes a customer.
 * Same Resend + Gmail rule as waitlist/feedback: do not send To Zoho
 * aliases (554 ContentRejected). Recipients: SIGNUP_NOTIFY_TO, then
 * FEEDBACK_NOTIFY_TO, then WAITLIST_NOTIFY_TO.
 */
import "server-only";
import { isBootstrapAdminEmail } from "@/lib/admin/emails";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ownerGrowthNotifyRecipients(
  env: Record<string, string | undefined> = process.env
): string[] {
  const raw =
    env.SIGNUP_NOTIFY_TO?.trim() ||
    env.FEEDBACK_NOTIFY_TO?.trim() ||
    env.WAITLIST_NOTIFY_TO?.trim() ||
    "";
  return raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0 && EMAIL_RE.test(part));
}

export function shouldNotifyNewUser(input: {
  isNew: boolean;
  email?: string | null;
}): boolean {
  if (!input.isNew) return false;
  return !isBootstrapAdminEmail(input.email);
}

export function shouldNotifyPaidInvoice(input: {
  amountPaid: number;
  email?: string | null;
}): boolean {
  if (input.amountPaid <= 0) return false;
  return !isBootstrapAdminEmail(input.email);
}

export function shouldNotifyCustomer(input: { email?: string | null }): boolean {
  return !isBootstrapAdminEmail(input.email);
}

export type OwnerGrowthCustomerKind = "trial" | "subscription";

function displayEmail(email?: string | null): string {
  const trimmed = email?.trim();
  return trimmed ? trimmed : "(no email)";
}

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://edgeways.app";
}

export function buildNewUserNotifyEmail(input: {
  email?: string | null;
  clerkUserId: string;
}): { subject: string; text: string } {
  const email = displayEmail(input.email);
  return {
    subject: `New user: ${email}`,
    text: [
      "Someone created an Edgeways account.",
      "",
      `Email: ${email}`,
      `Clerk: ${input.clerkUserId}`,
      `When: ${new Date().toISOString()}`,
      "",
      `Users: ${siteOrigin()}/admin/users`,
    ].join("\n"),
  };
}

export function buildNewCustomerNotifyEmail(input: {
  kind: OwnerGrowthCustomerKind;
  email?: string | null;
  plan?: string | null;
  status?: string | null;
  subscriptionId?: string | null;
}): { subject: string; text: string } {
  const email = displayEmail(input.email);
  const noun = input.kind === "trial" ? "trial" : "customer";
  return {
    subject: `New ${noun}: ${email}`,
    text: [
      input.kind === "trial"
        ? "Someone started an Edgeways trial."
        : "Someone subscribed to Edgeways.",
      "",
      `Email: ${email}`,
      `Plan: ${input.plan?.trim() || "unknown"}`,
      `Status: ${input.status?.trim() || "unknown"}`,
      input.subscriptionId
        ? `Subscription: ${input.subscriptionId}`
        : null,
      `When: ${new Date().toISOString()}`,
      "",
      `Subscribers: ${siteOrigin()}/admin/subscribers`,
    ]
      .filter((line): line is string => line != null)
      .join("\n"),
  };
}

export function buildPaidInvoiceNotifyEmail(input: {
  email?: string | null;
  amountPaid: number;
  currency?: string | null;
  invoiceId?: string | null;
}): { subject: string; text: string } {
  const email = displayEmail(input.email);
  const amount = formatMoney(input.amountPaid, input.currency);
  return {
    subject: `Paid ${amount}: ${email}`,
    text: [
      "Edgeways received a payment.",
      "",
      `Email: ${email}`,
      `Amount: ${amount}`,
      input.invoiceId ? `Invoice: ${input.invoiceId}` : null,
      `When: ${new Date().toISOString()}`,
      "",
      `Payments: ${siteOrigin()}/admin/payments`,
    ]
      .filter((line): line is string => line != null)
      .join("\n"),
  };
}

function formatMoney(amountMinor: number, currency?: string | null): string {
  const code = (currency ?? "gbp").trim().toLowerCase();
  const major = (amountMinor / 100).toFixed(2);
  if (code === "gbp") return `£${major}`;
  return `${major} ${code.toUpperCase()}`;
}

function resendFrom(): string {
  return process.env.RESEND_FROM?.trim() || "Edgeways <hello@edgeways.app>";
}

async function sendOwnerGrowthEmail(mail: {
  subject: string;
  text: string;
}): Promise<{ sent: boolean; skippedReason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = ownerGrowthNotifyRecipients();
  if (!apiKey) {
    console.info("[owner-growth] RESEND_API_KEY unset. Owner notify skipped.");
    return { sent: false, skippedReason: "resend_unconfigured" };
  }
  if (to.length === 0) {
    console.info(
      "[owner-growth] SIGNUP_NOTIFY_TO / FEEDBACK_NOTIFY_TO / WAITLIST_NOTIFY_TO unset. Owner notify skipped."
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
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[owner-growth] Owner notify failed (${res.status}): ${body.slice(0, 300)}`
      );
      return { sent: false, skippedReason: "resend_error" };
    }
    return { sent: true };
  } catch (err) {
    console.error("[owner-growth] Owner notify request failed:", err);
    return { sent: false, skippedReason: "resend_error" };
  }
}

export async function notifyOwnerOfNewUser(input: {
  email?: string | null;
  clerkUserId: string;
}): Promise<{ sent: boolean; skippedReason?: string }> {
  if (!shouldNotifyNewUser({ isNew: true, email: input.email })) {
    return { sent: false, skippedReason: "skipped" };
  }
  return sendOwnerGrowthEmail(buildNewUserNotifyEmail(input));
}

export async function notifyOwnerOfNewCustomer(input: {
  kind: OwnerGrowthCustomerKind;
  email?: string | null;
  plan?: string | null;
  status?: string | null;
  subscriptionId?: string | null;
}): Promise<{ sent: boolean; skippedReason?: string }> {
  if (!shouldNotifyCustomer({ email: input.email })) {
    return { sent: false, skippedReason: "skipped" };
  }
  return sendOwnerGrowthEmail(buildNewCustomerNotifyEmail(input));
}

export async function notifyOwnerOfPaidInvoice(input: {
  email?: string | null;
  amountPaid: number;
  currency?: string | null;
  invoiceId?: string | null;
}): Promise<{ sent: boolean; skippedReason?: string }> {
  if (!shouldNotifyPaidInvoice(input)) {
    return { sent: false, skippedReason: "skipped" };
  }
  return sendOwnerGrowthEmail(buildPaidInvoiceNotifyEmail(input));
}
