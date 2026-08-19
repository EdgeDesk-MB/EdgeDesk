import type { Metadata } from "next";
import { MarketingScrollEffects } from "@/components/marketing/marketing-scroll-effects";
import { marketingShareMetadata } from "@/lib/marketing/share-metadata";
import { getLandingVariant } from "@/lib/site-surface";

export function generateMetadata(): Metadata {
  return marketingShareMetadata(getLandingVariant());
}

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
    <div className="marketing-root min-h-dvh overflow-x-clip bg-[var(--marketing-canvas)] text-[var(--marketing-fg)] selection:bg-[color-mix(in_srgb,var(--marketing-brand)_35%,transparent)] selection:text-white">
      <MarketingScrollEffects />
      {children}
    </div>
  );
}
