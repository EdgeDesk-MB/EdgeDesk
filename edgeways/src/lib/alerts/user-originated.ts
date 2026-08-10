/**
 * Session markers for alerts caused by an explicit user action in this tab
 * (e.g. settling a bet). AlertWatcher delivers those as ephemeral toasts
 * (auto-dismiss, no close control) instead of sticky OnEvent alerts.
 */

const STORAGE_KEY = "edgeways-alerts-user-originated";

function readKeys(): Set<string> {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    return new Set(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function writeKeys(keys: Set<string>): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...keys].slice(-200)));
  } catch {
    /* private mode */
  }
}

/** Mark alert keys as user-originated so the next delivery is ephemeral. */
export function markUserOriginatedAlertKeys(keys: string[]): void {
  if (keys.length === 0) return;
  const store = readKeys();
  let dirty = false;
  for (const key of keys) {
    if (!key || store.has(key)) continue;
    store.add(key);
    dirty = true;
  }
  if (dirty) writeKeys(store);
}

/** Convenience: mark result_settled keys for the given bet ids. */
export function markUserSettledBetIds(betIds: Array<number | null | undefined>): void {
  markUserOriginatedAlertKeys(
    betIds
      .filter((id): id is number => typeof id === "number" && Number.isFinite(id))
      .map((id) => `result_settled:${id}`)
  );
}

export function isUserOriginatedAlertKey(key: string): boolean {
  return Boolean(key) && readKeys().has(key);
}

/** True once; removes the marker so a later automatic re-fire stays sticky. */
export function consumeUserOriginatedAlertKey(key: string): boolean {
  if (!key) return false;
  const store = readKeys();
  if (!store.has(key)) return false;
  store.delete(key);
  writeKeys(store);
  return true;
}
