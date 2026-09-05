/**
 * Inbound email webhook helpers - pure functions, unit-tested directly.
 *
 * Signature scheme is the svix standard Resend (and others) sign webhooks
 * with: HMAC-SHA256 over `${svix-id}.${svix-timestamp}.${rawBody}` keyed by
 * the base64 secret after the `whsec_` prefix, delivered as space-separated
 * `v1,<base64>` candidates in `svix-signature`. Implemented on node:crypto
 * so no svix dependency is needed.
 *
 * Payload normalisation tolerates Resend (`data` wrapper, snake_case) and
 * Postmark (PascalCase TextBody/HtmlBody/MessageID) shapes so the provider
 * can be swapped without a route change.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_TOLERANCE_MS = 5 * 60_000;

export interface WebhookSignatureHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

export function verifySvixSignature(
  secret: string,
  headers: WebhookSignatureHeaders,
  rawBody: string,
  nowMs = Date.now()
): boolean {
  const trimmed = secret.trim();
  if (!trimmed || !headers.id || !headers.timestamp || !headers.signature) {
    return false;
  }
  const timestampMs = Number(headers.timestamp) * 1000;
  if (!Number.isFinite(timestampMs)) return false;
  if (Math.abs(nowMs - timestampMs) > SIGNATURE_TOLERANCE_MS) return false;

  const key = Buffer.from(
    trimmed.startsWith("whsec_") ? trimmed.slice("whsec_".length) : trimmed,
    "base64"
  );
  if (key.length === 0) return false;

  const expected = createHmac("sha256", key)
    .update(`${headers.id}.${headers.timestamp}.${rawBody}`, "utf8")
    .digest();

  for (const candidate of headers.signature.split(" ")) {
    const [version, value] = candidate.split(",");
    if (version !== "v1" || !value) continue;
    let presented: Buffer;
    try {
      presented = Buffer.from(value, "base64");
    } catch {
      continue;
    }
    if (presented.length === expected.length && timingSafeEqual(presented, expected)) {
      return true;
    }
  }
  return false;
}

export interface NormalisedInboundEmail {
  /** Every recipient address found, lowercased */
  to: string[];
  subject: string | null;
  text: string | null;
  html: string | null;
  messageId: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function collectAddresses(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectAddresses(entry, out);
    return;
  }
  const record = asRecord(value);
  if (record) {
    const address = asString(record.address) ?? asString(record.email);
    if (address) out.push(address);
  }
}

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/**
 * Pull every email address out of To-style values, which arrive variously
 * as "Name <a@b>", bare addresses, arrays, or { address } objects.
 */
export function extractEmailAddresses(value: unknown): string[] {
  const rough: string[] = [];
  collectAddresses(value, rough);
  const out: string[] = [];
  for (const entry of rough) {
    const matches = entry.toLowerCase().match(EMAIL_PATTERN);
    if (matches) out.push(...matches);
  }
  return [...new Set(out)];
}

/** Provider-tolerant normalisation; null when the payload has nothing usable. */
export function normaliseInboundPayload(payload: unknown): NormalisedInboundEmail | null {
  let record = asRecord(payload);
  if (!record) return null;
  // Resend wraps the email in { type: "email.received", data: { ... } }.
  const inner = asRecord(record.data);
  if (inner && (inner.to !== undefined || inner.subject !== undefined)) {
    record = inner;
  }

  const to = extractEmailAddresses(
    record.to ?? record.To ?? record.recipients ?? record.recipient
  );
  const subject = asString(record.subject) ?? asString(record.Subject);
  const text =
    asString(record.text) ?? asString(record.TextBody) ?? asString(record.text_body);
  const html =
    asString(record.html) ?? asString(record.HtmlBody) ?? asString(record.html_body);
  const messageId =
    asString(record.message_id) ??
    asString(record.messageId) ??
    asString(record.MessageID) ??
    asString(record.messageID);

  if (to.length === 0 && !subject && !text && !html) return null;
  return { to, subject, text, html, messageId };
}

/**
 * The inbox token from a recipient list. Accepts offers+<token>@ (canonical)
 * or a bare <token>@ local part, so a provider that strips plus-addressing
 * still routes. Tokens are 11-char base64url (8 random bytes).
 */
export function extractInboxToken(to: string[]): string | null {
  for (const address of to) {
    const local = address.split("@")[0] ?? "";
    const plus = local.match(/^offers\+([a-z0-9_-]{8,16})$/);
    if (plus) return plus[1];
    if (/^[a-z0-9_-]{10,14}$/.test(local)) return local;
  }
  return null;
}

/** Header values must never smuggle a line break into the synthesised MIME. */
function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/**
 * The Resend received-email id from an email.received webhook, used to fetch
 * the body from the Receiving API (the webhook itself is metadata only).
 */
export function extractResendEmailId(payload: unknown): string | null {
  const record = asRecord(payload);
  if (!record) return null;
  const data = asRecord(record.data);
  const id = asString(data?.email_id) ?? asString(data?.id);
  return id;
}

/**
 * Rebuild a minimal RFC822 message from webhook fields so the existing,
 * tested MIME pipeline (parseEmlToOfferText → buildEmailDraft) parses
 * forwarded email exactly as it parses a dropped .eml. Empty string when
 * there is no body to work with.
 */
export function synthesiseRawEmail(input: {
  subject: string | null;
  text: string | null;
  html: string | null;
  messageId: string | null;
}): string {
  const text = input.text?.trim() || null;
  const html = input.html?.trim() || null;
  if (!text && !html) return "";
  const headers = [
    `Subject: ${headerSafe(input.subject ?? "")}`,
    "From: Edgeways inbox <offers@in.edgeways.app>",
  ];
  if (input.messageId) headers.push(`Message-ID: ${headerSafe(input.messageId)}`);
  headers.push(
    text
      ? "Content-Type: text/plain; charset=utf-8"
      : "Content-Type: text/html; charset=utf-8"
  );
  return `${headers.join("\r\n")}\r\n\r\n${text ?? html}`;
}
