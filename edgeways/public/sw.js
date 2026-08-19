/**
 * Edgeways service worker - minimal v1 (C4).
 * Exists for PWA installability and as the future hook for web push (B5/B6
 * sentinels swap the local Notification channel for push without touching
 * alert-rule logic). No offline caching yet: the app is local-first and the
 * dev/local server is the data source.
 *
 * Android Chrome always draws TWO icon slots in the shade:
 *   badge (left / status) → monochrome only; omit it and you get the default bell
 *   icon  (right / large) → full colour yellow plate + #111 bolt (mark.svg)
 * A single yellow-only notification is not available to web push on Android,
 * and the right slot cannot be hidden - omitting `icon` yields a letter avatar.
 * Bump NOTIF_V when assets change so clients pick up a new SW + fresh PNGs.
 *
 * Icons are precached and shown via blob URLs so push art still works when the
 * home server is unreachable (push arrives via the browser relay offline).
 */
const NOTIF_V = "notif6";
const NOTIFICATION_ICON = `/icon-192.png?v=${NOTIF_V}`;
const NOTIFICATION_BADGE = `/badge-192.png?v=${NOTIF_V}`;
const NOTIF_CACHE = `edgeways-notif-${NOTIF_V}`;

function absUrl(pathOrUrl) {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  return `${self.location.origin}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

async function precacheNotificationArt() {
  const cache = await caches.open(NOTIF_CACHE);
  const urls = [absUrl(NOTIFICATION_ICON), absUrl(NOTIFICATION_BADGE)];
  await Promise.all(
    urls.map(async (url) => {
      if (!url) return;
      try {
        const res = await fetch(url, { cache: "reload" });
        if (res.ok) await cache.put(url, res.clone());
      } catch {
        /* install may be offline - push handler retries */
      }
    })
  );
}

/** Resolve a notification asset to a blob: URL from cache (or network). */
async function notificationAssetUrl(pathOrUrl) {
  const url = absUrl(pathOrUrl);
  if (!url) return undefined;
  const cache = await caches.open(NOTIF_CACHE);
  let res = await cache.match(url);
  if (!res) {
    try {
      res = await fetch(url);
      if (res.ok) await cache.put(url, res.clone());
    } catch {
      return url;
    }
  }
  if (!res || !res.ok) return url;
  try {
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return url;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await precacheNotificationArt();
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("edgeways-notif-") && k !== NOTIF_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// F3: background push - the server signs alerts with VAPID and this shows
// them even with every Edgeways tab closed. A dismiss payload closes by tag
// when the condition was resolved elsewhere (e.g. offer claimed on desktop).
self.addEventListener("push", (event) => {
  let data = { title: "⚡ edgeways", body: "", href: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    /* non-JSON payload - show the fallback */
  }
  event.waitUntil(
    (async () => {
      if (data.action === "dismiss") {
        const tags = Array.isArray(data.tags)
          ? data.tags
          : data.tag
            ? [data.tag]
            : [];
        for (const tag of tags) {
          if (!tag) continue;
          const open = await self.registration.getNotifications({ tag });
          for (const n of open) n.close();
        }
        return;
      }
      const iconPath = data.icon || NOTIFICATION_ICON;
      const badgePath = data.badge || NOTIFICATION_BADGE;
      const [icon, badge] = await Promise.all([
        notificationAssetUrl(iconPath),
        notificationAssetUrl(badgePath),
      ]);
      await self.registration.showNotification(data.title, {
        body: data.body || undefined,
        icon,
        badge,
        data: { href: data.href },
        tag: data.tag || undefined,
        // Same tag replaces the previous shade entry (stops test-push spam).
        renotify: Boolean(data.tag),
      });
    })()
  );
});

function markAlertRead(tag) {
  if (!tag || tag === "edgeways-test-push") return Promise.resolve();
  return fetch("/api/alerts", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ dedupe: tag, read: true }),
  }).catch(() => {});
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/";
  const tag = event.notification.tag;
  event.waitUntil(
    Promise.all([
      markAlertRead(tag),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
        for (const win of wins) {
          if ("focus" in win) {
            win.navigate(href);
            return win.focus();
          }
        }
        return self.clients.openWindow(href);
      }),
    ])
  );
});

// User swipe-away (or click-close). Ignore replacements of the same tag.
self.addEventListener("notificationclose", (event) => {
  const tag = event.notification.tag;
  if (!tag || tag === "edgeways-test-push") return;
  event.waitUntil(
    (async () => {
      const stillOpen = await self.registration.getNotifications({ tag });
      if (stillOpen.length > 0) return;
      await markAlertRead(tag);
    })()
  );
});
