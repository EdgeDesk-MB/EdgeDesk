/** One quiet update reload per tab in this window. Back-to-back deploys land as one. */
export const UPDATE_RELOAD_COOLDOWN_MS = 10 * 60_000;
/** One silent chunk-failure reload per tab in this window, so a bad deploy cannot loop. */
export const CHUNK_RELOAD_COOLDOWN_MS = 5 * 60_000;

export const UPDATE_RELOAD_KEY = "edgeways:update-reload-at";
export const CHUNK_RELOAD_KEY = "edgeways:chunk-reload-at";

export type ReloadGuardStore = Pick<Storage, "getItem" | "setItem">;

export function sessionReloadStore(): ReloadGuardStore | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function reloadGuardOpen(
  store: ReloadGuardStore | null,
  key: string,
  cooldownMs: number,
  now: number
): boolean {
  if (!store) return false;
  try {
    const raw = store.getItem(key);
    if (!raw) return true;
    const at = Number(raw);
    if (!Number.isFinite(at)) return true;
    return now - at >= cooldownMs;
  } catch {
    return false;
  }
}

/**
 * Take the reload slot for this tab. False when the cooldown is running or
 * the stamp cannot be stored: without a stored stamp there is no loop guard,
 * so we never reload.
 */
export function claimReloadGuard(
  store: ReloadGuardStore | null,
  key: string,
  cooldownMs: number,
  now: number
): boolean {
  if (!store || !reloadGuardOpen(store, key, cooldownMs, now)) return false;
  try {
    const stamp = String(now);
    store.setItem(key, stamp);
    return store.getItem(key) === stamp;
  } catch {
    return false;
  }
}

const CHUNK_ERROR_MESSAGES = [
  /Loading (CSS )?chunk \S+ failed/i,
  /Failed to load chunk/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
];

export function isChunkLoadError(reason: unknown): boolean {
  if (!reason) return false;
  if (typeof reason === "string") {
    return CHUNK_ERROR_MESSAGES.some((re) => re.test(reason));
  }
  if (typeof reason !== "object") return false;
  const { name, message } = reason as { name?: unknown; message?: unknown };
  if (name === "ChunkLoadError") return true;
  return (
    typeof message === "string" &&
    CHUNK_ERROR_MESSAGES.some((re) => re.test(message))
  );
}

export function isNextChunkAssetUrl(url: string | null | undefined): boolean {
  return Boolean(url && /\/_next\/static\/(chunks|css)\//.test(url));
}

/**
 * Where a link click should hard-navigate so a pending update applies on the
 * way. Null for anything the router should keep: other origins, new tabs,
 * downloads and same-page hash or query changes.
 */
export function quietReloadLinkTarget(
  link: { href: string; target?: string | null; download?: boolean },
  currentHref: string
): string | null {
  if (link.download) return null;
  if (link.target && link.target !== "_self") return null;
  let next: URL;
  let here: URL;
  try {
    here = new URL(currentHref);
    next = new URL(link.href, here);
  } catch {
    return null;
  }
  if (next.protocol !== "http:" && next.protocol !== "https:") return null;
  if (next.origin !== here.origin) return null;
  if (next.pathname === here.pathname) return null;
  return next.href;
}

/** Full load of the new build. Hands the waiting service worker over first. */
export async function reloadForUpdate(nextHref?: string): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
    }
  } catch {
    // The load still picks up the new documents.
  }
  if (nextHref) window.location.assign(nextHref);
  else window.location.reload();
}

/** Reload once, silently, when a JS or CSS chunk failed to load. */
export function recoverFromChunkLoadError(reason: unknown): boolean {
  if (!isChunkLoadError(reason)) return false;
  return reloadAfterChunkFailure();
}

export function reloadAfterChunkFailure(): boolean {
  if (
    !claimReloadGuard(
      sessionReloadStore(),
      CHUNK_RELOAD_KEY,
      CHUNK_RELOAD_COOLDOWN_MS,
      Date.now()
    )
  ) {
    return false;
  }
  window.location.reload();
  return true;
}
