import "server-only";
import { and, gt, isNotNull, lte, sql } from "drizzle-orm";
import { loadFeedMonitor, type FeedMonitor } from "@/lib/admin/feeds";
import { loadHealthReport, type HealthReport } from "@/lib/admin/health";
import {
  isPositiveLiveKind,
  type LiveEvent,
  type LiveEventKind,
  type PositiveLiveKind,
} from "@/lib/admin/live-bundle";
import { getNeonDb } from "@/lib/db/neon";
import { appUsers, bets, casinoOffers, offers } from "@/lib/db/schema.pg";
import { listAppUsers } from "@/lib/services/app-users";

export const LIVE_EVENT_CAP = 200;

export type LiveActorFilter = {
  excludeAdmins: boolean;
  excludedIds: ReadonlySet<string>;
  adminIds: ReadonlySet<string>;
};

export type LiveFingerprintParts = {
  bets: { n: number; maxAt: number };
  offers: { n: number; maxAt: number };
  casino: { n: number; maxAt: number };
  signups: { n: number; maxAt: number };
  footballUsed: number;
  racingUsed: number;
  health: string;
};

export type LiveSnapshot = {
  now: number;
  fingerprint: string;
  events: LiveEvent[];
  activeCriticalKeys: string[];
};

type VolumeRow = {
  id: string;
  at: number;
  clerkUserId: string;
};

