import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { decodePng, diffImages, encodePng, sideBySide, type Image } from "./png";

function solid(width: number, height: number, rgba: [number, number, number, number]): Image {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return { width, height, data };
}

function paint(img: Image, x0: number, y0: number, w: number, h: number, rgba: number[]) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) img.data.set(rgba, (y * img.width + x) * 4);
  }
}

describe("PNG codec", () => {
  it("round-trips RGBA pixels exactly", () => {
    const img = solid(7, 5, [20, 30, 40, 255]);
    paint(img, 2, 1, 3, 2, [250, 200, 10, 128]);
    const back = decodePng(encodePng(img));
    expect(back.width).toBe(7);
    expect(back.height).toBe(5);
    expect(Buffer.from(back.data).equals(Buffer.from(img.data))).toBe(true);
  });

  it("decodes RGB with every filter type", () => {
    const width = 3;
    const rows = [0, 1, 2, 3, 4].map((filter) => [filter, 10, 20, 30, 5, 5, 5, 1, 2, 3]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(rows.length, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    const chunk = (type: string, body: Buffer) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(body.length, 0);
      return Buffer.concat([len, Buffer.from(type, "ascii"), body, Buffer.alloc(4)]);
    };
    const png = Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(Buffer.from(rows.flat()))),
      chunk("IEND", Buffer.alloc(0)),
    ]);
    const img = decodePng(png);
    const px = (x: number, y: number) => Array.from(img.data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4));
    expect(px(0, 0)).toEqual([10, 20, 30, 255]);
    expect(px(1, 1)).toEqual([15, 25, 35, 255]);
    expect(px(0, 2)).toEqual([20, 40, 60, 255]);
  });

  it("rejects what it cannot read", () => {
    expect(() => decodePng(Buffer.from("not a png"))).toThrow(/Not a PNG/);
  });
});

describe("diffImages", () => {
  it("finds nothing in identical images", () => {
    const a = solid(40, 20, [12, 12, 12, 255]);
    const { changed, ratio } = diffImages(a, solid(40, 20, [12, 12, 12, 255]), 0.1);
    expect(changed).toBe(0);
    expect(ratio).toBe(0);
  });

  it("ignores tiny colour noise under the threshold and counts a real change", () => {
    const a = solid(40, 20, [12, 12, 12, 255]);
    const b = solid(40, 20, [14, 13, 12, 255]);
    expect(diffImages(a, b, 0.1).changed).toBe(0);
    paint(b, 0, 0, 10, 2, [255, 196, 0, 255]);
    const d = diffImages(a, b, 0.1);
    expect(d.changed).toBe(20);
    expect(d.ratio).toBeCloseTo(20 / 800);
    expect(Array.from(d.diff.data.subarray(0, 4))).toEqual([255, 0, 0, 255]);
  });

  it("counts pixels outside the smaller image as changed", () => {
    const d = diffImages(solid(10, 10, [0, 0, 0, 255]), solid(10, 12, [0, 0, 0, 255]), 0.1);
    expect(d.diff.height).toBe(12);
    expect(d.changed).toBe(20);
  });
});

describe("sideBySide", () => {
  it("lays images out left to right with an opaque gap", () => {
    const out = sideBySide([solid(2, 2, [1, 1, 1, 255]), solid(3, 1, [9, 9, 9, 255])], 4);
    expect(out.width).toBe(9);
    expect(out.height).toBe(2);
    expect(Array.from(out.data.subarray(2 * 4, 3 * 4))).toEqual([160, 160, 160, 255]);
    expect(Array.from(out.data.subarray(6 * 4, 7 * 4))).toEqual([9, 9, 9, 255]);
  });
});
