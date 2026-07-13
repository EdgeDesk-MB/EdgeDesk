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

// Future: push + notificationclick handlers land here with Phase 4.
