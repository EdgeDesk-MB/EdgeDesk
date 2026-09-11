/**
 * Module-level GET cache for client navigations. Survives route changes so
 * History / Casino / Accounts paint instantly on back-nav. Session storage
 * keeps the last payload across refresh; a stale hit paints immediately and
 * the next fetch updates in the background.
 */

const DEFAULT_TTL_MS = 20_000;
const PERSIST_KEY = "edgeways.apiGetCache.v1";

const settled = new Map<string, { at: number; value: unknown }>();
const inFlight = new Map<string, Promise<unknown>>();
let hydrated = false;

function hydrateFromSession(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = sessionStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const rows = JSON.parse(raw) as Array<{
      path: string;
      at: number;
      value: unknown;
    }>;
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      if (typeof row?.path !== "string" || typeof row.at !== "number") continue;
      settled.set(row.path, { at: row.at, value: row.value });
    }
  } catch {
    /* ignore a corrupt cache */
  }
}

function persistSettled(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      PERSIST_KEY,
      JSON.stringify(
        [...settled.entries()].map(([path, row]) => ({
          path,
          at: row.at,
          value: row.value,
        }))
      )
    );
  } catch {
    /* quota */
  }
}

export function clearApiGetCache(prefix?: string): void {
  if (!prefix) {
    settled.clear();
    inFlight.clear();
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(PERSIST_KEY);
      } catch {
        /* ignore */
      }
    }
    return;
  }
  for (const key of settled.keys()) {
    if (key.startsWith(prefix)) settled.delete(key);
  }
  for (const key of inFlight.keys()) {
    if (key.startsWith(prefix)) inFlight.delete(key);
  }
  persistSettled();
}

function beginFetch<T>(path: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(path);
  if (existing) return existing as Promise<T>;

  const request = fetcher()
    .then((value) => {
      settled.set(path, { at: Date.now(), value });
      persistSettled();
      return value;
    })
    .finally(() => {
      inFlight.delete(path);
    });

  inFlight.set(path, request);
  return request;
}

export function cachedGet<T>(
  path: string,
  fetcher: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  hydrateFromSession();
  const hit = settled.get(path);
  if (hit && Date.now() - hit.at < ttlMs) {
    return Promise.resolve(hit.value as T);
  }
  if (hit) {
    void beginFetch(path, fetcher).catch(() => {
      /* keep the last good payload */
    });
    return Promise.resolve(hit.value as T);
  }
  return beginFetch(path, fetcher);
}
