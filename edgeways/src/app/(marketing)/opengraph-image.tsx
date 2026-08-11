import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Edgeways — matched betting command centre";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Waitlist / share card: ink plate, brand lockup line, hero promise. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#111111",
          padding: "72px 80px",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            color: "#FFC71E",
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: "#FFC71E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#111111",
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            ⚡
          </div>
          edgeways
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              color: "#f5f5f0",
            }}
          >
            <span>Know what's next.</span>
            <span style={{ color: "#FFC71E" }}>See what paid.</span>
          </div>
          <div style={{ fontSize: 28, color: "rgba(245,245,240,0.65)" }}>
            The matched betting command centre
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
