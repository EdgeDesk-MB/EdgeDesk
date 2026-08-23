/**
 * TTL caches for the operator-held exchange feeds.
 *
 * Betfair is served from one app key shared by every customer, so a per-request
 * fan-out to the API burns the operator's rate limit rather than the caller's.
 * These caches collapse that fan-out in-process, in the same shape as the
 * response caches in `apifootball.ts` / `theracingapi.ts`.
 *
 * Prices feed stake decisions, so a rejection is never cached. When upstream
 * fails, a value past its TTL is served instead (marked stale); with nothing
 * cached the error propagates exactly as it would without a cache.
 */

export interface PriceCacheEntry<T> {
  at: number;
  data: T;
}

export type PriceCache<T> = Map<string, PriceCacheEntry<T>>;

export interface CachedRead<T> {
  data: T;
  /** True when upstream failed and a value past its TTL was served instead. */
  stale: boolean;
}

/** Cached value while it is inside `ttlMs`, otherwise undefined. */
export function readFresh<T>(cache: PriceCache<T>, key: string, ttlMs: number): T | undefined {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  return undefined;
}

export function writeEntry<T>(cache: PriceCache<T>, key: string, data: T): void {
  cache.set(key, { at: Date.now(), data });
}

/** Fetch through a TTL cache, falling back to an expired entry on upstream failure. */
export async function cachedFetch<T>(
  cache: PriceCache<T>,
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<CachedRead<T>> {
  const fresh = readFresh(cache, key, ttlMs);
  if (fresh !== undefined) return { data: fresh, stale: false };

  try {
    const data = await fetcher();
    writeEntry(cache, key, data);
    return { data, stale: false };
  } catch (error) {
    const expired = cache.get(key);
    if (expired) return { data: expired.data, stale: true };
    throw error;
  }
}
