/**
 * Email intake (J6 stage 2) - the desk polls an IMAP folder you forward
 * promo emails to and queues PLANNED offer drafts for review. Never
 * auto-activates: planned status IS the review queue.
 *
 * Credentials live in app_settings, stored locally UNENCRYPTED exactly
 * like the .env API keys - use a dedicated forwarding mailbox with an
 * app password, never a main account. The password is never returned to
 * the client (the status API reports only hasPassword).
 *
 * Compute-on-poll idiom (H1): the fetch runs at most every INTERVAL
 * while the desk is open; `imapflow` (flagged and approved 2026-07-16)
 * is imported dynamically so the dependency loads only when enabled.
 */

import { eq } from "drizzle-orm";
import { db, appSettings, offers } from "@/lib/db";
import { parseEmlToOfferText } from "@/lib/offers/parse-email";
import { parseOfferFromText } from "@/lib/offers/parse-offer-text";
import { offerCategoryById } from "@/lib/offers/offer-categories";
import { recordAlerts } from "@/lib/services/alerts-inbox";
import { sendPush } from "@/lib/services/push";

const KEYS = {
  enabled: "emailIntakeEnabled",
  host: "emailIntakeHost",
  port: "emailIntakePort",
  user: "emailIntakeUser",
  password: "emailIntakePassword",
  folder: "emailIntakeFolder",
  lastResult: "emailIntakeLastResult",
} as const;

const DEFAULT_FOLDER = "Edgeways";
/** Emails are not urgent; a quiet 5-minute cadence beats hammering IMAP. */
const POLL_INTERVAL_MS = 5 * 60_000;

function readSetting(key: string): string | undefined {
  return db.select().from(appSettings).where(eq(appSettings.key, key)).get()?.value;
}

function writeSetting(key: string, value: string): void {
  const existing = db.select().from(appSettings).where(eq(appSettings.key, key)).get();
  if (existing) db.update(appSettings).set({ value }).where(eq(appSettings.key, key)).run();
  else db.insert(appSettings).values({ key, value }).run();
}

export interface EmailIntakeConfig {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  password: string;
  folder: string;
}

export function getEmailIntakeConfig(): EmailIntakeConfig {
  const port = parseInt(readSetting(KEYS.port) ?? "", 10);
  return {
    enabled: readSetting(KEYS.enabled) === "true",
    host: readSetting(KEYS.host) ?? "",
    port: Number.isFinite(port) && port > 0 ? port : 993,
    user: readSetting(KEYS.user) ?? "",
    password: readSetting(KEYS.password) ?? "",
    folder: readSetting(KEYS.folder) || DEFAULT_FOLDER,
  };
}

export function saveEmailIntakeConfig(patch: {
  enabled?: boolean;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  folder?: string;
}): void {
  if (patch.enabled !== undefined) writeSetting(KEYS.enabled, String(patch.enabled));
  if (patch.host !== undefined) writeSetting(KEYS.host, patch.host.trim());
  if (patch.port !== undefined) writeSetting(KEYS.port, String(patch.port));
  if (patch.user !== undefined) writeSetting(KEYS.user, patch.user.trim());
  if (patch.password !== undefined && patch.password !== "")
    writeSetting(KEYS.password, patch.password);
  if (patch.folder !== undefined) writeSetting(KEYS.folder, patch.folder.trim() || DEFAULT_FOLDER);
}

export function getEmailIntakeStatus(): {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  folder: string;
  hasPassword: boolean;
  lastResult: string | null;
} {
  const cfg = getEmailIntakeConfig();
  return {
    enabled: cfg.enabled,
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    folder: cfg.folder,
    hasPassword: cfg.password.length > 0,
    lastResult: readSetting(KEYS.lastResult) ?? null,
  };
}

/** Fields ready for a planned-offer insert (source 'email'). */
export interface EmailOfferDraft {
  title: string;
  bookmaker: string | null;
  description: string | null;
  expectedProfit: number | null;
  expiresAt: number | null;
  eventDate: string | null;
  sport: string | null;
  rules: string | null;
}

/**
 * Pure stage-1 mapping: raw RFC822 → offer draft fields, or null when the
 * email doesn't parse (non-email content, empty body). Tested directly.
 */
export function buildEmailDraft(raw: string, now = new Date()): EmailOfferDraft | null {
  const email = parseEmlToOfferText(raw);
  if (!email) return null;
  const draft = parseOfferFromText(email.offerText, now);
  if (!draft.title.trim()) return null;
  return {
    title: draft.title.trim(),
    bookmaker: draft.bookmaker,
    // The body rides along so review has the full promo text in Details.
    description: draft.description ?? email.body.slice(0, 2000),
    expectedProfit: draft.expectedProfit,
    expiresAt: draft.expiresAt,
    eventDate: draft.eventDate,
    sport: offerCategoryById(draft.category).sport,
    rules: draft.rules ? JSON.stringify(draft.rules) : null,
  };
}