function usesHostedVolume(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function keepPositiveLiveActor(
  clerkUserId: string,
  filter: LiveActorFilter
): boolean {
  if (filter.excludedIds.has(clerkUserId)) return false;
  if (filter.excludeAdmins && filter.adminIds.has(clerkUserId)) return false;
  return true;
}

export function serialiseLiveFingerprint(parts: LiveFingerprintParts): string {
  return [
    parts.bets.n,
    parts.bets.maxAt,
    parts.offers.n,
    parts.offers.maxAt,
    parts.casino.n,
    parts.casino.maxAt,
    parts.signups.n,
    parts.signups.maxAt,
    parts.footballUsed,
    parts.racingUsed,
    parts.health,
  ].join(":");
}

function displayEmail(
  email: string | null | undefined,
  clerkUserId: string
): string {
  const trimmed = email?.trim();
  return trimmed ? trimmed : clerkUserId;
}

const POSITIVE_COPY: Record<
  PositiveLiveKind,
  { title: (email: string) => string; href: string }
> = {
  bet_created: {
    title: (email) => `Bet placed · ${email}`,
    href: "/admin/activity",
  },
  offer_created: {
    title: (email) => `Sports offer created · ${email}`,
    href: "/admin/activity",
  },
  casino_created: {
    title: (email) => `Casino campaign created · ${email}`,
    href: "/admin/activity",
  },
  signup: {
    title: (email) => `New account · ${email}`,
    href: "/admin/users",
  },
};

export function volumeRowToLiveEvent(input: {
  kind: PositiveLiveKind;
  row: VolumeRow;
  email: string | null | undefined;
}): LiveEvent {
  const copy = POSITIVE_COPY[input.kind];
  const email = displayEmail(input.email, input.row.clerkUserId);
  return {
    id: `${input.kind}:${input.row.id}`,
    kind: input.kind,
    tone: "success",
    at: input.row.at,
    title: copy.title(email),
    href: copy.href,
    clerkUserId: input.row.clerkUserId,
  };
}

export function feedLaneLiveEvents(monitor: FeedMonitor): LiveEvent[] {
  const events: LiveEvent[] = [];
  for (const lane of [
    { key: "football", label: "Football", used: monitor.football.used, cap: monitor.football.cap, state: monitor.football.state },
    { key: "racing", label: "Racing", used: monitor.racing.used, cap: monitor.racing.cap, state: monitor.racing.state },
  ] as const) {
    if (lane.state === "ok") continue;
    const pct = lane.cap > 0 ? Math.round((lane.used / lane.cap) * 100) : 100;
    const critical = lane.state === "critical";
    events.push({
      id: `feed:${lane.key}:${lane.state}`,
      kind: critical ? "feed_critical" : "feed_warning",
      tone: critical ? "error" : "warning",
      at: Date.now(),
      title: `${lane.label} feed at ${pct}% of cap`,
      href: "/admin/feeds",
      coalesceKey: `feed:${lane.key}`,
    });
  }
  return events;
}

export function healthDownLiveEvents(report: HealthReport): LiveEvent[] {
  return report.checks
    .filter((check) => check.status === "down")
    .map((check) => ({
      id: `health:${check.key}:${report.generatedAt}`,
      kind: "health_error" as LiveEventKind,
      tone: "error" as const,
      at: report.generatedAt,
      title: `${check.label} is down`,
      body: check.detail,
      href: "/admin/health",
      coalesceKey: `health:${check.key}`,
    }));
}

export function activeCriticalKeysFromEvents(events: LiveEvent[]): string[] {
  const keys = new Set<string>();
  for (const event of events) {
    if (event.coalesceKey && event.tone !== "success") keys.add(event.coalesceKey);
  }
  return [...keys];
}

function emptyAgg(): { n: number; maxAt: number } {
  return { n: 0, maxAt: 0 };
}

async function volumeAgg(
  table: typeof bets | typeof offers | typeof casinoOffers | typeof appUsers
): Promise<{ n: number; maxAt: number }> {
  const rows = await getNeonDb()
    .select({
      n: sql<number>`count(*)::int`,
      maxAt: sql<number>`coalesce(max(created_at), 0)`,
    })
    .from(table);
  return {
    n: Number(rows[0]?.n ?? 0) || 0,
    maxAt: Number(rows[0]?.maxAt ?? 0) || 0,
  };
}

function mapVolumeRows(
  rows: Array<{ id: string | number; at: number; clerkUserId: string | null }>
): VolumeRow[] {
  const out: VolumeRow[] = [];
  for (const row of rows) {
    if (!row.clerkUserId || !Number.isFinite(row.at) || row.at <= 0) continue;
    out.push({
      id: String(row.id),
      at: row.at,
      clerkUserId: row.clerkUserId,
    });
  }
  return out;
}

async function betRowsSince(since: number, until: number, cap: number): Promise<VolumeRow[]> {
  const rows = await getNeonDb()
    .select({ id: bets.id, at: bets.createdAt, clerkUserId: bets.clerkUserId })
    .from(bets)
    .where(and(isNotNull(bets.clerkUserId), gt(bets.createdAt, since), lte(bets.createdAt, until)))
    .orderBy(sql`${bets.createdAt} desc`)
    .limit(cap);
  return mapVolumeRows(rows);
}

async function offerRowsSince(since: number, until: number, cap: number): Promise<VolumeRow[]> {
  const rows = await getNeonDb()
    .select({ id: offers.id, at: offers.createdAt, clerkUserId: offers.clerkUserId })
    .from(offers)
    .where(and(isNotNull(offers.clerkUserId), gt(offers.createdAt, since), lte(offers.createdAt, until)))
    .orderBy(sql`${offers.createdAt} desc`)
    .limit(cap);
  return mapVolumeRows(rows);
}

async function casinoRowsSince(since: number, until: number, cap: number): Promise<VolumeRow[]> {
  const rows = await getNeonDb()
    .select({
      id: casinoOffers.id,
      at: casinoOffers.createdAt,
      clerkUserId: casinoOffers.clerkUserId,
    })
    .from(casinoOffers)
    .where(
      and(
        isNotNull(casinoOffers.clerkUserId),
        gt(casinoOffers.createdAt, since),
        lte(casinoOffers.createdAt, until)
      )
    )
    .orderBy(sql`${casinoOffers.createdAt} desc`)
    .limit(cap);
  return mapVolumeRows(rows);
}

async function signupRowsSince(since: number, until: number, cap: number): Promise<VolumeRow[]> {
  const rows = await getNeonDb()
    .select({
      id: appUsers.clerkUserId,
      at: appUsers.createdAt,
      clerkUserId: appUsers.clerkUserId,
    })
    .from(appUsers)
    .where(and(gt(appUsers.createdAt, since), lte(appUsers.createdAt, until)))
    .orderBy(sql`${appUsers.createdAt} desc`)
    .limit(cap);
  return mapVolumeRows(rows);
}

function toPositiveEvents(
  kind: PositiveLiveKind,
  rows: VolumeRow[],
  emails: Map<string, string | null>,
  filter: LiveActorFilter
): LiveEvent[] {
  const events: LiveEvent[] = [];
  for (const row of rows) {
    if (!keepPositiveLiveActor(row.clerkUserId, filter)) continue;
    events.push(
      volumeRowToLiveEvent({
        kind,
        row,
        email: emails.get(row.clerkUserId) ?? null,
      })
    );
  }
  return events;
}

export async function loadPositiveLiveEventsInRange(input: {
  from: number;
  until: number;
  filter: LiveActorFilter;
  emails: Map<string, string | null>;
  cap?: number;
}): Promise<LiveEvent[]> {
  if (!usesHostedVolume() || input.until <= input.from) return [];
  const cap = input.cap ?? LIVE_EVENT_CAP;
  const [betRows, offerRows, casinoRows, signupRows] = await Promise.all([
    betRowsSince(input.from, input.until, cap),
    offerRowsSince(input.from, input.until, cap),
    casinoRowsSince(input.from, input.until, cap),
    signupRowsSince(input.from, input.until, cap),
  ]);
  return [
    ...toPositiveEvents("bet_created", betRows, input.emails, input.filter),
    ...toPositiveEvents("offer_created", offerRows, input.emails, input.filter),
    ...toPositiveEvents("casino_created", casinoRows, input.emails, input.filter),
    ...toPositiveEvents("signup", signupRows, input.emails, input.filter),
  ].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

export async function loadLiveActorContext(): Promise<{
  filterBase: Omit<LiveActorFilter, "excludeAdmins">;
  emails: Map<string, string | null>;
  ownerClerkUserIds: string[];
}> {
  const users = await listAppUsers();
  const emails = new Map<string, string | null>();
  const adminIds = new Set<string>();
  const ownerClerkUserIds: string[] = [];
  for (const user of users) {
    emails.set(user.clerkUserId, user.email);
    if (user.admin) adminIds.add(user.clerkUserId);
    if (user.owner) ownerClerkUserIds.push(user.clerkUserId);
  }
  return {
    filterBase: { excludedIds: new Set(), adminIds },
    emails,
    ownerClerkUserIds,
  };
}

export async function loadLiveSnapshot(input: {
  since: number;
  excludeAdmins: boolean;
  excludedIds: readonly string[];
  now?: number;
  pingNeon?: boolean;
}): Promise<LiveSnapshot> {
  const now = input.now ?? Date.now();
  const since = Math.min(Math.max(0, Math.floor(input.since)), now);
  const [{ filterBase, emails }, health, feedMonitor] = await Promise.all([
    loadLiveActorContext(),
    loadHealthReport({ pingNeon: input.pingNeon === true }),
    loadFeedMonitor(),
  ]);
  const filter: LiveActorFilter = {
    ...filterBase,
    excludedIds: new Set(input.excludedIds),
    excludeAdmins: input.excludeAdmins,
  };

  const volumeFingerprint = usesHostedVolume()
    ? await Promise.all([
        volumeAgg(bets),
        volumeAgg(offers),
        volumeAgg(casinoOffers),
        volumeAgg(appUsers),
      ]).then(([betsAgg, offersAgg, casinoAgg, signupsAgg]) => ({
        bets: betsAgg,
        offers: offersAgg,
        casino: casinoAgg,
        signups: signupsAgg,
      }))
    : {
        bets: emptyAgg(),
        offers: emptyAgg(),
        casino: emptyAgg(),
        signups: emptyAgg(),
      };

  const opsEvents = [
    ...feedLaneLiveEvents(feedMonitor),
    ...healthDownLiveEvents(health),
  ];
  const positive =
    since < now
      ? await loadPositiveLiveEventsInRange({
          from: since,
          until: now,
          filter,
          emails,
        })
      : [];

  const fingerprint = serialiseLiveFingerprint({
    ...volumeFingerprint,
    footballUsed: feedMonitor.football.used,
    racingUsed: feedMonitor.racing.used,
    health: health.overall,
  });

  return {
    now,
    fingerprint,
    events: [...positive, ...opsEvents],
    activeCriticalKeys: activeCriticalKeysFromEvents(opsEvents),
  };
}

export function windowKindsFromEvents(
  events: LiveEvent[]
): Array<{ kind: PositiveLiveKind; at: number }> {
  const rows: Array<{ kind: PositiveLiveKind; at: number }> = [];
  for (const event of events) {
    if (isPositiveLiveKind(event.kind)) {
      rows.push({ kind: event.kind, at: event.at });
    }
  }
  return rows;
}
