/**
 * Web push delivery (F3) - a real AlertChannel behind the same alert logic.
 * VAPID keys are generated once and persisted (local: app_settings; hosted:
 * Neon operator_settings) so no env is needed. Sending requires the server to
 * be online; delivery goes via the browser vendors' push relays, so the phone
 * gets it anywhere. Sam's phone is Android (Chrome push - no iOS quirks).
 *
 * EDGE-110: hosted desks store subscriptions per-user in Neon and fan out
 * through db/neon-push.ts; local keeps the single-operator SQLite table.
 */
import "server-only";
import webpush from "web-push";
import { eq } from "drizzle-orm";
import { isSafePushIconPath } from "@/lib/alerts/crest-lockup";
import { resolveCrestLockupIconForAlert } from "@/lib/alerts/crest-lockup-icon";
import {
  NOTIFICATION_BADGE,
  NOTIFICATION_ICON,
} from "@/lib/alerts/notification-icons";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import { ensureNotificationTitleEmoji } from "@/lib/alerts/notification-title";
import { db, appSettings, pushSubscriptions, type PushSubscriptionRow } from "@/lib/db";
import { isNeonDesk } from "@/lib/db/desk-backend";
import type { IncomingAlert } from "@/lib/services/alerts-inbox";

function readSetting(key: string): string | undefined {
  return db.select().from(appSettings).where(eq(appSettings.key, key)).get()?.value;
}

function writeSetting(key: string, value: string): void {
  const existing = db.select().from(appSettings).where(eq(appSettings.key, key)).get();
  if (existing) db.update(appSettings).set({ value }).where(eq(appSettings.key, key)).run();
  else db.insert(appSettings).values({ key, value }).run();
}

/** Generate once, persist, reuse - rotating VAPID keys orphans subscriptions. */
function getLocalVapidPublicKey(): string {
  let pub = readSetting("vapidPublicKey");
  const priv = readSetting("vapidPrivateKey");
  if (!pub || !priv) {
    const keys = webpush.generateVAPIDKeys();
    writeSetting("vapidPublicKey", keys.publicKey);
    writeSetting("vapidPrivateKey", keys.privateKey);
    pub = keys.publicKey;
  }
  return pub;
}

export async function getVapidPublicKey(): Promise<string> {
  if (isNeonDesk()) {
    const { getNeonVapidKeys } = await import("@/lib/db/neon-push");
    return (await getNeonVapidKeys()).publicKey;
  }
  return getLocalVapidPublicKey();
}

function configureLocalVapid(): void {
  const pub = getLocalVapidPublicKey();
  const priv = readSetting("vapidPrivateKey")!;
  webpush.setVapidDetails("mailto:samhayter.design@gmail.com", pub, priv);
}

export async function saveSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  label?: string | null;
}): Promise<boolean> {
  if (isNeonDesk()) {
    const { saveNeonPushSubscription } = await import("@/lib/db/neon-push");
    return saveNeonPushSubscription(input);
  }
  db.insert(pushSubscriptions)
    .values({
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      label: input.label ?? null,
      createdAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { p256dh: input.p256dh, auth: input.auth, label: input.label ?? null },
    })
    .run();
  return true;
}

export async function removeSubscription(endpoint: string): Promise<void> {
  if (isNeonDesk()) {
    const { removeNeonPushSubscription } = await import("@/lib/db/neon-push");
    return removeNeonPushSubscription(endpoint);
  }
  db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).run();
}

export async function listSubscriptions(): Promise<PushSubscriptionRow[]> {
  if (isNeonDesk()) {
    const { listNeonPushSubscriptions } = await import("@/lib/db/neon-push");
    return listNeonPushSubscriptions();
  }
  return db.select().from(pushSubscriptions).all();
}

export type PushFanoutResult = {
  sent: number;
  pruned: number;
  failed: number;
  /** Coarse reasons for Settings / test-push diagnostics - never secrets. */
  failures: { label: string | null; statusCode: number | null; reason: string }[];
};

