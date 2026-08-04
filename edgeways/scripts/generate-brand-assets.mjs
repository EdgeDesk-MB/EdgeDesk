#!/usr/bin/env node
/**
 * Derive the Edgeways icon set from the brand lockup (brand/edgeways-lockup.png).
 * Run from edgeways/: node scripts/generate-brand-assets.mjs
 *
 * The lockup PNG carries the yellow shapes only: the pulse line is a TRANSPARENT
 * knock-out through the yellow banner (it takes whatever background sits behind
 * it - on the dark top bar it reads near-black, as designed). Square icons are
 * a crop of the banner centred on the pulse's tallest spike, composited over
 * near-black #111 so the pulse reads everywhere.
 *
 * INTERIM: the source banner is ~105px tall, so large sizes are upscaled.
 * Replace with renders from Sam's master artwork when it lands.
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const LOCKUP = path.join(root, "brand", "edgeways-lockup.png");
const YELLOW = { r: 255, g: 199, b: 30, alpha: 1 }; // #FFC71E
const INK = { r: 17, g: 17, b: 17, alpha: 1 }; // #111111

const isYellow = (r, g, b, a) => a > 200 && r > 180 && g > 140 && b < 90;

async function analyse() {
  const { data, info } = await sharp(LOCKUP).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const at = (x, y) => (y * width + x) * 4;

  // Banner bbox: all yellow pixels (the wordmark dot is separate but far right;
  // take the largest yellow run per row instead: the banner is the wide one).
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    let rowMin = -1, rowMax = -1;
    for (let x = 0; x < width; x++) {
      const i = at(x, y);
      if (isYellow(data[i], data[i + 1], data[i + 2], data[i + 3])) {
        if (rowMin < 0) rowMin = x;
        rowMax = x;
      }
    }
    // Banner rows are wide; the square dot's rows are ~30px. Keep wide rows only.
    if (rowMax - rowMin > width / 3) {
      if (rowMin < minX) minX = rowMin;
      if (rowMax > maxX) maxX = rowMax;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // Knock-out mask: transparent pixels INSIDE the banner that are not connected
  // to the banner's outside (flood fill from bbox border over transparent px).
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const transparent = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      transparent[y * w + x] = data[at(minX + x, minY + y) + 3] < 128 ? 1 : 0;
  const outside = new Uint8Array(w * h);
  const queue = [];
  for (let x = 0; x < w; x++) { queue.push([x, 0], [x, h - 1]); }
  for (let y = 0; y < h; y++) { queue.push([0, y], [w - 1, y]); }
  while (queue.length) {
    const [x, y] = queue.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = y * w + x;
    if (!transparent[p] || outside[p]) continue;
    outside[p] = 1;
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const knockout = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) knockout[p] = transparent[p] && !outside[p] ? 1 : 0;

  // Spike: column with the tallest knock-out run.
  let spikeX = Math.floor(w / 2), spikeRun = 0;
  for (let x = 0; x < w; x++) {
    let colMin = -1, colMax = -1;
    for (let y = 0; y < h; y++) {
      if (knockout[y * w + x]) { if (colMin < 0) colMin = y; colMax = y; }
    }
    if (colMax - colMin > spikeRun) { spikeRun = colMax - colMin; spikeX = x; }
  }
  return { minX, minY, w, h, knockout, spikeX, spikeRun };
}

/** Square banner crop centred on the spike (yellow with transparent pulse). */
async function squareMark() {
  const { minX, minY, w, h, spikeX } = await analyse();
  const side = h + 2;
  let left = minX + spikeX - Math.floor(side / 2);
  left = Math.max(minX - 1, Math.min(left, minX + w + 1 - side));
  return sharp(LOCKUP)
    .extract({ left, top: Math.max(0, minY - 1), width: side, height: side })
    .png()
    .toBuffer();
}

/** Opaque icon: pulse knocked to near-black, on a full-bleed yellow square. */
async function fullBleed(size, markFraction) {
  const mark = await sharp(await squareMark())
    .flatten({ background: "#111111" }) // pulse reads near-black
    .resize(Math.round(size * markFraction), null, { kernel: "lanczos3" })
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: YELLOW } })
    .composite([{ input: mark, gravity: "centre" }])
    .flatten({ background: "#FFC71E" })
    .png()
    .toBuffer();
}

/** Android notification badge: white silhouette of the pulse, transparent bg. */
async function badge(size) {
  const { minX, minY, w, h, knockout } = await analyse();
  const out = Buffer.alloc(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    out[i] = out[i + 1] = out[i + 2] = 255;
    out[i + 3] = knockout[p] ? 255 : 0;
  }
  // Trim to the pulse bbox, then pad to square.
  let bx0 = w, by0 = h, bx1 = 0, by1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (knockout[y * w + x]) {
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
      if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: bx0, top: by0, width: bx1 - bx0 + 1, height: by1 - by0 + 1 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "lanczos3" })
    .png()
    .toBuffer();
}

async function write(file, buf) {
  await sharp(buf).toFile(path.join(root, file));
  console.log("wrote", file);
}

(async () => {
  const mark = await squareMark();
  // UI mark for dark surfaces (top bar): pulse stays transparent so it picks
  // up the surface colour, exactly like the full lockup.
  await write(path.join("public", "brand", "mark.png"), mark);
  // Favicon: opaque, pulse near-black.
  await write(
    path.join("src", "app", "icon.png"),
    await sharp(mark).flatten({ background: "#111111" }).resize(256, 256, { kernel: "lanczos3" }).toBuffer()
  );
  // Apple touch icon: full-bleed yellow, no alpha (iOS requirement).
  await write(path.join("src", "app", "apple-icon.png"), await fullBleed(180, 0.72));
  // PWA maskable icons: pulse inside the central safe zone.
  await write(path.join("public", "icon-192.png"), await fullBleed(192, 0.62));
  await write(path.join("public", "icon-512.png"), await fullBleed(512, 0.62));
  // Android push badge.
  await write(path.join("public", "badge-192.png"), await badge(192));
})();
