/**
 * Client-side alert dedupe (sessionStorage). Shared by AlertWatcher and
 * surfaces that mute a condition (e.g. Intentional on naked exposure) so a
 * race on the next poll cannot re-notify after the user has already answered.
 */

const SEEN_KEY = "edgeways-alerts-seen";

/** Test helper - clear session dedupe between vitest cases. */
export function resetSeenForTests(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(SEEN_KEY);
  } catch {
    /* private mode */
  }
}

export function readSeenAlertKeys(): Set<string> {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function storeSeenAlertKeys(seen: Set<string>): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-500)));
  } catch {
    /* private mode */
  }
}

/** Mark keys as already delivered so AlertWatcher will not notify them again. */
export function suppressAlertKeys(keys: string[]): void {
  if (keys.length === 0) return;
  const seen = readSeenAlertKeys();
  let dirty = false;
  for (const key of keys) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    dirty = true;
  }
  if (dirty) storeSeenAlertKeys(seen);
}

/** Close any open browser / service-worker notifications with these tags. */
export async function dismissBrowserNotifications(tags: string[]): Promise<void> {
  if (typeof window === "undefined" || tags.length === 0) return;
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg?.getNotifications) return;
    for (const tag of tags) {
      const open = await reg.getNotifications({ tag });
      for (const n of open) n.close();
    }
  } catch {
    /* unsupported / denied */
  }
}

/**
 * Close local notifications and ask the server to fan a dismiss push to every
 * subscribed device (phone shade clears when you actioned the prompt on web).
 */
export async function dismissAlertNotifications(tags: string[]): Promise<void> {
  const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
  if (clean.length === 0) return;
  void dismissBrowserNotifications(clean);
  try {
    await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dismiss: clean }),
    });
  } catch {
    /* offline / server down - local close still happened */
  }
}
