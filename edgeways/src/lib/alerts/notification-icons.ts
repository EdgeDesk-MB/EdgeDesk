/**
 * Web-notification art (Android shade has two slots):
 *   badge — monochrome white bolt on transparent (omit → system bell)
 *   icon  — yellow plate + ink bolt (square logo)
 * Bump the version when regenerating public/icon-192.png or badge-192.png
 * (`node scripts/generate-brand-assets.mjs`) so phones fetch fresh assets.
 */
export const NOTIFICATION_ASSET_VERSION = "notif5";

export const NOTIFICATION_ICON = `/icon-192.png?v=${NOTIFICATION_ASSET_VERSION}`;
export const NOTIFICATION_BADGE = `/badge-192.png?v=${NOTIFICATION_ASSET_VERSION}`;
