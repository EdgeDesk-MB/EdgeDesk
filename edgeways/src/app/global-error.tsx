"use client";

import type { CSSProperties } from "react";

/**
 * Last-resort error page: replaces the root layout, so no CSS or fonts are
 * guaranteed to load. Inline styles only. Hex values match `.marketing-root`.
 */
const canvas = "#0c0c0c";
const brand = "#ffc71e";
const ink = "#111111";
const fg = "rgba(245, 245, 240, 0.72)";
const fgStrong = "#f5f5f0";

const linkStyle: CSSProperties = {
  color: fg,
  fontSize: 14,
  fontWeight: 500,
  textDecoration: "none",
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
};

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <head>
        <style>{`
          button:focus-visible, a:focus-visible {
            outline: 2px solid ${brand};
            outline-offset: 2px;
          }
        `}</style>
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: canvas,
          color: fg,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: 420, padding: 24, width: "100%" }}>
          <p
            style={{
              margin: "0 0 20px",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: brand,
            }}
          >
            edgeways
          </p>
          <h1
            style={{
              margin: "0 0 10px",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              color: fgStrong,
            }}
          >
            Something went wrong
          </h1>
          <p style={{ margin: "0 0 24px", fontSize: 14, lineHeight: 1.6 }}>
            Edgeways hit an unexpected error. Try again first. If it keeps
            happening, tell us and we will fix it.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "12px 20px",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                background: brand,
                color: ink,
                border: 0,
                borderRadius: 8,
                padding: "10px 20px",
                minHeight: 44,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a href="/" style={linkStyle}>
              Back to Edgeways
            </a>
            <a href="/contact" style={linkStyle}>
              Contact us
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
