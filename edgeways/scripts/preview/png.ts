/**
 * Minimal PNG decode, encode and pixel diff for the visual regression check
 * (EDGE-228). Node's zlib only, so no image dependency. Decodes the 8-bit,
 * non-interlaced PNGs Chromium screenshots produce; anything else throws.
 */
import { deflateSync, inflateSync } from "node:zlib";

export type Image = { width: number; height: number; data: Uint8Array };

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 };

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

export function decodePng(buf: Buffer): Image {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new Error("Not a PNG");
  let width = 0;
  let height = 0;
  let depth = 0;
  let colour = -1;
  let interlace = 0;
  const idat: Buffer[] = [];
  for (let off = 8; off + 8 <= buf.length; ) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const body = buf.subarray(off + 8, off + 8 + len);
    off += 12 + len;
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      colour = body[9];
      interlace = body[12];
    } else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
  }
  const channels = CHANNELS[colour];
  if (depth !== 8 || interlace !== 0 || !channels) {
    throw new Error(`Unsupported PNG (bit depth ${depth}, colour type ${colour}, interlace ${interlace})`);
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  if (raw.length < height * (stride + 1)) throw new Error("PNG data is truncated");
  const data = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride);
  let cur = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const at = y * (stride + 1);
    const filter = raw[at];
    for (let i = 0; i < stride; i++) {
      const x = raw[at + 1 + i];
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let v: number;
      if (filter === 0) v = x;
      else if (filter === 1) v = x + a;
      else if (filter === 2) v = x + b;
      else if (filter === 3) v = x + ((a + b) >> 1);
      else if (filter === 4) v = x + paeth(a, b, c);
      else throw new Error(`Bad PNG filter ${filter} on row ${y}`);
      cur[i] = v & 0xff;
    }
    for (let px = 0; px < width; px++) {
      const s = px * channels;
      const d = (y * width + px) * 4;
      if (channels >= 3) {
        data[d] = cur[s];
        data[d + 1] = cur[s + 1];
        data[d + 2] = cur[s + 2];
        data[d + 3] = channels === 4 ? cur[s + 3] : 255;
      } else {
        data[d] = data[d + 1] = data[d + 2] = cur[s];
        data[d + 3] = channels === 2 ? cur[s + 1] : 255;
      }
    }
    [prev, cur] = [cur, prev];
  }
  return { width, height, data };
}

function chunk(type: string, body: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}

/** RGBA, 8-bit, the Sub filter on every row (good on flat UI). */
export function encodePng(img: Image): Buffer {
  const stride = img.width * 4;
  const raw = Buffer.alloc(img.height * (stride + 1));
  for (let y = 0; y < img.height; y++) {
    const at = y * (stride + 1);
    raw[at] = 1;
    const row = y * stride;
    for (let i = 0; i < stride; i++) {
      const left = i >= 4 ? img.data[row + i - 4] : 0;
      raw[at + 1 + i] = (img.data[row + i] - left) & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 6 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

/** Maximum YIQ distance, as in pixelmatch. */
const MAX_YIQ_DELTA = 35215;

function blend(c: number, a: number): number {
  return 255 + ((c - 255) * a) / 255;
}

function yiq(r: number, g: number, b: number): [number, number, number] {
  return [
    r * 0.29889531 + g * 0.58662247 + b * 0.11448223,
    r * 0.59597799 - g * 0.2741761 - b * 0.32180189,
    r * 0.21147017 - g * 0.52261711 + b * 0.31114694,
  ];
}

function pixelAt(img: Image, x: number, y: number): [number, number, number] | null {
  if (x >= img.width || y >= img.height) return null;
  const i = (y * img.width + x) * 4;
  const a = img.data[i + 3];
  return [blend(img.data[i], a), blend(img.data[i + 1], a), blend(img.data[i + 2], a)];
}

export type DiffResult = {
  /** Pixels over the threshold, counting every pixel outside the smaller image. */
  changed: number;
  total: number;
  ratio: number;
  /** Baseline faded to grey, differing pixels in red. */
  diff: Image;
};

/** `threshold` is 0 to 1 on pixelmatch's scale; 0.1 ignores anti-aliasing noise. */
export function diffImages(base: Image, next: Image, threshold: number): DiffResult {
  const width = Math.max(base.width, next.width);
  const height = Math.max(base.height, next.height);
  const maxDelta = MAX_YIQ_DELTA * threshold * threshold;
  const data = new Uint8Array(width * height * 4);
  let changed = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = pixelAt(base, x, y);
      const b = pixelAt(next, x, y);
      const d = (y * width + x) * 4;
      let differs = !a || !b;
      if (a && b) {
        const [y1, i1, q1] = yiq(...a);
        const [y2, i2, q2] = yiq(...b);
        const dy = y1 - y2;
        const di = i1 - i2;
        const dq = q1 - q2;
        differs = 0.5053 * dy * dy + 0.299 * di * di + 0.1957 * dq * dq > maxDelta;
      }
      if (differs) {
        changed++;
        data[d] = 255;
        data[d + 1] = 0;
        data[d + 2] = 0;
      } else {
        const grey = Math.round(255 + (yiq(...(a ?? [255, 255, 255]))[0] - 255) * 0.1);
        data[d] = data[d + 1] = data[d + 2] = grey;
      }
      data[d + 3] = 255;
    }
  }
  const total = width * height;
  return { changed, total, ratio: total === 0 ? 0 : changed / total, diff: { width, height, data } };
}

/** Images left to right on a neutral grey, separated by `gap` pixels. */
export function sideBySide(images: Image[], gap: number): Image {
  const width = images.reduce((w, img) => w + img.width, 0) + gap * Math.max(0, images.length - 1);
  const height = images.reduce((h, img) => Math.max(h, img.height), 0);
  const data = new Uint8Array(width * height * 4).fill(160);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  let left = 0;
  for (const img of images) {
    for (let y = 0; y < img.height; y++) {
      const src = y * img.width * 4;
      data.set(img.data.subarray(src, src + img.width * 4), (y * width + left) * 4);
    }
    left += img.width + gap;
  }
  return { width, height, data };
}
