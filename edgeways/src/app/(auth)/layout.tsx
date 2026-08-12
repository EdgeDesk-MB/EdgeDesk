import type { Metadata } from "next";
import Link from "next/link";
import { MarketingLogo } from "@/components/marketing/marketing-logo";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/**
 * Auth shell: Edgeways brand above Clerk forms. No desk chrome.
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-[#111111] text-[#f5f5f0]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(255,199,30,0.18), transparent 55%)",
        }}
      />
      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <MarketingLogo href="/" />
        <Link
          href="/"
          className="text-sm text-[rgba(245,245,240,0.55)] transition-colors hover:text-[#f5f5f0]"
        >
          Back to home
        </Link>
      </header>
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-16 pt-4">
        {children}
      </main>
      <footer className="relative z-10 px-5 pb-6 text-center text-xs text-[rgba(245,245,240,0.4)]">
        18+ only. Betting involves risk.{" "}
        <a
          href="https://www.begambleaware.org"
          className="underline-offset-2 hover:text-[rgba(245,245,240,0.7)] hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          BeGambleAware
        </a>
      </footer>
    </div>
  );
}
