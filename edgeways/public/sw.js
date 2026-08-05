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
 * A single yellow-only notification is not available to web push on Android.
 * Bump NOTIF_V when assets change so clients pick up a new SW + fresh PNGs.
 */
const NOTIF_V = "notif5";
const NOTIFICATION_ICON = `/icon-192.png?v=${NOTIF_V}`;
const NOTIFICATION_BADGE = `/badge-192.png?v=${NOTIF_V}`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
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
      const origin = self.location.origin;
      const icon = data.icon
        ? data.icon.startsWith("http")
          ? data.icon
          : `${origin}${data.icon}`
        : `${origin}${NOTIFICATION_ICON}`;
      const badge = data.badge
        ? data.badge.startsWith("http")
          ? data.badge
          : `${origin}${data.badge}`
        : `${origin}${NOTIFICATION_BADGE}`;
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

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if ("focus" in win) {
          win.navigate(href);
          return win.focus();
        }
      }
      return self.clients.openWindow(href);
    })
  );
});
