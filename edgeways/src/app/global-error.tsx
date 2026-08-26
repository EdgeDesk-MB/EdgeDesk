"use client";

/**
 * Last-resort error page: replaces the root layout, so no CSS or fonts are
 * guaranteed to load - inline styles only.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0b",
          color: "rgba(255,255,255,0.75)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1
            style={{
              margin: "0 0 8px",
              fontSize: 22,
              fontWeight: 600,
              color: "#fff",
            }}
          >
            Something went wrong
          </h1>
          <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.6 }}>
            Edgeways hit an unexpected error. Trying again usually clears it -
            if it keeps happening, email support@edgeways.app.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#facc15",
              color: "#000",
              border: 0,
              borderRadius: 6,
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
