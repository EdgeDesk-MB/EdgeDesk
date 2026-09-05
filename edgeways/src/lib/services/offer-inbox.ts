/**
 * Offer inbox (J6 stage 3): every desk gets a unique forwarding address,
 * offers+<token>@<inbox-domain>. A forwarded bookmaker email lands as a
 * PLANNED offer draft (source 'email') with an alert + push, same review
 * model as the IMAP intake. Never auto-activates.
 *
 * Security model: the token is a bearer credential (11-char base64url,
 * ~66 bits). Unknown tokens are silently dropped, never confirmed. The
 * webhook route verifies the provider signature before anything here runs.
 *
 * Dedup: provider Message-ID first, then a content fingerprint
 * (bookie + title + expiry day) inside a 7-day window, so a re-forwarded
 * campaign cannot stack duplicate Planned rows. A per-address daily cap
 * bounds abuse and provider cost.
 *
 * Hosted desk is Neon: every read/write dual-paths on isNeonDesk().
 */
import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, gte, lt, max } from "drizzle-orm";
import {
  db,
  offerInboxAddresses,
  offerInboundMessages,
  offers,
  type OfferInboxAddressRow,
} from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import { isOperatorAdmin } from "@/lib/admin/emails";
import { findAppUserByClerkId } from "@/lib/services/app-users";
import { buildEmailDraft } from "@/lib/services/email-intake";
import { synthesiseRawEmail } from "@/lib/services/inbound-webhook";
import { recordAlerts, type IncomingAlert } from "@/lib/services/alerts-inbox";
import { sendPush, sendPushToUser } from "@/lib/services/push";

/** Per-address daily cap: bounds spam, cost and desk noise. */
export const INBOUND_DAILY_CAP = 50;
/** Re-forwarded campaigns dedupe inside this window. */
const FINGERPRINT_WINDOW_MS = 7 * 24 * 60 * 60_000;
/** Receipt log retention (privacy policy): pruned on each ingest. */
export const INBOUND_LEDGER_RETENTION_MS = 365 * 24 * 60 * 60_000;

export function offerInboxDomain(): string {
  return process.env.EDGEWAYS_INBOUND_DOMAIN?.trim() || "in.edgeways.app";
}

/**
 * 12 chars from an unambiguous lowercase alphabet (no l/o/0/1): 60 bits,
 * unguessable, and safe to read aloud or type. Lowercase-only because
 * inbound routing lowercases the recipient before lookup.
 */
const TOKEN_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
export function generateInboxToken(): string {
  const bytes = randomBytes(12);
  let out = "";
  for (const b of bytes) out += TOKEN_ALPHABET[b % TOKEN_ALPHABET.length];
  return out;
}

export function formatInboxAddress(token: string): string {
  return `offers+${token}@${offerInboxDomain()}`;
}

/* ------------------------------------------------------------------ */
/* Rollout gate: admin-only while the inbox is proven. Admin → Users   */
/* is the control surface; the local single-operator desk is always    */
/* allowed, so the check only bites on the hosted multi-tenant desk.   */
/* ------------------------------------------------------------------ */

export async function isOfferInboxAllowed(
  clerkUserId: string
): Promise<boolean> {
  const user = await findAppUserByClerkId(clerkUserId);
  return isOperatorAdmin({ email: user?.email ?? null, role: user?.role ?? null });
}

/** Actor-context gate for the settings route. Local desk: always on. */
export async function offerInboxAvailable(): Promise<boolean> {
  if (!isNeonDesk()) return true;
  const { neonDeskClerkUserId } = await import("@/lib/db/neon-desk");
  const id = neonDeskClerkUserId();
  if (!id) return false;
  return isOfferInboxAllowed(id);
}

export interface OfferInboxStatus {
  enabled: boolean;
  address: string | null;
  createdAt: number | null;
  totalReceived: number;
  lastReceivedAt: number | null;
}

export type IngestStatus =
  | "drafted"
  | "duplicate"
  | "failed"
  | "unknown_address"
  | "rate_limited";

export interface IngestResult {
  status: IngestStatus;
  offerId?: number;
  title?: string;
}

export interface InboundEmailInput {
  token: string;
  subject: string | null;
  text: string | null;
  html: string | null;
  messageId: string | null;
}

/* ------------------------------------------------------------------ */
/* Local (SQLite) storage - the single-operator desk holds one row.    */
/* ------------------------------------------------------------------ */

function getLocalInbox(): OfferInboxAddressRow | null {
  return db.select().from(offerInboxAddresses).limit(1).get() ?? null;
}

function findLocalInboxByToken(token: string): OfferInboxAddressRow | null {
  return (
    db
      .select()
      .from(offerInboxAddresses)
      .where(eq(offerInboxAddresses.token, token))
      .limit(1)
      .get() ?? null
  );
}

