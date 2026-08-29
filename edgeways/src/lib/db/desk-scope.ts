/**
 * Local stand-in for per-login desks. Hosted Neon keys bets by clerk user
 * when EDGEWAYS_DESK_BACKEND=neon (EDGE-47). This file stays Clerk-free so
 * `@/lib/db` stays importable in Vitest.
 * One Mac, one Next process, several Clerk accounts: each login opens its
 * own SQLite file. The filled dogfood desk stays on data/edgeways.db for
 * EDGEWAYS_DESK_OWNER_EMAIL (default samhayter.design@gmail.com).
 *
 * This file is Clerk-free so `@/lib/db` stays importable in Vitest.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import path from "node:path";

export type DeskActor = {
  clerkUserId: string | null;
  email: string | null;
  /**
   * Hosted Neon desk id. Clerk Development and Production issue different
   * user ids for the same email; when set, bets/offers follow this id.
   */
  neonClerkUserId?: string | null;
};

export type NeonDeskCandidate = {
  clerkUserId: string;
  createdAt: number;
  offerCount: number;
};

/**
 * When the same email exists on more than one Clerk instance, pick the desk
 * that already has the data. Prefer an explicit owner id when it is one of
 * the candidates, otherwise the busiest desk, then the newest account row.
 */
export function pickCanonicalNeonClerkUserId(input: {
  signedInUserId: string;
  preferredUserId?: string | null;
  candidates: NeonDeskCandidate[];
}): string {
  const signedIn = input.signedInUserId.trim();
  const candidates = input.candidates.filter((row) => row.clerkUserId.trim());
  if (!signedIn) return signedIn;
  if (candidates.length === 0) return signedIn;
  if (candidates.length === 1) return candidates[0]!.clerkUserId.trim();

  const preferred = input.preferredUserId?.trim();
  if (preferred && candidates.some((row) => row.clerkUserId.trim() === preferred)) {
    return preferred;
  }

  return [...candidates].sort((a, b) => {
    if (b.offerCount !== a.offerCount) return b.offerCount - a.offerCount;
    if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
    return a.clerkUserId.localeCompare(b.clerkUserId);
  })[0]!.clerkUserId.trim();
}

export const DEFAULT_DESK_OWNER_EMAIL = "samhayter.design@gmail.com";

const storage = new AsyncLocalStorage<DeskActor>();

export function deskOwnerEmail(): string {
  return (
    process.env.EDGEWAYS_DESK_OWNER_EMAIL?.trim().toLowerCase() ||
    DEFAULT_DESK_OWNER_EMAIL
  );
}

export function normaliseDeskEmail(
  email: string | null | undefined
): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export function isDeskOwnerEmail(email: string | null | undefined): boolean {
  const value = normaliseDeskEmail(email);
  return value != null && value === deskOwnerEmail();
}

export function deskOwnerUserId(): string | null {
  const id = process.env.EDGEWAYS_DESK_OWNER_USER_ID?.trim();
  return id || null;
}

export function isDeskOwner(actor: DeskActor): boolean {
  if (isDeskOwnerEmail(actor.email)) return true;
  const ownerId = deskOwnerUserId();
  return Boolean(ownerId && actor.clerkUserId && actor.clerkUserId === ownerId);
}

export function getDeskActor(): DeskActor {
  return (
    storage.getStore() ?? {
      clerkUserId: null,
      email: null,
      neonClerkUserId: null,
    }
  );
}

export function runWithDeskActor<T>(actor: DeskActor, fn: () => T): T {
  const clerkUserId = actor.clerkUserId?.trim() || null;
  const neonClerkUserId = actor.neonClerkUserId?.trim() || null;
  return storage.run(
    {
      clerkUserId,
      email: normaliseDeskEmail(actor.email),
      neonClerkUserId: neonClerkUserId || clerkUserId,
    },
    fn
  );
}

export function primaryClerkEmail(
  user: {
    primaryEmailAddress?: { emailAddress: string } | null;
    emailAddresses?: Array<{ emailAddress: string }>;
  } | null
): string | null {
  return normaliseDeskEmail(
    user?.primaryEmailAddress?.emailAddress ??
      user?.emailAddresses?.[0]?.emailAddress ??
      null
  );
}

/** Safe filename fragment from a Clerk user id. */
export function deskFileToken(clerkUserId: string): string {
  const token = clerkUserId.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  return token || "unknown";
}

export type DeskFileKind = "override" | "demo" | "owner" | "user" | "unsigned";

export function deskFileKind(
  actor: DeskActor
): Exclude<DeskFileKind, "override" | "demo"> {
  if (isDeskOwner(actor)) return "owner";
  if (actor.clerkUserId) return "user";
  return "unsigned";
}

/**
 * Pure path picker. Tests and resolveDbPath share this so EDGEWAYS_DB_PATH
 * and the G2 demo marker still win over login scoping.
 */
export function resolveScopedDbPath(input: {
  dataDir: string;
  actor: DeskActor;
  override?: string | null;
  demoMarker?: boolean;
}): { kind: DeskFileKind; dbPath: string } {
  const override = input.override?.trim();
  if (override) {
    return { kind: "override", dbPath: path.resolve(override) };
  }
  if (input.demoMarker) {
    return { kind: "demo", dbPath: path.join(input.dataDir, "edgeways-demo.db") };
  }
  const kind = deskFileKind(input.actor);
  if (kind === "owner") {
    return { kind, dbPath: path.join(input.dataDir, "edgeways.db") };
  }
  if (kind === "user" && input.actor.clerkUserId) {
    return {
      kind,
      dbPath: path.join(
        input.dataDir,
        "desks",
        `${deskFileToken(input.actor.clerkUserId)}.db`
      ),
    };
  }
  return {
    kind: "unsigned",
    dbPath: path.join(input.dataDir, "desks", "unsigned.db"),
  };
}
