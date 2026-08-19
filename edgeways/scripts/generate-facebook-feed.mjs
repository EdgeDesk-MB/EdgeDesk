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

function label(text, size = 28) {
  return h(
    "div",
    {
      style: {
        fontSize: size,
        fontWeight: 600,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: MUTED,
      },
    },
    text
  );
}

function glimpseFrame(title, caption, body) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        flex: 1,
        background: PANEL,
        border: `1px solid ${LINE}`,
        borderRadius: 20,
      },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          padding: "22px 32px",
          borderBottom: `1px solid ${LINE}`,
        },
      },
      label(title, 24)
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          padding: "24px 32px",
        },
      },
      ...body
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          padding: "20px 32px",
          borderTop: `1px solid ${LINE}`,
          fontSize: 24,
          lineHeight: 1.35,
          color: MUTED,
        },
      },
      caption
    )
  );
}

function planRow(time, line, last = false) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "baseline",
        gap: 20,
        paddingBottom: last ? 0 : 16,
        marginBottom: last ? 0 : 16,
        borderBottom: last ? "none" : `1px solid rgba(255,255,255,0.06)`,
      },
    },
    h(
      "div",
      {
        style: {
          width: 90,
          fontSize: 26,
          fontVariantNumeric: "tabular-nums",
          color: MUTED,
        },
      },
      time
    ),
    h(
      "div",
      { style: { fontSize: 30, color: "rgba(245,245,240,0.88)" } },
      line
    )
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
          padding: "72px 100px 68px",
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
          width: 720,
          height: 186,
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
            marginTop: 48,
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
              fontSize: 88,
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
              marginTop: 24,
              fontSize: 36,
              lineHeight: 1.35,
              color: MUTED,
              maxWidth: 1400,
            },
          },
          "One desk for the day. No more faff."
        )
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: 24,
            marginTop: 40,
          },
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "row",
              gap: 24,
            },
          },
          glimpseFrame("Daily plan", "Offers, races, fixtures. One day, one list.", [
            planRow("13:05", "Sky Bet · £10 qualifier"),
            planRow("14:20", "Newbury · EW lay"),
            planRow("15:00", "Chelsea v Arsenal track", true),
          ]),
          glimpseFrame("Edge Report", "Expected versus realised. After commission.", [
            h(
              "div",
              {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                },
              },
              h("div", { style: { fontSize: 28, color: MUTED } }, "Expected"),
              h(
                "div",
                {
                  style: {
                    fontSize: 36,
                    fontWeight: 700,
                    color: MONEY,
                    fontVariantNumeric: "tabular-nums",
                  },
                },
                "+£14.00"
              )
            ),
            h(
              "div",
              {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginTop: 20,
                },
              },
              h("div", { style: { fontSize: 28, color: MUTED } }, "Realised"),
              h(
                "div",
                {
                  style: {
                    fontSize: 36,
                    fontWeight: 700,
                    color: MONEY,
                    fontVariantNumeric: "tabular-nums",
                  },
                },
                "+£12.40"
              )
            ),
            h("div", {
              style: { height: 1, background: LINE, marginTop: 22, marginBottom: 22 },
            }),
            h(
              "div",
              {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                },
              },
              h("div", { style: { fontSize: 28, color: MUTED } }, "Captured"),
              h(
                "div",
                {
                  style: {
                    fontSize: 36,
                    fontWeight: 700,
                    color: FG,
                    fontVariantNumeric: "tabular-nums",
                  },
                },
                "83%"
              )
            )
          ])
        ),
        h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "row",
              gap: 24,
            },
          },
          glimpseFrame("Racing Desk", "Live, mixed or estimate. Confidence you can act on.", [
            h(
              "div",
              {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                },
              },
              h(
                "div",
                { style: { fontSize: 32, fontWeight: 600, color: FG } },
                "Newbury  14:20"
              ),
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    background: "rgba(52,211,153,0.16)",
                    color: MONEY,
                    fontSize: 22,
                    fontWeight: 600,
                    padding: "6px 14px",
                    borderRadius: 999,
                  },
                },
                "Live"
              )
            ),
            h(
              "div",
              { style: { marginTop: 18, fontSize: 30, color: "rgba(245,245,240,0.82)" } },
              "Thunder Path"
            ),
            h(
              "div",
              {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 18,
                },
              },
              h("div", { style: { fontSize: 26, color: MUTED } }, "Lay stake"),
              h(
                "div",
                {
                  style: {
                    fontSize: 28,
                    color: FG,
                    fontVariantNumeric: "tabular-nums",
                  },
                },
                "£18.40"
              )
            ),
            h(
              "div",
              {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 10,
                },
              },
              h("div", { style: { fontSize: 26, color: MUTED } }, "Confidence"),
              h("div", { style: { fontSize: 26, fontWeight: 600, color: BRAND } }, "High")
            )
          ]),
          glimpseFrame("Alerts", "Exposure, 2UP, expiry. Push lands with the desk closed.", [
            h(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 20,
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${LINE}`,
                  borderRadius: 16,
                  padding: "22px 24px",
                },
              },
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    width: 56,
                    height: 56,
                    alignItems: "center",
                    justifyContent: "center",
                    background: BRAND,
                    borderRadius: 12,
                    color: INK,
                    fontSize: 28,
                    fontWeight: 700,
                  },
                },
                "⚡"
              ),
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", flex: 1 } },
                h(
                  "div",
                  { style: { fontSize: 30, fontWeight: 600, color: FG } },
                  "Naked exposure"
                ),
                h(
                  "div",
                  {
                    style: {
                      marginTop: 8,
                      fontSize: 24,
                      lineHeight: 1.35,
                      color: MUTED,
                    },
                  },
                  "Sky Bet back is open. Lay still missing on Betfair."
                )
              )
            )
          ])
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
            paddingTop: 28,
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