function enableLocalInbox(): OfferInboxAddressRow {
  const existing = getLocalInbox();
  if (existing) return existing;
  // Unique token collision is vanishingly unlikely; retry anyway.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return db
        .insert(offerInboxAddresses)
        .values({ token: generateInboxToken(), createdAt: Date.now() })
        .returning()
        .get();
    } catch {
      if (attempt === 2) throw new Error("Could not create an inbox address.");
    }
  }
  throw new Error("Could not create an inbox address.");
}

function rotateLocalInbox(): OfferInboxAddressRow {
  const existing = getLocalInbox();
  if (!existing) throw new Error("Turn on your offer inbox first.");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return db
        .update(offerInboxAddresses)
        .set({ token: generateInboxToken() })
        .where(eq(offerInboxAddresses.id, existing.id))
        .returning()
        .get()!;
    } catch {
      if (attempt === 2) throw new Error("Could not rotate the inbox address.");
    }
  }
  throw new Error("Could not rotate the inbox address.");
}

function disableLocalInbox(): void {
  db.delete(offerInboxAddresses).run();
}

function getLocalInboxStats(addressId: number): {
  totalReceived: number;
  lastReceivedAt: number | null;
} {
  const row = db
    .select({ n: count(), last: max(offerInboundMessages.createdAt) })
    .from(offerInboundMessages)
    .where(eq(offerInboundMessages.addressId, addressId))
    .get();
  return { totalReceived: row?.n ?? 0, lastReceivedAt: row?.last ?? null };
}

/* ------------------------------------------------------------------ */
/* Status + settings actions (dual-path)                               */
/* ------------------------------------------------------------------ */

export async function getOfferInboxStatus(): Promise<OfferInboxStatus> {
  if (isNeonDesk()) {
    const { getNeonOfferInbox, getNeonOfferInboxStats } = await import(
      "@/lib/db/neon-offer-inbox"
    );
    const row = await getNeonOfferInbox();
    if (!row) {
      return {
        enabled: false,
        address: null,
        createdAt: null,
        totalReceived: 0,
        lastReceivedAt: null,
      };
    }
    const stats = await getNeonOfferInboxStats(row.clerkUserId);
    return {
      enabled: true,
      address: formatInboxAddress(row.token),
      createdAt: row.createdAt,
      ...stats,
    };
  }
  const row = getLocalInbox();
  if (!row) {
    return {
      enabled: false,
      address: null,
      createdAt: null,
      totalReceived: 0,
      lastReceivedAt: null,
    };
  }
  return {
    enabled: true,
    address: formatInboxAddress(row.token),
    createdAt: row.createdAt,
    ...getLocalInboxStats(row.id),
  };
}

export async function enableOfferInbox(): Promise<OfferInboxStatus> {
  if (isNeonDesk()) {
    const { enableNeonOfferInbox } = await import("@/lib/db/neon-offer-inbox");
    await enableNeonOfferInbox(generateInboxToken());
    return getOfferInboxStatus();
  }
  enableLocalInbox();
  return getOfferInboxStatus();
}

export async function rotateOfferInbox(): Promise<OfferInboxStatus> {
  if (isNeonDesk()) {
    const { rotateNeonOfferInbox } = await import("@/lib/db/neon-offer-inbox");
    await rotateNeonOfferInbox(generateInboxToken());
    return getOfferInboxStatus();
  }
  rotateLocalInbox();
  return getOfferInboxStatus();
}

export async function disableOfferInbox(): Promise<OfferInboxStatus> {
  if (isNeonDesk()) {
    const { disableNeonOfferInbox } = await import("@/lib/db/neon-offer-inbox");
    await disableNeonOfferInbox();
    return getOfferInboxStatus();
  }
  disableLocalInbox();
  return getOfferInboxStatus();
}

/* ------------------------------------------------------------------ */
/* Ingest (webhook + test forward)                                     */
/* ------------------------------------------------------------------ */

function startOfUtcDayMs(nowMs: number): number {
  return Date.parse(`${new Date(nowMs).toISOString().slice(0, 10)}T00:00:00.000Z`);
}

/** Content identity: same bookie campaign re-forwarded within the window. */
export function inboundFingerprint(parts: {
  bookmaker: string | null;
  title: string;
  expiresAt: number | null;
}): string {
  const day = parts.expiresAt
    ? new Date(parts.expiresAt).toISOString().slice(0, 10)
    : "";
  const normalised = [
    (parts.bookmaker ?? "").toLowerCase().trim(),
    parts.title.toLowerCase().replace(/\s+/g, " ").trim(),
    day,
  ].join("|");
  return createHash("sha256").update(normalised, "utf8").digest("hex");
}

