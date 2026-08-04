#!/usr/bin/env node
/**
 * Derive Edgeways icons from brand/masters/*.png.
 * Run from edgeways/: node scripts/generate-brand-assets.mjs
 *
 * Masters (Sam-supplied):
 *   brand/masters/favicon.png       – ink bolt on yellow, for browser tab
 *   brand/masters/square.png        – ink bolt on yellow squircle, for PWA / Apple
 *   brand/masters/logo-dark.png     – ink bolt + wordmark (top bar on yellow)
 *   brand/masters/logo-yellow.png   – yellow bolt + wordmark (on dark surfaces)
 *   brand/masters/notification.png  – white bolt on black (badge silhouette source)
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const masters = path.join(root, "brand", "masters");
const YELLOW = "#FFC71E";

async function write(rel, buf) {
  await sharp(buf).toFile(path.join(root, rel));
  console.log("wrote", rel);
}

/** White bolt silhouette on transparent (Android notification badge). */
async function badgeFromNotification(size) {
  const src = path.join(masters, "notification.png");
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let p = 0; p < info.width * info.height; p++) {
    const i = p * 4;
    const white = data[i + 3] > 128 && data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200;
    out[i] = out[i + 1] = out[i + 2] = 255;
    out[i + 3] = white ? 255 : 0;
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(size, size, { kernel: "lanczos3" })
    .png()
    .toBuffer();
}

(async () => {
  const favicon = path.join(masters, "favicon.png");
  const square = path.join(masters, "square.png");
  const logo = path.join(masters, "logo-dark.png");
  const logoYellow = path.join(masters, "logo-yellow.png");

  await write(
    path.join("src", "app", "icon.png"),
    await sharp(favicon).resize(256, 256).flatten({ background: YELLOW }).png().toBuffer()
  );

  await write(
    path.join("src", "app", "apple-icon.png"),
    await sharp(square).resize(180, 180).flatten({ background: YELLOW }).png().toBuffer()
  );

  await write(
    path.join("public", "icon-192.png"),
    await sharp(square).resize(192, 192).flatten({ background: YELLOW }).png().toBuffer()
  );
  await write(
    path.join("public", "icon-512.png"),
    await sharp(square).resize(512, 512).flatten({ background: YELLOW }).png().toBuffer()
  );

  await write(path.join("public", "badge-192.png"), await badgeFromNotification(192));

  // Compact mark for places that need the square only (menu, PWA prompt).
  await write(
    path.join("public", "brand", "mark.png"),
    await sharp(favicon).resize(64, 64).flatten({ background: YELLOW }).png().toBuffer()
  );

  // Top-bar lockup (ink on transparent — sits on the yellow top bar).
  await write(
    path.join("public", "brand", "logo.png"),
    await sharp(logo).png().toBuffer()
  );
  await write(
    path.join("public", "brand", "logo-yellow.png"),
    await sharp(logoYellow).png().toBuffer()
  );
})();
