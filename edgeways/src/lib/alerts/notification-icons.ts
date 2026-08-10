/**
 * Web-notification art (Android shade has two slots):
 *   badge — monochrome white bolt on transparent (omit → system bell)
 *   icon  — yellow plate + ink bolt (square logo). Cannot be hidden on
 *           Chrome Android; omitting it yields a letter avatar.
 *
 * Lightning bolt is the default for every push. Per-kind icon/colour
 * overrides can ride on the push payload later (`icon` / `badge` URLs);
 * keep the bolt as the fallback.
 *
 * Bump the version when regenerating public/icon-192.png or badge-192.png
 * (`node scripts/generate-brand-assets.mjs`) so phones fetch fresh assets.
 * Keep in sync with NOTIF_V in public/sw.js.
 */
export const NOTIFICATION_ASSET_VERSION = "notif6";

export const NOTIFICATION_ICON = `/icon-192.png?v=${NOTIFICATION_ASSET_VERSION}`;
export const NOTIFICATION_BADGE = `/badge-192.png?v=${NOTIFICATION_ASSET_VERSION}`;