async function fanoutLocalPush(
  payload: string,
  ttlSeconds: number
): Promise<PushFanoutResult> {
  const subs = db.select().from(pushSubscriptions).all();
  if (subs.length === 0) return { sent: 0, pruned: 0, failed: 0, failures: [] };
  configureLocalVapid();

  let sent = 0;
  let pruned = 0;
  let failed = 0;
  const failures: PushFanoutResult["failures"] = [];
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: ttlSeconds }
        );
        sent++;
        db.update(pushSubscriptions)
          .set({ lastOkAt: Date.now() })
          .where(eq(pushSubscriptions.id, sub.id))
          .run();
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode ?? null;
        const message = e instanceof Error ? e.message : String(e);
        if (status === 404 || status === 410) {
          db.delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, sub.endpoint))
            .run();
          pruned++;
          failures.push({
            label: sub.label,
            statusCode: status,
            reason: "Subscription expired - re-enable push on that device",
          });
        } else {
          failed++;
          failures.push({
            label: sub.label,
            statusCode: status,
            reason: message.slice(0, 160),
          });
        }
      }
    })
  );
  return { sent, pruned, failed, failures };
}

async function fanoutPush(payload: string, ttlSeconds: number): Promise<PushFanoutResult> {
  if (isNeonDesk()) {
    const { fanoutNeonPush } = await import("@/lib/db/neon-push");
    return fanoutNeonPush(payload, ttlSeconds);
  }
  return fanoutLocalPush(payload, ttlSeconds);
}

type PushAlert = Pick<IncomingAlert, "title" | "body" | "href" | "key"> & {
  icon?: string | null;
};

async function resolvePushIcon(
  alert: PushAlert,
  clerkUserId?: string | null
): Promise<string> {
  if (alert.icon && isSafePushIconPath(alert.icon)) return alert.icon;
  const owner = clerkUserId ?? neonDeskClerkUserId();
  const lockup = await resolveCrestLockupIconForAlert(alert.key, owner).catch(
    () => null
  );
  return lockup ?? NOTIFICATION_ICON;
}

async function buildAlertPayload(
  alert: PushAlert,
  clerkUserId?: string | null
): Promise<string> {
  const icon = await resolvePushIcon(alert, clerkUserId);
  return JSON.stringify({
    // Exactly one leading emoji: keep semantic marks from alert rules
    // (🟢/⚠/🔒/⏰/🛎️), otherwise brand ⚡. Never stack a second bolt.
    title: ensureNotificationTitleEmoji(alert.title),
    body: alert.body ?? "",
    href: alert.href ?? "/desk",
    tag: alert.key,
    icon,
    badge: NOTIFICATION_BADGE,
  });
}

/**
 * Fan an alert out to every subscribed device. Dead subscriptions (404/410
 * from the push relay) are pruned. Failures never throw - push is a
 * best-effort channel on top of the inbox record.
 */
export async function sendPush(alert: PushAlert): Promise<PushFanoutResult> {
  return fanoutPush(await buildAlertPayload(alert), 60 * 60);
}

/**
 * System-context fanout for the hosted feed poller (EDGE-110): it settles
 * every user's bets, so there is no desk actor - the owner is explicit.
 */
export async function sendPushToUser(
  clerkUserId: string,
  alert: PushAlert
): Promise<PushFanoutResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { sent: 0, pruned: 0, failed: 0, failures: [] };
  }
  const { fanoutNeonPushToUser } = await import("@/lib/db/neon-push");
  return fanoutNeonPushToUser(
    clerkUserId,
    await buildAlertPayload(alert, clerkUserId),
    60 * 60
  );
}

/**
 * Ask every subscribed device to close notifications with these tags.
 * Used when the underlying condition is resolved on the web (offer claimed,
 * intentional mute, etc.) so the phone shade does not keep a stale prompt.
 */
export async function dismissPush(tags: string[]): Promise<PushFanoutResult> {
  const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 50);
  if (clean.length === 0) return { sent: 0, pruned: 0, failed: 0, failures: [] };
  const payload = JSON.stringify({ action: "dismiss", tags: clean });
  // Short TTL: a dismiss that arrives hours later is useless.
  return fanoutPush(payload, 5 * 60);
}

/** System-context dismiss for one owner's devices (webhooks, poller). */
export async function dismissPushForUser(
  clerkUserId: string,
  tags: string[]
): Promise<PushFanoutResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { sent: 0, pruned: 0, failed: 0, failures: [] };
  }
  const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 50);
  if (clean.length === 0) return { sent: 0, pruned: 0, failed: 0, failures: [] };
  const { fanoutNeonPushToUser } = await import("@/lib/db/neon-push");
  return fanoutNeonPushToUser(
    clerkUserId,
    JSON.stringify({ action: "dismiss", tags: clean }),
    5 * 60
  );
}
