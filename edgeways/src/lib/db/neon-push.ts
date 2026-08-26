/**
 * EDGE-110: hosted web push on Neon. Subscriptions are per-desk
 * (clerk_user_id): one customer's devices never receive another's alerts, and
 * the system feed poller fans out per owner via the explicit-user helpers.
 * VAPID keys are app-global and live in operator_settings (generated once,
 * then reused) so no env vars are needed; rotating them would orphan every
 * subscription, same as local.
 */
import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { getNeonDb } from "@/lib/db/neon";
import { neonDeskClerkUserId } from "@/lib/db/neon-desk";
import {
  operatorSettings as pgOperatorSettings,
  pushSubscriptions as pgPushSubscriptions,
} from "@/lib/db/schema.pg";
import { ensureNeonOperatorSettingsTable } from "@/lib/services/app-users";
import type { PushSubscriptionRow } from "@/lib/db/schema";
import type { PushFanoutResult } from "@/lib/services/push";

const VAPID_SETTINGS_KEY = "vapid_keys";
const VAPID_CONTACT = "mailto:samhayter.design@gmail.com";

/** Generate once, persist, reuse - rotating VAPID keys orphans subscriptions. */
export async function getNeonVapidKeys(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  await ensureNeonOperatorSettingsTable();
  const read = async () => {
    const rows = await getNeonDb()
      .select()
      .from(pgOperatorSettings)
      .where(eq(pgOperatorSettings.key, VAPID_SETTINGS_KEY))
      .limit(1);
    try {
      const parsed = JSON.parse(rows[0]?.value ?? "") as {
        publicKey?: string;
        privateKey?: string;
      };
      return parsed.publicKey && parsed.privateKey
        ? { publicKey: parsed.publicKey, privateKey: parsed.privateKey }
        : null;
    } catch {
      return null;
    }
  };

  const existing = await read();
  if (existing) return existing;

  const keys = webpush.generateVAPIDKeys();
  await getNeonDb()
    .insert(pgOperatorSettings)
    .values({
      key: VAPID_SETTINGS_KEY,
      value: JSON.stringify(keys),
      updatedAt: Date.now(),
    })
    .onConflictDoNothing({ target: pgOperatorSettings.key });
  // A concurrent instance may have won the insert; re-read so every instance
  // signs with the SAME keypair (losers must not keep their generated keys).
  return (await read()) ?? keys;
}

function toPushRow(row: typeof pgPushSubscriptions.$inferSelect): PushSubscriptionRow {
  return {
    id: row.id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    label: row.label,
    createdAt: row.createdAt,
    lastOkAt: row.lastOkAt,
  };
}

/** Every subscription owned by one desk. Poller-safe (explicit owner). */
export async function listNeonPushSubscriptionsForUser(
  clerkUserId: string
): Promise<PushSubscriptionRow[]> {
  const rows = await getNeonDb()
    .select()
    .from(pgPushSubscriptions)
    .where(eq(pgPushSubscriptions.clerkUserId, clerkUserId));
  return rows.map(toPushRow);
}

/** Desk-scoped: the signed-in user's devices. */
export async function listNeonPushSubscriptions(): Promise<PushSubscriptionRow[]> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return [];
  return listNeonPushSubscriptionsForUser(clerkUserId);
}

/**
 * Register (or refresh) this device for the signed-in desk. The endpoint is
 * globally unique, so a browser profile re-subscribing under a different
 * login moves the device to that desk.
 */
export async function saveNeonPushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  label?: string | null;
}): Promise<boolean> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return false;
  await getNeonDb()
    .insert(pgPushSubscriptions)
    .values({
      clerkUserId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      label: input.label ?? null,
      createdAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: pgPushSubscriptions.endpoint,
      set: {
        clerkUserId,
        p256dh: input.p256dh,
        auth: input.auth,
        label: input.label ?? null,
      },
    });
  return true;
}

/** Desk-scoped unsubscribe: a desk can only drop its own devices. */
export async function removeNeonPushSubscription(endpoint: string): Promise<void> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return;
  await getNeonDb()
    .delete(pgPushSubscriptions)
    .where(
      and(
        eq(pgPushSubscriptions.endpoint, endpoint),
        eq(pgPushSubscriptions.clerkUserId, clerkUserId)
      )
    );
}

/**
 * Fan a payload out to one owner's devices. Dead subscriptions (404/410 from
 * the push relay) are pruned. Never throws per-device - push is a best-effort
 * channel on top of the inbox record.
 */
export async function fanoutNeonPushToUser(
  clerkUserId: string,
  payload: string,
  ttlSeconds: number
): Promise<PushFanoutResult> {
  const subs = await listNeonPushSubscriptionsForUser(clerkUserId);
  if (subs.length === 0) return { sent: 0, pruned: 0, failed: 0, failures: [] };

  const vapid = await getNeonVapidKeys();
  webpush.setVapidDetails(VAPID_CONTACT, vapid.publicKey, vapid.privateKey);

  let sent = 0;
  let pruned = 0;
  let failed = 0;
  const failures: PushFanoutResult["failures"] = [];
  const okIds: number[] = [];
  const deadIds: number[] = [];
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: ttlSeconds }
        );
        sent++;
        okIds.push(sub.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode ?? null;
        const message = e instanceof Error ? e.message : String(e);
        if (status === 404 || status === 410) {
          deadIds.push(sub.id);
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
  if (okIds.length > 0) {
    await getNeonDb()
      .update(pgPushSubscriptions)
      .set({ lastOkAt: Date.now() })
      .where(inArray(pgPushSubscriptions.id, okIds));
  }
  if (deadIds.length > 0) {
    await getNeonDb()
      .delete(pgPushSubscriptions)
      .where(inArray(pgPushSubscriptions.id, deadIds));
  }
  return { sent, pruned, failed, failures };
}

/** Desk-scoped fanout: the signed-in user's devices. */
export async function fanoutNeonPush(
  payload: string,
  ttlSeconds: number
): Promise<PushFanoutResult> {
  const clerkUserId = neonDeskClerkUserId();
  if (!clerkUserId) return { sent: 0, pruned: 0, failed: 0, failures: [] };
  return fanoutNeonPushToUser(clerkUserId, payload, ttlSeconds);
}
