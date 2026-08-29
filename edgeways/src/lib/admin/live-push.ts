import "server-only";
import { assembleLiveBundles } from "@/lib/admin/live-ingest";
import { adminLivePushTag } from "@/lib/admin/live-bundle";
import { loadLiveActorContext } from "@/lib/admin/live-events";
import {
  liveBundleConfigFromSettings,
  readAdminLivePushCursor,
  readAdminLiveSettings,
  writeAdminLivePushCursor,
} from "@/lib/admin/live-settings";
import { sendPushToUser } from "@/lib/services/push";

export type AdminLivePushResult = {
  skipped: string | null;
  sent: number;
  bundles: number;
};

/**
 * Minute digest for owner devices. First run stores the cursor and sends
 * nothing, so a deploy does not dump an hour of backlog onto the phone.
 */
export async function runAdminLivePush(
  now = Date.now()
): Promise<AdminLivePushResult> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { skipped: "no_database_url", sent: 0, bundles: 0 };
  }

  const settings = await readAdminLiveSettings();
  if (!settings.pushEnabled) {
    return { skipped: "push_disabled", sent: 0, bundles: 0 };
  }

  const cursor = await readAdminLivePushCursor();
  if (cursor.since <= 0) {
    await writeAdminLivePushCursor({ since: now, critical: {} });
    return { skipped: "cursor_init", sent: 0, bundles: 0 };
  }

  const { ownerClerkUserIds } = await loadLiveActorContext();
  if (ownerClerkUserIds.length === 0) {
    await writeAdminLivePushCursor({ since: now, critical: cursor.critical });
    return { skipped: "no_owner", sent: 0, bundles: 0 };
  }

  const assembled = await assembleLiveBundles({
    since: cursor.since,
    now,
    pingNeon: true,
    critical: cursor.critical,
    config: liveBundleConfigFromSettings(settings),
  });

  let sent = 0;
  for (const bundle of assembled.bundles) {
    const alert = {
      title: bundle.title,
      body: bundle.body ?? "",
      href: bundle.href,
      key: adminLivePushTag(bundle),
    };
    for (const clerkUserId of ownerClerkUserIds) {
      const result = await sendPushToUser(clerkUserId, alert);
      sent += result.sent;
    }
  }

  await writeAdminLivePushCursor({
    since: assembled.snapshotNow,
    critical: assembled.memory.critical,
  });
  return { skipped: null, sent, bundles: assembled.bundles.length };
}
