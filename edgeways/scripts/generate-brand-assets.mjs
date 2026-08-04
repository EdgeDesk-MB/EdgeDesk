#!/usr/bin/env node
/**
 * Regenerate the placeholder Edgeways bolt icon set from one path.
 * Run from edgeways/: node scripts/generate-brand-assets.mjs
 * Swap BOLT_PATH when the final mark lands and re-run.
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BOLT_PATH = "M13.6 1.5 4.4 13.4h5.4L9.1 22.5l9.9-12.4h-5.8l0.4-8.6Z";
const TOPBAR = "#0d0d0f";

function boltSvg({ size, bg, fg, boltScale, rounded }) {
  const inset = ((1 - boltScale) / 2) * 24;
  const rect = bg
    ? `<rect width="24" height="24" ${rounded ? 'rx="5"' : ""} fill="${bg}"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">${rect}<g transform="translate(${inset} ${inset}) scale(${boltScale})"><path d="${BOLT_PATH}" fill="${fg}"/></g></svg>`;
}

async function render(svg, size, file) {
  await sharp(Buffer.from(svg), { density: 300 })
    .resize(size, size)
    .png()
    .toFile(file);
  console.log("wrote", file);
}

(async () => {
  const pub = path.join(__dirname, "..", "public");
  const app = path.join(__dirname, "..", "src", "app");

  // Maskable PWA icons: solid background, bolt inside the central safe zone.
  const maskable = (s) =>
    boltSvg({ size: s, bg: TOPBAR, fg: "#ffffff", boltScale: 0.55 });
  await render(maskable(192), 192, path.join(pub, "icon-192.png"));
  await render(maskable(512), 512, path.join(pub, "icon-512.png"));

  // Android notification badge: monochrome white on transparent.
  await render(
    boltSvg({ size: 192, bg: null, fg: "#ffffff", boltScale: 0.8 }),
    192,
    path.join(pub, "badge-192.png")
  );

  // Apple touch icon: solid background, no alpha (iOS requirement).
  await render(
    boltSvg({ size: 180, bg: TOPBAR, fg: "#ffffff", boltScale: 0.6 }),
    180,
    path.join(app, "apple-icon.png")
  );
})();