/** Unparseable emails still dedupe: hash the body text itself. */
function rawFingerprint(text: string): string {
  const normalised = text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 4000);
  return createHash("sha256").update(`raw|${normalised}`, "utf8").digest("hex");
}

function localHasMessageId(addressId: number, messageId: string): boolean {
  return Boolean(
    db
      .select({ id: offerInboundMessages.id })
      .from(offerInboundMessages)
      .where(
        and(
          eq(offerInboundMessages.addressId, addressId),
          eq(offerInboundMessages.messageId, messageId)
        )
      )
      .limit(1)
      .get()
  );
}

function localHasFingerprint(
  addressId: number,
  fingerprint: string,
  sinceMs: number
): boolean {
  return Boolean(
    db
      .select({ id: offerInboundMessages.id })
      .from(offerInboundMessages)
      .where(
        and(
          eq(offerInboundMessages.addressId, addressId),
          eq(offerInboundMessages.fingerprint, fingerprint),
          gte(offerInboundMessages.createdAt, sinceMs)
        )
      )
      .limit(1)
      .get()
  );
}

function localInboundCountSince(addressId: number, sinceMs: number): number {
  return (
    db
      .select({ n: count() })
      .from(offerInboundMessages)
      .where(
        and(
          eq(offerInboundMessages.addressId, addressId),
          gte(offerInboundMessages.createdAt, sinceMs)
        )
      )
      .get()?.n ?? 0
  );
}

function recordLocalInbound(input: {
  addressId: number;
  messageId: string | null;
  fingerprint: string;
  status: "drafted" | "duplicate" | "failed";
  offerId: number | null;
}): void {
  // A retried provider delivery with the same message id is a no-op.
  db.insert(offerInboundMessages)
    .values({
      addressId: input.addressId,
      messageId: input.messageId,
      fingerprint: input.fingerprint,
      status: input.status,
      offerId: input.offerId,
      createdAt: Date.now(),
    })
    .onConflictDoNothing()
    .run();
}

/** Retention: receipt log rows older than the cutoff are deleted on ingest. */
function pruneLocalInbound(addressId: number, beforeMs: number): void {
  db.delete(offerInboundMessages)
    .where(
      and(
        eq(offerInboundMessages.addressId, addressId),
        lt(offerInboundMessages.createdAt, beforeMs)
      )
    )
    .run();
}

function arrivalAlert(title: string, bookmaker: string | null, offerId: number): IncomingAlert {
  return {
    kind: "email_offers",
    key: `email_offer:${offerId}`,
    title: bookmaker ? `Offer in from ${bookmaker}` : "Offer arrived by email",
    body: `${title} · waiting as Planned on Offers`,
    href: "/offers",
  };
}

/**
 * One forwarded email → one Planned draft. Dual-path: the hosted desk
 * resolves the owner from the address token and writes Neon clerk-scoped;
 * the local desk writes SQLite. Unknown tokens and duplicates never create
 * offer rows.
 */
