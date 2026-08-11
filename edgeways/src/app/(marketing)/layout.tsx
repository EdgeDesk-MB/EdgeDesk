import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Edgeways, matched betting made clear",
  },
  description:
    "The matched betting command centre. Know what's next, execute cleanly, and see what paid. Join the waitlist for early access.",
  openGraph: {
    title: "Edgeways, matched betting made clear",
    description:
      "Know what's next, execute cleanly, and see what paid. Join the waitlist.",
    type: "website",
    siteName: "Edgeways",
  },
  twitter: {
    card: "summary_large_image",
    title: "Edgeways, matched betting made clear",
    description:
      "Know what's next, execute cleanly, and see what paid. Join the waitlist.",
  },
};

/**
 * Marketing surface: scrollable document, no desk chrome.
 * Desk providers live under (app)/layout.
 */
export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="marketing-root min-h-dvh overflow-x-clip bg-[var(--marketing-ink)] text-[var(--marketing-fg)] selection:bg-[color-mix(in_srgb,var(--marketing-brand)_35%,transparent)] selection:text-white">
      {children}
    </div>
  );
}