/** Insert drafts as PLANNED offers tagged source='email'; returns created count. */
export function createEmailDrafts(drafts: EmailOfferDraft[], nowMs = Date.now()): number {
  let created = 0;
  for (const d of drafts) {
    db.insert(offers)
      .values({
        bookmaker: d.bookmaker,
        title: d.title,
        description: d.description,
        expectedProfit: d.expectedProfit,
        status: "planned",
        expiresAt: d.expiresAt,
        sport: d.sport,
        eventDate: d.eventDate,
        rules: d.rules,
        source: "email",
        createdAt: nowMs,
      })
      .run();
    created += 1;
  }
  if (created > 0) {
    const alert = {
      kind: "email_offers",
      key: `email_offers:${new Date(nowMs).toISOString().slice(0, 10)}`,
      title: created === 1 ? "1 offer arrived by email" : `${created} offers arrived by email`,
      body: "Drafts waiting as Planned · review before activating",
      href: "/offers",
    };
    recordAlerts([alert]);
    void sendPush(alert).catch(() => {});
  }
  return created;
}

/** Minimal IMAP surface so tests can inject a mock client. */
export interface EmailIntakeClient {
  listUnseen(): Promise<Array<{ uid: number; raw: string }>>;
  markSeen(uids: number[]): Promise<void>;
  close(): Promise<void>;
}

/**
 * Fetch unseen messages, create drafts, mark ONLY successfully-drafted
 * messages seen (a failed parse stays unseen for a manual look).
 */
export async function ingestFromClient(
  client: EmailIntakeClient,
  now = new Date(),
  createDrafts: (drafts: EmailOfferDraft[], nowMs: number) => number = createEmailDrafts
): Promise<{ created: number; skipped: number }> {
  const messages = await client.listUnseen();
  const drafts: EmailOfferDraft[] = [];
  const doneUids: number[] = [];
  let skipped = 0;
  for (const m of messages) {
    const draft = buildEmailDraft(m.raw, now);
    if (draft) {
      drafts.push(draft);
      doneUids.push(m.uid);
    } else {
      skipped += 1;
    }
  }
  const created = createDrafts(drafts, now.getTime());
  if (doneUids.length > 0) await client.markSeen(doneUids);
  return { created, skipped };
}

/** Real imapflow adapter - dynamic import keeps the dep server-lazy. */
async function createImapClient(cfg: EmailIntakeConfig): Promise<EmailIntakeClient> {
  const { ImapFlow } = await import("imapflow");
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: true,
    auth: { user: cfg.user, pass: cfg.password },
    logger: false,
  });
  await client.connect();
  await client.mailboxOpen(cfg.folder);
  return {
    async listUnseen() {
      const out: Array<{ uid: number; raw: string }> = [];
      for await (const msg of client.fetch(
        { seen: false },
        { source: true, uid: true },
        { uid: false }
      )) {
        if (msg.source) out.push({ uid: msg.uid, raw: msg.source.toString("utf-8") });
      }
      return out;
    },
    async markSeen(uids: number[]) {
      if (uids.length > 0) {
        await client.messageFlagsAdd(uids.join(","), ["\\Seen"], { uid: true });
      }
    },
    async close() {
      await client.logout();
    },
  };
}

/** Run one intake pass now (Settings "Check now" + the poll). */
export async function runEmailIntake(): Promise<{ created: number; skipped: number; error?: string }> {
  const cfg = getEmailIntakeConfig();
  if (!cfg.host || !cfg.user || !cfg.password) {
    return { created: 0, skipped: 0, error: "Email intake is not configured" };
  }
  let client: EmailIntakeClient | null = null;
  try {
    client = await createImapClient(cfg);
    const result = await ingestFromClient(client);
    writeSetting(
      KEYS.lastResult,
      `${new Date().toISOString()} · ${result.created} drafted, ${result.skipped} skipped`
    );
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    writeSetting(KEYS.lastResult, `${new Date().toISOString()} · error: ${message}`);
    return { created: 0, skipped: 0, error: message };
  } finally {
    await client?.close().catch(() => {});
  }
}

let lastPollAt = 0;
let pollInFlight = false;

/** Compute-on-poll trigger - fire-and-forget from state assembly. */
export function maybePollEmailIntake(nowMs = Date.now()): void {
  const cfg = getEmailIntakeConfig();
  if (!cfg.enabled || !cfg.host || !cfg.user || !cfg.password) return;
  if (pollInFlight || nowMs - lastPollAt < POLL_INTERVAL_MS) return;
  lastPollAt = nowMs;
  pollInFlight = true;
  void runEmailIntake()
    .catch(() => {})
    .finally(() => {
      pollInFlight = false;
    });
}
