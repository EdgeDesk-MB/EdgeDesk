"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

let didPatchConsoleError = false;

/**
 * next-themes injects an inline <script> for FOUC prevention. React 19 warns
 * about script tags inside components during client render — false positive
 * for this SSR-only pattern (same as shadcn’s Next dark-mode guide).
 */
function suppressReactScriptTagWarningOnce() {
  if (
    didPatchConsoleError ||
    typeof window === "undefined" ||
    process.env.NODE_ENV !== "development"
  ) {
    return;
  }
  didPatchConsoleError = true;
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Encountered a script tag")
    ) {
      return;
    }
    orig.apply(console, args);
  };
}

export function ThemeProvider({
  children,
  forcedTheme,
}: {
  children: React.ReactNode;
  /** Force a theme while mounted (e.g. onboarding is always dark). The
   * stored preference is untouched and reapplies on unmount. */
  forcedTheme?: string;
}) {
  // Patch during render so the warning from next-themes’ first mount is caught.
  suppressReactScriptTagWarningOnce();

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      forcedTheme={forcedTheme}
    >
      {children}
    </NextThemesProvider>
  );
}
