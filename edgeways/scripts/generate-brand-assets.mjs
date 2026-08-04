#!/usr/bin/env node
/**
 * Derive Edgeways icons from brand/masters/*.png.
 * Run from edgeways/: node scripts/generate-brand-assets.mjs
 *
 * Masters (Sam-supplied):
 *   brand/masters/favicon.png       – yellow bolt on ink, for browser tab
 *   brand/masters/square.png        – yellow bolt on rounded ink, for PWA / Apple
 *   brand/masters/notification.png  – white bolt on black (badge silhouette source)
 *
 * The in-app top-bar mark is the SVG at public/brand/mark.svg (traced from the
 * notification silhouette). Re-trace only if the bolt geometry changes.
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const masters = path.join(root, "brand", "masters");
const INK = "#111111";

async function write(rel, buf) {
  await sharp(buf).toFile(path.join(root, rel));
  console.log("wrote", rel);
}

/** White bolt silhouette on transparent (Android notification badge). */
async function badgeFromNotification(size) {
  const { data, info } = await sharp(path.join(masters, "notification.png"))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let p = 0; p < info.width * info.height; p++) {
    const i = p * 4;
    // Keep white pixels; drop the black plate.
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

  // Browser favicon (Next.js app-directory convention).
  await write(
    path.join("src", "app", "icon.png"),
    await sharp(favicon).resize(256, 256).flatten({ background: INK }).png().toBuffer()
  );

  // Apple touch: solid background, no alpha (iOS requirement).
  await write(
    path.join("src", "app", "apple-icon.png"),
    await sharp(square).resize(180, 180).flatten({ background: INK }).png().toBuffer()
  );

  // PWA / Android home-screen icons.
  await write(
    path.join("public", "icon-192.png"),
    await sharp(square).resize(192, 192).flatten({ background: INK }).png().toBuffer()
  );
  await write(
    path.join("public", "icon-512.png"),
    await sharp(square).resize(512, 512).flatten({ background: INK }).png().toBuffer()
  );

  // Push notification badge (monochrome white on transparent).
  await write(path.join("public", "badge-192.png"), await badgeFromNotification(192));

  // Raster fallback of the top-bar mark (SVG is preferred in the component).
  await write(
    path.join("public", "brand", "mark.png"),
    await sharp(favicon).resize(64, 64).flatten({ background: INK }).png().toBuffer()
  );
})();
