import { excludedIdSet } from "@/lib/admin/exclude-accounts";
import { rankShare, type ShareSlice } from "@/lib/admin/series";
import { favouriteScopeStub } from "@/lib/events/fixture-scope";

const PIN_TONES = [
  "brand",
  "edge",
  "success",
  "warning",
  "muted",
  "destructive",
] as const;

export type ActivityPinDesk = {
  clerkUserId: string;
  football: string[];
  racing: string[];
};

export type ActivityPinAccount = {
  clerkUserId: string;
  email: string | null;
  plan: string;
  football: string[];
  racing: string[];
};

export type ActivityPinView = {
  desks: number;
  desksWithPins: number;
  footballPinCount: number;
  racingPinCount: number;
  footballShare: ShareSlice[];
  racingShare: ShareSlice[];
  rows: ActivityPinAccount[];
};

export function emptyActivityPinDesks(): ActivityPinDesk[] {
  return [];
}

export function emptyActivityPinView(): ActivityPinView {
  return {
    desks: 0,
    desksWithPins: 0,
    footballPinCount: 0,
    racingPinCount: 0,
    footballShare: [],
    racingShare: [],
    rows: [],
  };
}

export function filterActivityPins(
  pins: ActivityPinDesk[],
  skipIds: Iterable<string> | null
): ActivityPinDesk[] {
  if (!skipIds) return pins;
  const skip = skipIds instanceof Set ? skipIds : excludedIdSet(skipIds);
  if (skip.size === 0) return pins;
  return pins.filter((row) => !skip.has(row.clerkUserId));
}

export function footballPinLabel(id: string): string {
  return favouriteScopeStub(id).label;
}

export function racingPinLabel(id: string): string {
  return id.trim();
}

export function attachActivityPins(
  rows: Array<{ clerkUserId: string; email: string | null; plan?: string | null }>,
  pins: ActivityPinDesk[]
): ActivityPinAccount[] {
  const byUser = new Map(pins.map((row) => [row.clerkUserId, row]));
  return rows.map((row) => {
    const pin = byUser.get(row.clerkUserId);
    return {
      clerkUserId: row.clerkUserId,
      email: row.email,
      plan: row.plan?.trim() || "unset",
      football: pin?.football ?? [],
      racing: pin?.racing ?? [],
    };
  });
}

function shareFromPins(
  accounts: ActivityPinAccount[],
  kind: "football" | "racing"
): ShareSlice[] {
  const counts = new Map<string, number>();
  for (const account of accounts) {
    const ids = kind === "football" ? account.football : account.racing;
    for (const id of ids) {
      if (!id) continue;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return rankShare(
    [...counts.entries()].map(([key, value]) => ({
      key,
      label: kind === "football" ? footballPinLabel(key) : racingPinLabel(key),
      value,
    })),
    [...PIN_TONES]
  );
}

function pinCount(account: ActivityPinAccount): number {
  return account.football.length + account.racing.length;
}

export function buildActivityPinView(
  accounts: ActivityPinAccount[]
): ActivityPinView {
  const withPins = accounts
    .filter((account) => pinCount(account) > 0)
    .sort(
      (a, b) =>
        pinCount(b) - pinCount(a) ||
        (a.email ?? a.clerkUserId).localeCompare(b.email ?? b.clerkUserId)
    );
  return {
    desks: accounts.length,
    desksWithPins: withPins.length,
    footballPinCount: accounts.reduce((sum, row) => sum + row.football.length, 0),
    racingPinCount: accounts.reduce((sum, row) => sum + row.racing.length, 0),
    footballShare: shareFromPins(accounts, "football"),
    racingShare: shareFromPins(accounts, "racing"),
    rows: withPins,
  };
}
