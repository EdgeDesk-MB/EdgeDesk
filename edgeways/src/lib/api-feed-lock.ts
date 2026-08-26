/**
 * Structured 403 from EDGE-83 feed guards. `api()` returns the body instead
 * of throwing so demo / empty fallbacks still paint.
 */
export function parseLockedFeedBody<T>(status: number, text: string): T | null {
  if (status !== 403) return null;
  try {
    const json: unknown = JSON.parse(text);
    if (
      json &&
      typeof json === "object" &&
      (json as { source?: unknown }).source === "locked"
    ) {
      return json as T;
    }
  } catch {
    return null;
  }
  return null;
}
