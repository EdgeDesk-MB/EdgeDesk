#!/usr/bin/env node
/**
 * Derive Edgeways icons from brand/masters/*.png and public/brand/mark.svg.
 * Run from edgeways/: node scripts/generate-brand-assets.mjs
 *
 * Masters (Sam-supplied):
 *   brand/masters/favicon.png       – ink bolt on yellow, for browser tab
 *   brand/masters/square.png        – ink bolt on yellow squircle, for PWA / Apple
 *   brand/masters/logo-dark.png     – ink bolt + wordmark (top bar on yellow)
 *   brand/masters/logo-yellow.png   – yellow bolt + wordmark (on dark surfaces)
 *   public/brand/mark.svg           – square logo (push icon + badge silhouette)
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const masters = path.join(root, "brand", "masters");
const YELLOW = "#FFC71E";
const INK = "#111111";

/** Same bolt path as public/brand/mark.svg / EdgewaysLogoIcon. */
const BOLT_PATH =
  "M12.82 4.32 L12.86 10.3 L18.91 10.3 L11.25 19.61 L11.14 13.7 L5.13 13.67 L12.75 4.39 Z";

async function write(rel, buf) {
  await sharp(buf).toFile(path.join(root, rel));
  console.log("wrote", rel);
}

/** Yellow plate + ink bolt — matches mark.svg (notification large icon). */
function squareLogoSvg(size) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">` +
      `<rect width="24" height="24" rx="5" fill="${YELLOW}"/>` +
      `<path d="${BOLT_PATH}" fill="${INK}"/>` +
      `</svg>`
  );
}

/** White bolt on transparent — Android notification badge (no plate). */
function badgeBoltSvg(size) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">` +
      `<path d="${BOLT_PATH}" fill="#FFFFFF"/>` +
      `</svg>`
  );
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

  // Push / PWA icons from the square logo SVG so the bolt matches mark.svg.
  // Flatten fills rounded-corner alpha so maskable icons stay a solid plate.
  await write(
    path.join("public", "icon-192.png"),
    await sharp(squareLogoSvg(192)).flatten({ background: YELLOW }).png().toBuffer()
  );
  await write(
    path.join("public", "icon-512.png"),
    await sharp(squareLogoSvg(512)).flatten({ background: YELLOW }).png().toBuffer()
  );

  await write(
    path.join("public", "badge-192.png"),
    await sharp(badgeBoltSvg(192)).png().toBuffer()
  );

  // Compact mark for places that need the square only (menu, PWA prompt).
  await write(
    path.join("public", "brand", "mark.png"),
    await sharp(favicon).resize(64, 64).flatten({ background: YELLOW }).png().toBuffer()
  );

  // Top-bar lockup (ink on transparent — sits on the yellow top bar).
  await write(path.join("public", "brand", "logo.png"), await sharp(logo).png().toBuffer());
  await write(
    path.join("public", "brand", "logo-yellow.png"),
    await sharp(logoYellow).png().toBuffer()
  );
})();
