import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { marketingShareCopy, SHARE_IMAGE_ALT } from "@/lib/marketing/share-metadata";
import { getLandingVariant } from "@/lib/site-surface";

export const SHARE_CARD_ALT = SHARE_IMAGE_ALT;
/** 2× the 1200×630 share card so Slack / iMessage stay sharp on retina. */
export const SHARE_CARD_SIZE = { width: 2400, height: 1260 };
export const SHARE_CARD_CONTENT_TYPE = "image/png";

const INK = "#111111";
const FG = "#f5f5f0";
const BRAND = "#FFC71E";
const MUTED = "rgba(245,245,240,0.58)";
const PANEL = "#1a1a1a";
const MONEY = "#34d399";

async function loadLogo() {
  const logo = await readFile(
    join(process.cwd(), "public/brand/logo-yellow.png")
  );
  return `data:image/png;base64,${logo.toString("base64")}`;
}

/** Share card: ink plate, real lockup, Do Next artefact (the product, not a slogan poster). */
export async function renderShareCardImage() {
  const copy = marketingShareCopy(getLandingVariant());
  const logoSrc = await loadLogo();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: INK,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div style={{ width: "100%", height: 16, background: BRAND }} />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "96px 128px 88px",
            backgroundImage:
              "radial-gradient(ellipse 70% 55% at 78% 18%, rgba(255,199,30,0.14), transparent 62%)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
              <img
                src={logoSrc}
                alt=""
                width={420}
                height={108}
                style={{ objectFit: "contain" }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderRadius: 8,
                  background: BRAND,
                  color: INK,
                  fontSize: 32,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  padding: "12px 20px",
                  lineHeight: 1,
                }}
              >
                BETA
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                borderRadius: 999,
                border: "2px solid rgba(255,199,30,0.45)",
                color: BRAND,
                fontSize: 40,
                fontWeight: 600,
                letterSpacing: "0.04em",
                padding: "16px 32px",
              }}
            >
              {copy.eyebrow}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 80,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: 1120,
                gap: 36,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  fontSize: 116,
                  fontWeight: 700,
                  letterSpacing: "-0.035em",
                  lineHeight: 1.05,
                  color: FG,
                }}
              >
                <span>Know what&apos;s next.</span>
                <span style={{ color: BRAND }}>See what paid.</span>
              </div>
              <div
                style={{
                  fontSize: 48,
                  color: MUTED,
                  lineHeight: 1.35,
                  letterSpacing: "-0.01em",
                }}
              >
                {copy.imageLine}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: 920,
                borderRadius: 40,
                background: PANEL,
                border: "2px solid rgba(255,255,255,0.10)",
                boxShadow:
                  "0 48px 96px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.08)",
                padding: "56px 64px",
                gap: 44,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 600,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: MUTED,
                  }}
                >
                  Do next
                </div>
                <div
                  style={{
                    fontSize: 56,
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    color: FG,
                  }}
                >
                  Paddy Power · £20 qualifier
                </div>
                <div style={{ fontSize: 40, color: MUTED }}>
                  Free bet if 2nd or 3rd
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  borderTop: "2px solid rgba(255,255,255,0.10)",
                  paddingTop: 40,
                }}
              >
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 600,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: MUTED,
                  }}
                >
                  Potential edge
                </div>
                <div
                  style={{
                    fontSize: 72,
                    fontWeight: 700,
                    color: MONEY,
                    letterSpacing: "-0.03em",
                  }}
                >
                  +£15.00
                </div>
                <div style={{ fontSize: 40, color: MUTED }}>
                  £20 free bet value
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...SHARE_CARD_SIZE }
  );
}
