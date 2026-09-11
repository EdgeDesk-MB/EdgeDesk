export type LiveEventKind =
  | "bet_created"
  | "offer_created"
  | "casino_created"
  | "signup"
  | "feed_warning"
  | "feed_critical"
  | "health_error";

export type LiveEventTone = "success" | "warning" | "error";

export const POSITIVE_LIVE_KINDS = [
  "bet_created",
  "offer_created",
  "casino_created",
  "signup",
] as const;

export type PositiveLiveKind = (typeof POSITIVE_LIVE_KINDS)[number];

export function isPositiveLiveKind(kind: LiveEventKind): kind is PositiveLiveKind {
  return (POSITIVE_LIVE_KINDS as readonly string[]).includes(kind);
}

export type LiveEvent = {
  id: string;
  kind: LiveEventKind;
  tone: LiveEventTone;
  at: number;
  title: string;
  body?: string;
  href: string;
  clerkUserId?: string;
  coalesceKey?: string;
};

export type LiveBundle = {
  id: string;
  kind: LiveEventKind;
  tone: LiveEventTone;
  title: string;
  body?: string;
  href: string;
  count: number;
  coalesceKey?: string;
};

export type LiveBundleConfig = {
  bundleStart: number;
  bundleHigh: number;
  windowMs: number;
};

export const DEFAULT_LIVE_BUNDLE_CONFIG: LiveBundleConfig = {
  bundleStart: 10,
  bundleHigh: 50,
  windowMs: 60 * 60 * 1000,
};

/** Skip catch-up rows older than this so Live does not look like activity just landed. */
export const LIVE_EVENT_FRESH_MS = 15 * 60 * 1000;

export type LiveBundleMemory = {
  window: Array<{ kind: PositiveLiveKind; at: number }>;
  critical: Record<string, "warning" | "error">;
};

export function emptyLiveBundleMemory(): LiveBundleMemory {
  return { window: [], critical: {} };
}

/** Drop coalesced keys that have returned to a healthy state. */
export function reconcileLiveCritical(
  memory: LiveBundleMemory,
  activeKeys: Iterable<string>
): LiveBundleMemory {
  const keep = new Set(activeKeys);
  const critical: LiveBundleMemory["critical"] = {};
  for (const [key, state] of Object.entries(memory.critical)) {
    if (keep.has(key)) critical[key] = state;
  }
  return { window: memory.window, critical };
}

export function pruneLiveWindow(
  window: LiveBundleMemory["window"],
  now: number,
  windowMs: number
): LiveBundleMemory["window"] {
  const cutoff = now - windowMs;
  return window.filter((row) => row.at >= cutoff);
}

/**
 * Highest digest threshold crossed when the rolling count moves from
 * `prev` to `next`. Under `bundleStart` there is no digest.
 */
export function crossedDigestCount(
  prev: number,
  next: number,
  start: number,
  high: number
): number | null {
  if (next < start) return null;
  const step = next < high ? start : high;
  const prevBucket = Math.floor(prev / step);
  const nextBucket = Math.floor(next / step);
  if (nextBucket > prevBucket) return nextBucket * step;
  if (prev < start && next >= start) return start;
  return null;
}

const DIGEST_NOUN: Record<PositiveLiveKind, { one: string; many: string }> = {
  bet_created: { one: "bet placed", many: "bets placed" },
  offer_created: { one: "sports offer created", many: "sports offers created" },
  casino_created: { one: "casino campaign created", many: "casino campaigns created" },
  signup: { one: "new account", many: "new accounts" },
};

const KIND_HREF: Record<LiveEventKind, string> = {
  bet_created: "/admin/activity",
  offer_created: "/admin/activity",
  casino_created: "/admin/activity",
  signup: "/admin/users",
  feed_warning: "/admin/feeds",
  feed_critical: "/admin/feeds",
  health_error: "/admin/health",
};