export async function ingestInboundEmail(
  input: InboundEmailInput,
  opts: { skipDedup?: boolean } = {}
): Promise<IngestResult> {
  const token = input.token.trim().toLowerCase();
  if (!token) return { status: "unknown_address" };
  const nowMs = Date.now();

  if (isNeonDesk()) {
    const neon = await import("@/lib/db/neon-offer-inbox");
    const clerkUserId = await neon.findNeonInboxOwnerByToken(token);
    if (!clerkUserId) return { status: "unknown_address" };
    if (!(await isOfferInboxAllowed(clerkUserId))) {
      // Gated rollout: non-admin addresses drop silently, same as unknown
      // tokens - the gate's existence is never revealed to senders.
      return { status: "unknown_address" };
    }
    await neon.pruneNeonInbound(clerkUserId, nowMs - INBOUND_LEDGER_RETENTION_MS);
    if ((await neon.countNeonInboundSince(clerkUserId, startOfUtcDayMs(nowMs))) >= INBOUND_DAILY_CAP) {
      return { status: "rate_limited" };
    }
    if (
      !opts.skipDedup &&
      input.messageId &&
      (await neon.findNeonInboundByMessageId(clerkUserId, input.messageId))
    ) {
      return { status: "duplicate" };
    }

    const raw = synthesiseRawEmail(input);
    const draft = raw ? buildEmailDraft(raw) : null;
    const fingerprint = draft
      ? inboundFingerprint(draft)
      : rawFingerprint(`${input.subject ?? ""} ${input.text ?? ""}`);
    if (
      !opts.skipDedup &&
      (await neon.findNeonInboundByFingerprint(
        clerkUserId,
        fingerprint,
        nowMs - FINGERPRINT_WINDOW_MS
      ))
    ) {
      await neon.recordNeonInboundMessage({
        clerkUserId,
        messageId: input.messageId,
        fingerprint,
        status: "duplicate",
        offerId: null,
      });
      return { status: "duplicate" };
    }
    if (!draft) {
      await neon.recordNeonInboundMessage({
        clerkUserId,
        messageId: input.messageId,
        fingerprint,
        status: "failed",
        offerId: null,
      });
      return { status: "failed" };
    }

    const { insertNeonDeskOfferForUser } = await import("@/lib/db/neon-desk-offers");
    const row = await insertNeonDeskOfferForUser(clerkUserId, {
      bookmaker: draft.bookmaker,
      title: draft.title,
      description: draft.description,
      expectedProfit: draft.expectedProfit,
      status: "planned",
      expiresAt: draft.expiresAt,
      sport: draft.sport,
      eventDate: draft.eventDate,
      rules: draft.rules,
      offerType: draft.rules?.includes("bet_get_free_place")
        ? "bet_get_free_place"
        : draft.rules
          ? "promo_terms"
          : null,
      source: "email",
      createdAt: nowMs,
    });
    await neon.recordNeonInboundMessage({
      clerkUserId,
      messageId: input.messageId,
      fingerprint,
      status: "drafted",
      offerId: row.id,
    });
    const alert = arrivalAlert(draft.title, draft.bookmaker, row.id);
    const { recordNeonAlertsForUser } = await import("@/lib/db/neon-alerts-inbox");
    await recordNeonAlertsForUser(clerkUserId, [alert]).catch(() => 0);
    void sendPushToUser(clerkUserId, alert).catch(() => {});
    return { status: "drafted", offerId: row.id, title: draft.title };
  }

  const address = findLocalInboxByToken(token);
  if (!address) return { status: "unknown_address" };
  pruneLocalInbound(address.id, nowMs - INBOUND_LEDGER_RETENTION_MS);
  if (localInboundCountSince(address.id, startOfUtcDayMs(nowMs)) >= INBOUND_DAILY_CAP) {
    return { status: "rate_limited" };
  }
  if (!opts.skipDedup && input.messageId && localHasMessageId(address.id, input.messageId)) {
    return { status: "duplicate" };
  }

  const raw = synthesiseRawEmail(input);
  const draft = raw ? buildEmailDraft(raw) : null;
  const fingerprint = draft
    ? inboundFingerprint(draft)
    : rawFingerprint(`${input.subject ?? ""} ${input.text ?? ""}`);
  if (
    !opts.skipDedup &&
    localHasFingerprint(address.id, fingerprint, nowMs - FINGERPRINT_WINDOW_MS)
  ) {
    recordLocalInbound({
      addressId: address.id,
      messageId: input.messageId,
      fingerprint,
      status: "duplicate",
      offerId: null,
    });
    return { status: "duplicate" };
  }
  if (!draft) {
    recordLocalInbound({
      addressId: address.id,
      messageId: input.messageId,
      fingerprint,
      status: "failed",
      offerId: null,
    });
    return { status: "failed" };
  }

  const row = db
    .insert(offers)
    .values({
      bookmaker: draft.bookmaker,
      title: draft.title,
      description: draft.description,
      expectedProfit: draft.expectedProfit,
      status: "planned",
      expiresAt: draft.expiresAt,
      sport: draft.sport,
      eventDate: draft.eventDate,
      rules: draft.rules,
      offerType: draft.rules?.includes("bet_get_free_place")
        ? "bet_get_free_place"
        : draft.rules
          ? "promo_terms"
          : null,
      source: "email",
      createdAt: nowMs,
    })
    .returning()
    .get();
  recordLocalInbound({
    addressId: address.id,
    messageId: input.messageId,
    fingerprint,
    status: "drafted",
    offerId: row.id,
  });
  const alert = arrivalAlert(draft.title, draft.bookmaker, row.id);
  recordAlerts([alert]);
  void sendPush(alert).catch(() => {});
  return { status: "drafted", offerId: row.id, title: draft.title };
}

/** Settings "Send a test offer": the desk's own address, dedup bypassed. */
export async function sendTestForward(): Promise<IngestResult> {
  const status = await getOfferInboxStatus();
  if (!status.enabled || !status.address) {
    throw new Error("Turn on your offer inbox first.");
  }
  const token = status.address.split("@")[0].replace(/^offers\+/, "");
  return ingestInboundEmail(
    {
      token,
      subject: "Your £10 free bet is here this weekend",
      text: [
        "Hi Sam,",
        "",
        "Place a £10 bet on any Premier League match this weekend and we will credit you a £10 free bet.",
        "",
        "Minimum odds 1/2 (1.5). Free bet expires in 7 days. 18+. T&Cs apply.",
        "",
        "Paddy Power",
      ].join("\n"),
      html: null,
      messageId: `test-${Date.now()}@edgeways.local`,
    },
    { skipDedup: true }
  );
}
