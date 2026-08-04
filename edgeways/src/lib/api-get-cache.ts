/**
 * Module-level GET cache for client navigations. Survives route changes so
 * History / Casino / Accounts paint instantly on back-nav within the TTL.
 * Invalidated on any non-GET via {@link clearApiGetCache}.
 */

const DEFAULT_TTL_MS = 20_000;

const settled = new Map<string, { at: number; value: unknown }>();
const inFlight = new Map<string, Promise<unknown>>();

export function clearApiGetCache(prefix?: string): void {
  if (!prefix) {
    settled.clear();
    inFlight.clear();
    return;
  }
  for (const key of settled.keys()) {
    if (key.startsWith(prefix)) settled.delete(key);
  }
  for (const key of inFlight.keys()) {
    if (key.startsWith(prefix)) inFlight.delete(key);
  }
}

export function cachedGet<T>(
  path: string,
  fetcher: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  const hit = settled.get(path);
  if (hit && Date.now() - hit.at < ttlMs) {
    return Promise.resolve(hit.value as T);
  }

  const existing = inFlight.get(path);
  if (existing) return existing as Promise<T>;

  const request = fetcher()
    .then((value) => {
      settled.set(path, { at: Date.now(), value });
      return value;
    })
    .finally(() => {
      inFlight.delete(path);
    });

  inFlight.set(path, request);
  return request;
}
