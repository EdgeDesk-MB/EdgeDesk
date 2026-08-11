/**
 * Launch waitlist (EDGE-26): single opt-in capture + branded thanks email.
 * List token powers unsubscribe (and legacy confirm links).
 */
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, waitlistSignups, type WaitlistSignupRow } from "@/lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BRAND = "#FFC71E";
const INK = "#111111";
const CTA_INK = "#222222";
/** Keep in sync with ResponsibleGamblingNote / BEGAMBLEAWARE_URL. */
const BEGAMBLEAWARE_URL = "https://www.begambleaware.org";
/** Canonical public site for waitlist email links. */
const LIVE_SITE_ORIGIN = "https://www.edgeways.app";

export function normaliseWaitlistEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidWaitlistEmail(email: string): boolean {
  return email.length <= 200 && EMAIL_RE.test(email);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newListToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Build branded HTML/text for the waitlist thanks email. */
export function buildWaitlistThanksEmail(input: {
  origin: string;
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
  const homeUrl = `${input.origin}/`;

  const subject = "You're on the Edgeways waitlist";
  const text = [
    "You're on the Edgeways waitlist.",
    "",
    "Thanks for joining. We'll email you when early beta access opens.",
    "",
    `Edgeways — ${homeUrl}`,
    "",
    "18+ only. Betting involves risk, never stake what you can't afford to lose.",
    `BeGambleAware.org — ${BEGAMBLEAWARE_URL}`,
    "",
    `Unsubscribe: ${input.unsubscribeUrl}`,
  ].join("\n");

  // No image attachments: Gmail often treats unexpected attachments as phishing.
  // Yellow HTML wordmark until the live site can host /brand/logo-yellow.png.
  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${subject}</title>
<style type="text/css">
  :root { color-scheme: light only; supported-color-schemes: light only; }
  .ew-cta,
  .ew-cta:link,
  .ew-cta:visited,
  .ew-cta span,
  .ew-cta font {
    color: #222222 !important;
    -webkit-text-fill-color: #222222 !important;
  }
</style>
</head>
<body style="margin:0;padding:0;background:${INK};color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${INK};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
          <tr>
            <td style="padding:0 0 28px;">
              <a href="${homeUrl}" style="text-decoration:none;border:0;color:${BRAND};font-size:22px;font-weight:700;letter-spacing:-0.02em;line-height:1;">
                <span style="color:${BRAND};">edgeways</span>
                <span style="display:inline-block;margin-left:8px;padding:3px 7px;border-radius:3px;background:${BRAND};color:${CTA_INK};font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;vertical-align:middle;line-height:1;">Beta</span>
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;border:1px solid #2a2a2a;border-radius:12px;background:#161616;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#8a8a8a;">Waitlist</p>
              <h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">You're on the list</h1>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.5;color:#b8b8b8;">Thanks for joining. We'll email you when early beta access opens.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="${BRAND}" style="border-radius:8px;background-color:${BRAND};mso-padding-alt:12px 18px;">
                    <a class="ew-cta" href="${homeUrl}" target="_blank" style="display:inline-block;padding:12px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;line-height:1.2;color:${CTA_INK} !important;-webkit-text-fill-color:${CTA_INK} !important;text-decoration:none;">
                      <font color="${CTA_INK}"><span style="color:${CTA_INK} !important;-webkit-text-fill-color:${CTA_INK} !important;text-decoration:none;">Back to site</span></font>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 4px 0;font-size:12px;line-height:1.55;color:#808080;">
              <p style="margin:0 0 12px;">18+ only. Betting involves risk, never stake what you can't afford to lose. <a href="${BEGAMBLEAWARE_URL}" style="color:${BRAND};">BeGambleAware.org</a></p>
              <p style="margin:0;">Don't want these emails? <a href="${input.unsubscribeUrl}" style="color:#b0b0b0;">Unsubscribe</a>.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

function resendFrom(): string {
  // Display name + address, e.g. `Edgeways <hello@edgeways.app>`.
  // Address-only values show as "hello" in most clients.
  return process.env.RESEND_FROM?.trim() || "Edgeways <hello@edgeways.app>";
}

/** Owner inboxes for "someone joined" alerts. Comma-separated. */
function waitlistNotifyRecipients(): string[] {
  const raw = process.env.WAITLIST_NOTIFY_TO?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0 && isValidWaitlistEmail(part));
}

async function sendThanksEmail(input: {
  email: string;
  unsubscribeUrl: string;
}): Promise<{ sent: boolean; skippedReason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const content = buildWaitlistThanksEmail({
    origin: LIVE_SITE_ORIGIN,
    unsubscribeUrl: input.unsubscribeUrl,
  });

  if (!apiKey) {
    console.info(
      `[waitlist] RESEND_API_KEY unset. Thanks email for ${input.email} skipped. Unsubscribe: ${input.unsubscribeUrl}`
    );
    return { sent: false, skippedReason: "resend_unconfigured" };
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
        to: [input.email],
        subject: content.subject,
        html: content.html,
        text: content.text,
        headers: {
          "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[waitlist] Resend failed (${res.status}): ${body.slice(0, 300)}`);
      return { sent: false, skippedReason: "resend_error" };
    }
    return { sent: true };
  } catch (err) {
    console.error("[waitlist] Resend request failed:", err);
    return { sent: false, skippedReason: "resend_error" };
  }
}

/** Ping you when someone joins. Failures are logged only — signup still succeeds. */
async function notifyOwnerOfJoin(input: {
  email: string;
  rejoin: boolean;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const to = waitlistNotifyRecipients();
  if (!apiKey || to.length === 0) return;

  const subject = input.rejoin
    ? `Waitlist re-join: ${input.email}`
    : `New waitlist signup: ${input.email}`;
  const text = [
    input.rejoin
      ? "Someone re-joined the Edgeways waitlist (was unsubscribed)."
      : "Someone joined the Edgeways waitlist.",
    "",
    `Email: ${input.email}`,
    `When: ${new Date().toISOString()}`,
  ].join("\n");

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
        subject,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[waitlist] Owner notify failed (${res.status}): ${body.slice(0, 300)}`
      );
    }
  } catch (err) {
    console.error("[waitlist] Owner notify request failed:", err);
  }
}

export type JoinWaitlistResult =
  | { status: "joined"; email: string }
  | { status: "already_confirmed"; email: string };

/**
 * Upsert a waitlist signup, mark confirmed, and send the branded thanks email.
 * Re-joining after unsubscribe restores the address and sends thanks again.
 */
export async function joinWaitlist(rawEmail: string): Promise<JoinWaitlistResult> {
  const email = normaliseWaitlistEmail(rawEmail);
  if (!isValidWaitlistEmail(email)) {
    throw new Error("Enter a valid email address.");
  }

  const existing = db
    .select()
    .from(waitlistSignups)
    .where(eq(waitlistSignups.email, email))
    .get() as WaitlistSignupRow | undefined;

  if (existing?.confirmedAt != null && existing.unsubscribedAt == null) {
    return { status: "already_confirmed", email };
  }

  const now = Date.now();
  const token = newListToken();
  const tokenHash = hashToken(token);
  const unsubscribeUrl = `${LIVE_SITE_ORIGIN}/api/waitlist/unsubscribe?token=${encodeURIComponent(token)}`;
  const rejoin = Boolean(existing?.unsubscribedAt);

  if (existing) {
    db.update(waitlistSignups)
      .set({
        confirmTokenHash: tokenHash,
        confirmedAt: existing.confirmedAt ?? now,
        confirmSentAt: now,
        unsubscribedAt: null,
      })
      .where(eq(waitlistSignups.id, existing.id))
      .run();
  } else {
    db.insert(waitlistSignups)
      .values({
        email,
        confirmTokenHash: tokenHash,
        createdAt: now,
        confirmedAt: now,
        confirmSentAt: now,
        unsubscribedAt: null,
      })
      .run();
  }

  await sendThanksEmail({ email, unsubscribeUrl });
  await notifyOwnerOfJoin({ email, rejoin });
  return { status: "joined", email };
}

export type ConfirmWaitlistResult =
  | { status: "confirmed"; email: string }
  | { status: "already_confirmed"; email: string }
  | { status: "invalid_token" };

/** Legacy confirm links from the old double-opt-in flow. */
export function confirmWaitlist(rawToken: string): ConfirmWaitlistResult {
  const token = rawToken.trim();
  if (!token || token.length > 200) return { status: "invalid_token" };

  const tokenHash = hashToken(token);
  const row = db
    .select()
    .from(waitlistSignups)
    .where(eq(waitlistSignups.confirmTokenHash, tokenHash))
    .get() as WaitlistSignupRow | undefined;

  if (!row) return { status: "invalid_token" };
  if (row.confirmedAt != null) {
    return { status: "already_confirmed", email: row.email };
  }

  const now = Date.now();
  db.update(waitlistSignups)
    .set({ confirmedAt: now })
    .where(eq(waitlistSignups.id, row.id))
    .run();

  return { status: "confirmed", email: row.email };
}

export type UnsubscribeWaitlistResult =
  | { status: "unsubscribed"; email: string }
  | { status: "already_unsubscribed"; email: string }
  | { status: "invalid_token" };

export function unsubscribeWaitlist(rawToken: string): UnsubscribeWaitlistResult {
  const token = rawToken.trim();
  if (!token || token.length > 200) return { status: "invalid_token" };

  const tokenHash = hashToken(token);
  const row = db
    .select()
    .from(waitlistSignups)
    .where(eq(waitlistSignups.confirmTokenHash, tokenHash))
    .get() as WaitlistSignupRow | undefined;

  if (!row) return { status: "invalid_token" };
  if (row.unsubscribedAt != null) {
    return { status: "already_unsubscribed", email: row.email };
  }

  const now = Date.now();
  db.update(waitlistSignups)
    .set({ unsubscribedAt: now })
    .where(eq(waitlistSignups.id, row.id))
    .run();

  return { status: "unsubscribed", email: row.email };
}
