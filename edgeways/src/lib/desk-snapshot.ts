/**
 * Last-known /api/state for instant first paint. Pages read this while the
 * live snapshot revalidates in the background (stale-while-revalidate).
 */
import { jsonSnapshotUnchanged } from "@/lib/services/app-state-snapshot";
import { slimAppStateForWire } from "@/lib/services/app-state-wire";
import type { AppState } from "@/lib/services/state.types";

export const DESK_SNAPSHOT_KEY = "edgeways.deskSnapshot";
export const DESK_SNAPSHOT_VERSION = 1;

type DeskSnapshot = {
  v: typeof DESK_SNAPSHOT_VERSION;
  at: number;
  state: AppState;
};

let memory: AppState | null | undefined;

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<AppState>;
  return (
    Array.isArray(row.bets) &&
    Array.isArray(row.events) &&
    Array.isArray(row.offers) &&
    typeof row.settledProfit === "number" &&
    typeof row.provisionalProfit === "number" &&
    row.settings != null &&
    row.balances != null
  );
}

export function parseDeskSnapshot(raw: string | null): AppState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DeskSnapshot>;
    if (parsed.v !== DESK_SNAPSHOT_VERSION) return null;
    if (!isAppState(parsed.state)) return null;
    return parsed.state;
  } catch {
    return null;
  }
}

function readStored(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      sessionStorage.getItem(DESK_SNAPSHOT_KEY) ??
      localStorage.getItem(DESK_SNAPSHOT_KEY)
    );
  } catch {
    return null;
  }
}

export function readDeskSnapshot(): AppState | null {
  if (memory !== undefined) return memory;
  memory = parseDeskSnapshot(readStored());
  return memory;
}

/** Finished tape/XI stay on the match modal. Cache only what Home needs. */
export const slimDeskSnapshot = slimAppStateForWire;

function persist(raw: string): void {
  try {
    sessionStorage.setItem(DESK_SNAPSHOT_KEY, raw);
  } catch {
    /* private mode / quota */
  }
  try {
    localStorage.setItem(DESK_SNAPSHOT_KEY, raw);
  } catch {
    /* quota: session copy is enough for this tab */
  }
}

export function writeDeskSnapshot(state: AppState): void {
  if (typeof window === "undefined") return;
  const next = slimDeskSnapshot(state);
  if (memory != null && jsonSnapshotUnchanged(memory, next)) return;
  memory = next;
  persist(
    JSON.stringify({
      v: DESK_SNAPSHOT_VERSION,
      at: Date.now(),
      state: next,
    } satisfies DeskSnapshot)
  );
}

export function subscribeDeskSnapshot(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onChange = (event: StorageEvent) => {
    if (event.key != null && event.key !== DESK_SNAPSHOT_KEY) return;
    memory = undefined;
    onStoreChange();
  };
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
  };
}