export function digestTitle(
  kind: PositiveLiveKind,
  count: number,
  windowMs: number
): string {
  const noun = count === 1 ? DIGEST_NOUN[kind].one : DIGEST_NOUN[kind].many;
  const windowLabel =
    windowMs === 60 * 60 * 1000
      ? "the past hour"
      : `the past ${Math.round(windowMs / 60_000)} minutes`;
  return `${count} ${noun} in ${windowLabel}`;
}

export function bundleNewEvents(input: {
  events: LiveEvent[];
  now: number;
  memory: LiveBundleMemory;
  config?: LiveBundleConfig;
}): { memory: LiveBundleMemory; bundles: LiveBundle[] } {
  const config = input.config ?? DEFAULT_LIVE_BUNDLE_CONFIG;
  const start = Math.max(2, config.bundleStart);
  const high = Math.max(start, config.bundleHigh);
  const windowMs = Math.max(60_000, config.windowMs);
  const sorted = [...input.events].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  let window = pruneLiveWindow(input.memory.window, input.now, windowMs);
  const critical = { ...input.memory.critical };
  const bundles: LiveBundle[] = [];

  const prevCounts = countByKind(window);
  const newcomers: Record<PositiveLiveKind, LiveEvent[]> = {
    bet_created: [],
    offer_created: [],
    casino_created: [],
    signup: [],
  };

  for (const event of sorted) {
    if (isPositiveLiveKind(event.kind)) {
      if (input.now - event.at > LIVE_EVENT_FRESH_MS) continue;
      window.push({ kind: event.kind, at: event.at });
      newcomers[event.kind].push(event);
      continue;
    }
    const key = event.coalesceKey ?? event.kind;
    const state = event.tone === "error" ? "error" : "warning";
    if (critical[key] === state) continue;
    critical[key] = state;
    bundles.push({
      id: event.id,
      kind: event.kind,
      tone: event.tone,
      title: event.title,
      body: event.body,
      href: event.href || KIND_HREF[event.kind],
      count: 1,
      coalesceKey: key,
    });
  }

  window = pruneLiveWindow(window, input.now, windowMs);
  const nextCounts = countByKind(window);

  for (const kind of POSITIVE_LIVE_KINDS) {
    const added = newcomers[kind];
    if (added.length === 0) continue;
    const prev = prevCounts[kind];
    const next = nextCounts[kind];
    if (next < start) {
      for (const event of added) {
        bundles.push({
          id: event.id,
          kind: event.kind,
          tone: "success",
          title: event.title,
          body: event.body,
          href: event.href || KIND_HREF[event.kind],
          count: 1,
        });
      }
      continue;
    }
    const crossed = crossedDigestCount(prev, next, start, high);
    if (crossed == null) continue;
    bundles.push({
      id: `digest:${kind}:${crossed}:${input.now}`,
      kind,
      tone: "success",
      title: digestTitle(kind, crossed, windowMs),
      href: KIND_HREF[kind],
      count: crossed,
    });
  }

  return { memory: { window, critical }, bundles };
}

export function adminLivePushTag(bundle: LiveBundle): string {
  if (bundle.coalesceKey) return `admin-live:${bundle.coalesceKey}`;
  if (bundle.count > 1) return `admin-live:digest:${bundle.kind}`;
  return `admin-live:${bundle.id}`;
}

/**
 * Log rows keep 10 then 20 as two entries. Push tags collapse same-kind
 * digests on purpose so the phone shade replaces.
 */
export function adminLiveLogDedupe(bundle: LiveBundle, now: number): string {
  if (bundle.coalesceKey) return `admin-live:${bundle.coalesceKey}`;
  if (bundle.count > 1) {
    const hour = Math.floor(now / 3_600_000);
    return `admin-live:digest:${bundle.kind}:${bundle.count}:${hour}`;
  }
  return `admin-live:${bundle.id}`;
}

function countByKind(
  window: LiveBundleMemory["window"]
): Record<PositiveLiveKind, number> {
  const counts: Record<PositiveLiveKind, number> = {
    bet_created: 0,
    offer_created: 0,
    casino_created: 0,
    signup: 0,
  };
  for (const row of window) counts[row.kind] += 1;
  return counts;
}
