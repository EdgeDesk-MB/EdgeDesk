/**
 * EdgeDesk service worker - minimal v1 (C4).
 * Exists for PWA installability and as the future hook for web push (B5/B6
 * sentinels swap the local Notification channel for push without touching
 * alert-rule logic). No offline caching yet: the app is local-first and the
 * dev/local server is the data source.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// F3: background push - the server signs alerts with VAPID and this shows
// them even with every EdgeDesk tab closed.
self.addEventListener("push", (event) => {
  let data = { title: "EdgeDesk", body: "", href: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    /* non-JSON payload - show the fallback */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || undefined,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { href: data.href },
      tag: data.tag || undefined,
    })
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
