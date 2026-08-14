/**
 * Facebook / Instagram feed still: 4:5 at 2× (2160×2700).
 * Run from edgeways/: node scripts/generate-facebook-feed.mjs
 *
 * Uses next/og so type matches the marketing share card. Not an AI logo.
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement as h } from "react";
import { ImageResponse } from "next/og.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const INK = "#111111";
const FG = "#f5f5f0";
const BRAND = "#FFC71E";
const MUTED = "rgba(245,245,240,0.58)";
const DIM = "rgba(245,245,240,0.42)";
const PANEL = "#1a1a1a";
const MONEY = "#34d399";
const LINE = "rgba(255,255,255,0.10)";

const WIDTH = 2160;
const HEIGHT = 2700;

async function loadLogo() {
  const logo = await readFile(join(root, "public/brand/logo-yellow.png"));
  return `data:image/png;base64,${logo.toString("base64")}`;
}

function label(text) {
  return h(
    "div",
    {
      style: {
        fontSize: 28,
        fontWeight: 600,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: MUTED,
      },
    },
    text
  );
}

async function main() {
  const logoSrc = await loadLogo();

  const el = h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: INK,
        color: FG,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      },
    },
    h("div", { style: { width: "100%", height: 24, background: BRAND } }),
    h(
      "div",
      {
        style: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "88px 120px 80px",
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          },
        },
        h("img", {
          src: logoSrc,
          alt: "edgeways",
          width: 840,
          height: 216,
          style: { objectFit: "contain" },
        }),
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              background: BRAND,
              color: INK,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "0.10em",
              padding: "12px 20px",
              borderRadius: 8,
              lineHeight: 1,
            },
          },
          "WAITLIST"
        )
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            marginTop: 72,
          },
        },
        h(
          "div",
          {
            style: {
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: MUTED,
            },
          },
          "Matched betting command centre"
        ),
        h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              marginTop: 28,
              fontSize: 108,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
            },
          },
          h("div", { style: { color: FG } }, "Know what's next."),
          h("div", { style: { color: BRAND } }, "See what paid.")
        ),
        h(
          "div",
          {
            style: {
              marginTop: 36,
              fontSize: 40,
              lineHeight: 1.35,
              color: MUTED,
              maxWidth: 1400,
            },
          },
          "One desk for the day. No spreadsheet pile-up."
        )
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            marginTop: 64,
            background: PANEL,
            border: `1px solid ${LINE}`,
            borderRadius: 20,
            padding: "48px 56px",
            justifyContent: "space-between",
            alignItems: "flex-end",
          },
        },
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: 10 } },
          label("Do next"),
          h(
            "div",
            { style: { fontSize: 44, fontWeight: 600, color: FG } },
            "Paddy Power · £20 qualifier"
          ),
          h(
            "div",
            { style: { fontSize: 32, color: MUTED } },
            "Free bet if 2nd or 3rd"
          )
        ),
        h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 10,
              paddingLeft: 48,
              borderLeft: `1px solid ${LINE}`,
            },
          },
          label("Potential edge"),
          h(
            "div",
            {
              style: {
                fontSize: 44,
                fontWeight: 700,
                color: MONEY,
                fontVariantNumeric: "tabular-nums",
              },
            },
            "+£15.00"
          ),
          h(
            "div",
            { style: { fontSize: 32, color: MUTED } },
            "£20 free bet value"
          )
        )
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "auto",
            paddingTop: 36,
            borderTop: `1px solid ${LINE}`,
          },
        },
        h(
          "div",
          { style: { fontSize: 36, fontWeight: 600, color: FG } },
          "edgeways.app"
        ),
        h(
          "div",
          { style: { fontSize: 28, color: DIM } },
          "UK · 18+ · BeGambleAware.org"
        )
      )
    )
  );

  const res = new ImageResponse(el, {
    width: WIDTH,
    height: HEIGHT,
  });
  const buf = Buffer.from(await res.arrayBuffer());

  const outDir = join(root, "brand/social");
  await mkdir(outDir, { recursive: true });
  const master = join(outDir, "facebook-feed-4x5.png");
  await writeFile(master, buf);
  console.log("wrote", master, `${WIDTH}×${HEIGHT}`, `${buf.length} bytes`);

  const sharp = (await import("sharp")).default;
  const upload = join(outDir, "facebook-feed-4x5-1080.png");
  await sharp(buf).resize(1080, 1350).png().toFile(upload);
  console.log("wrote", upload, "1080×1350");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
