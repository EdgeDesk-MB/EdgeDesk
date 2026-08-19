import type { Metadata } from "next";
import Link from "next/link";
import { ResponsibleGamblingNote } from "@/components/compliance/responsible-gambling-note";
import { MarketingLogo } from "@/components/marketing/marketing-logo";
import { LEGAL_NAV } from "@/lib/legal/public";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/**
 * Auth shell: Edgeways brand above Clerk forms. No desk chrome.
 * Pinned dark (`dark` + `scheme-dark`) so Clerk’s shadcn footer does not
 * follow the desk light theme. See `EDGEWAYS_CLERK_APPEARANCE`.
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="marketing-root dark relative flex min-h-dvh max-w-full flex-col overflow-x-clip bg-[var(--marketing-canvas)] text-[var(--marketing-fg)] scheme-dark">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, color-mix(in srgb, var(--marketing-brand) 18%, transparent), transparent 55%)",
        }}
      />
      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <MarketingLogo href="/" />
        <Link
          href="/"
          className="rounded-sm text-sm text-[color-mix(in_srgb,var(--marketing-fg)_55%,transparent)] transition-colors hover:text-[var(--marketing-fg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-brand)]"
        >
          Back to home
        </Link>
      </header>
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-16 pt-4">
        {children}
      </main>
      <footer className="relative z-10 space-y-2 px-5 pb-6 text-center text-xs text-white/55">
        <ResponsibleGamblingNote className="text-white/55 [&_a]:rounded-sm [&_a]:text-inherit [&_a]:underline-offset-2 [&_a]:hover:text-white/70 [&_a]:hover:underline [&_a]:focus-visible:outline [&_a]:focus-visible:outline-2 [&_a]:focus-visible:outline-offset-2 [&_a]:focus-visible:outline-[var(--marketing-brand)]" />
        <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-3">
          {LEGAL_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-sm underline-offset-2 hover:text-white/70 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--marketing-brand)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}
