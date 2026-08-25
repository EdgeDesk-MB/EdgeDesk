import type { Metadata } from "next";
import Link from "next/link";
import { EdgewaysLogo } from "@/components/edgeways-logo-icon";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Set up the desk",
  robots: { index: false, follow: false },
};

/**
 * First-run chrome (EDGE-60): logo and steps, no empty side nav.
 * Always dark: the `dark` class paints dark tokens on first SSR paint, and
 * the nested forcedTheme provider keeps useTheme() consumers (toasts, the
 * appearance picker default) in agreement. The wizard's Appearance choice
 * is stored and only applies when the desk opens.
 */
export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider forcedTheme="dark">
      <div className="dark flex h-dvh max-w-full flex-col overflow-hidden bg-canvas text-foreground">
        <header className="flex shrink-0 items-center justify-between px-5 py-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-2 rounded-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            aria-label="Edgeways"
          >
            <EdgewaysLogo className="h-[2.1rem] w-[8.15rem] shrink-0 object-contain object-left dark:hidden" />
            <EdgewaysLogo
              onDark
              className="hidden h-[2.1rem] w-[8.15rem] shrink-0 object-contain object-left dark:block"
            />
            <span className="inline-flex shrink-0 origin-left translate-y-[2px] scale-[0.625] -mr-[37.5%] items-center rounded-[3px] bg-brand px-1.5 py-0.5 text-xs font-bold uppercase leading-none tracking-wide text-brand-foreground">
              Beta
            </span>
          </Link>
        </header>
        <main className="flex min-h-0 flex-1 justify-center overflow-hidden px-[var(--overlay-gutter)] pt-[var(--overlay-gutter)] pb-[max(var(--overlay-gutter),env(safe-area-inset-bottom))]">
          <div className="flex h-full min-h-0 w-full max-w-xl flex-col">
            {children}
          </div>
        </main>
        <Toaster richColors position="top-right" />
      </div>
    </ThemeProvider>
  );
}
