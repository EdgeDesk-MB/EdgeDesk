/**
 * Web push delivery (F3) - a real AlertChannel behind the same alert logic.
 * VAPID keys are generated once and live in app_settings (local-first, no
 * env needed). Sending requires the local server to be running and online;
 * delivery goes via the browser vendors' push relays, so the phone gets it
 * anywhere. Sam's phone is Android (Chrome push - no iOS quirks).
 */
import "server-only";
import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db, appSettings, pushSubscriptions, type PushSubscriptionRow } from "@/lib/db";
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
export function getVapidPublicKey(): string {
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

function configureVapid(): void {
  const pub = getVapidPublicKey();
  const priv = readSetting("vapidPrivateKey")!;
  webpush.setVapidDetails("mailto:samhayter.design@gmail.com", pub, priv);
}

export function saveSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  label?: string | null;
}): void {
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
}

export function removeSubscription(endpoint: string): void {
  db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).run();
}

export function listSubscriptions(): PushSubscriptionRow[] {
  return db.select().from(pushSubscriptions).all();
}

/**
 * Fan an alert out to every subscribed device. Dead subscriptions (404/410
 * from the push relay) are pruned. Failures never throw - push is a
 * best-effort channel on top of the inbox record.
 */
export async function sendPush(alert: Pick<IncomingAlert, "title" | "body" | "href" | "key">): Promise<{
  sent: number;
  pruned: number;
}> {
  const subs = listSubscriptions();
  if (subs.length === 0) return { sent: 0, pruned: 0 };
  configureVapid();

  const payload = JSON.stringify({
    title: alert.title,
    body: alert.body ?? "",
    href: alert.href ?? "/",
    tag: alert.key,
  });

  let sent = 0;
  let pruned = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 60 * 60 }
        );
        sent++;
        db.update(pushSubscriptions)
          .set({ lastOkAt: Date.now() })
          .where(eq(pushSubscriptions.id, sub.id))
          .run();
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          removeSubscription(sub.endpoint);
          pruned++;
        }
      }
    })
  );
  return { sent, pruned };
}
