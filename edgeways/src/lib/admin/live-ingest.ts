import "server-only";
import { readExcludedAccountIds } from "@/lib/admin/exclude-accounts-server";
import {
  bundleNewEvents,
  reconcileLiveCritical,
  type LiveBundle,
  type LiveBundleConfig,
  type LiveBundleMemory,
} from "@/lib/admin/live-bundle";
import {
  loadLiveActorContext,
  loadLiveSnapshot,
  loadPositiveLiveEventsInRange,
  windowKindsFromEvents,
} from "@/lib/admin/live-events";

export type AssembledLiveBundles = {
  bundles: LiveBundle[];
  memory: LiveBundleMemory;
  snapshotNow: number;
};

/**
 * Shared snapshot + hourly bundler for the Live log and owner push.
 * Always excludes admins and hidden test accounts, not the viewer cookie.
 */
export async function assembleLiveBundles(input: {
  since: number;
  now: number;
  pingNeon: boolean;
  critical: LiveBundleMemory["critical"];
  config: LiveBundleConfig;
}): Promise<AssembledLiveBundles> {
  const [excludedIds, context] = await Promise.all([
    readExcludedAccountIds(),
    loadLiveActorContext(),
  ]);
  const filter = {
    excludeAdmins: true as const,
    excludedIds: new Set(excludedIds),
    adminIds: context.filterBase.adminIds,
  };
  const windowStart = Math.max(0, input.now - input.config.windowMs);
  const [windowEvents, snapshot] = await Promise.all([
    input.since > windowStart
      ? loadPositiveLiveEventsInRange({
          from: windowStart,
          until: input.since,
          filter,
          emails: context.emails,
        })
      : Promise.resolve([]),
    loadLiveSnapshot({
      since: input.since,
      excludeAdmins: true,
      excludedIds,
      now: input.now,
      pingNeon: input.pingNeon,
    }),
  ]);

  const { bundles, memory } = bundleNewEvents({
    events: snapshot.events,
    now: input.now,
    memory: {
      window: windowKindsFromEvents(windowEvents),
      critical: input.critical,
    },
    config: input.config,
  });
  const reconciled = reconcileLiveCritical(memory, snapshot.activeCriticalKeys);
  return {
    bundles,
    memory: reconciled,
    snapshotNow: snapshot.now,
  };
}
