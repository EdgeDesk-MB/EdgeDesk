import type { CSSProperties } from "react";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Figtree, Noto_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { QuickLogSheet } from "@/components/quick-log-sheet";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { AlertWatcher } from "@/components/alert-watcher";
import { CommandPalette } from "@/components/command-palette";
import { AddBalanceProvider } from "@/components/add-balance-provider";
import { AddBetProvider } from "@/components/add-bet-provider";
import { EachWayCalculatorProvider } from "@/components/each-way-calculator-provider";
import { AccaRunProvider } from "@/components/acca-run-provider";
import { BetBuilderRunProvider } from "@/components/bet-builder-run-provider";
import { ScopePlaceChooserProvider } from "@/components/scope-place-chooser-provider";
import { TrackFixtureProvider } from "@/components/track-fixture-provider";
import { MatchedCalculatorProvider } from "@/components/matched-calculator-provider";
import { OfferProvider } from "@/components/offers/offer-provider";
import { CasinoLogProvider } from "@/components/casino/casino-log-provider";
import { BoostCheckProvider } from "@/components/boosts/boost-check-provider";
import { FreeBetsProvider } from "@/components/accounts/free-bets-convert-dialog";
import { RacingAutopilotListener } from "@/components/racing-autopilot-listener";
import { UserReminderListener } from "@/components/user-reminder-listener";
import { AppShell } from "@/components/app-shell";
import { AppTopBar } from "@/components/app-top-bar";
import { OnboardingProvider } from "@/components/help/onboarding-provider";
import { AppStateProvider } from "@/components/app-state-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { BrandAccentProvider } from "@/components/brand-accent-provider";
import { AppearanceSettingsSync } from "@/components/appearance-settings-sync";
import { DocumentTitleController } from "@/components/document-title-controller";
import { UiFontProvider } from "@/components/ui-font-provider";
import { HeaderPatternProvider } from "@/components/header-pattern-provider";
import { BrandStorageMigration } from "@/components/brand-storage-migration";
import { BRAND_ACCENT_FOUC_SCRIPT } from "@/lib/brand-accent-fouc";
import {
  BRAND_ACCENT_COOKIE_KEY,
  brandAccentStyle,
  deriveBrandAccent,
  normalizeHex,
} from "@/lib/brand-accent";
import { UI_FONT_FOUC_SCRIPT } from "@/lib/ui-font-fouc";
import {
  DEFAULT_UI_FONT,
  normalizeUiFont,
  UI_FONT_ATTR,
  UI_FONT_COOKIE_KEY,
} from "@/lib/ui-font";
import { HEADER_PATTERN_FOUC_SCRIPT } from "@/lib/header-pattern-fouc";
import {
  DEFAULT_HEADER_PATTERN,
  HEADER_PATTERN_ATTR,
  HEADER_PATTERN_COOKIE_KEY,
  normalizeHeaderPattern,
} from "@/lib/header-pattern";

const notoSans = Noto_Sans({
  // Keep the Tailwind v4 pass-through name (`@theme --font-sans: var(--font-sans)`).
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Edgeways",
    template: "%s · Edgeways",
  },
  description: "Calculators, live events and real-time profit tracking for matched betting",
  // Outbound bookie/casino clicks must not send Edgeways as Referer.
  referrer: "no-referrer",
  // Icons: src/app/icon.tsx (accent-tinted favicon from brand cookie) and
  // src/app/apple-icon.png (static iOS home screen).
};

/** viewport-fit=cover makes env(safe-area-inset-*) live for the mobile sheets. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Pin browser chrome to ink. Dia samples the top element’s background-color
  // (see AppTopBar — <header> is always #111; yellow is an inner shell) and
  // also respects theme-color / manifest theme_color when present.
  themeColor: "#111111",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jar = await cookies();
  const cookieHex = normalizeHex(jar.get(BRAND_ACCENT_COOKIE_KEY)?.value);
  const accentDerived = cookieHex ? deriveBrandAccent(cookieHex) : null;
  const accentStyle = accentDerived
    ? (brandAccentStyle(cookieHex!) as CSSProperties)
    : undefined;
  const cookieFont = normalizeUiFont(jar.get(UI_FONT_COOKIE_KEY)?.value);
  const cookiePattern = normalizeHeaderPattern(
    jar.get(HEADER_PATTERN_COOKIE_KEY)?.value
  );

  return (
    <html
      lang="en"
      className={`${notoSans.variable} ${figtree.variable} ${geistMono.variable} h-full overflow-hidden bg-[#111111] antialiased`}
      style={accentStyle}
      {...(accentDerived
        ? { "data-brand-plate": accentDerived.brandPlateDark ? "dark" : "light" }
        : {})}
      {...(cookieFont !== DEFAULT_UI_FONT
        ? { [UI_FONT_ATTR]: cookieFont }
        : {})}
      {...(cookiePattern !== DEFAULT_HEADER_PATTERN
        ? { [HEADER_PATTERN_ATTR]: cookiePattern }
        : {})}
      suppressHydrationWarning
    >
      <head>
        {/* Blocking — paints stored accent before CSS defaults can flash Amber. */}
        <script
          dangerouslySetInnerHTML={{ __html: BRAND_ACCENT_FOUC_SCRIPT }}
        />
        {/* Blocking — paints stored UI font before Default (Noto) can flash. */}
        <script dangerouslySetInnerHTML={{ __html: UI_FONT_FOUC_SCRIPT }} />
        {/* Blocking — paints stored header pattern before Diagonal lines can flash. */}
        <script
          dangerouslySetInnerHTML={{ __html: HEADER_PATTERN_FOUC_SCRIPT }}
        />
      </head>
      <body className="h-full overflow-hidden bg-canvas">
        <BrandStorageMigration />
        <ThemeProvider>
          <BrandAccentProvider>
            <UiFontProvider>
              <HeaderPatternProvider>
                <AppStateProvider>
                  <AppearanceSettingsSync />
                  <OnboardingProvider>
                    <AddBalanceProvider>
                      <EachWayCalculatorProvider>
                      <AddBetProvider>
                        <AccaRunProvider>
                          <BetBuilderRunProvider>
                          <ScopePlaceChooserProvider>
                            <TrackFixtureProvider>
                              <MatchedCalculatorProvider>
                                <OfferProvider>
                                  <CasinoLogProvider>
                                    <BoostCheckProvider>
                                      <FreeBetsProvider>
                                        <div className="flex h-dvh flex-col overflow-hidden">
                                          <AppTopBar />
                                          <AppShell>{children}</AppShell>
                                        </div>
                                        <Toaster richColors position="top-right" />
                                        <QuickLogSheet />
                                        <PwaInstallPrompt />
                                        <CommandPalette />
                                        <DocumentTitleController />
                                        <AlertWatcher />
                                        <RacingAutopilotListener />
                                        <UserReminderListener />
                                      </FreeBetsProvider>
                                    </BoostCheckProvider>
                                  </CasinoLogProvider>
                                </OfferProvider>
                              </MatchedCalculatorProvider>
                            </TrackFixtureProvider>
                          </ScopePlaceChooserProvider>
                          </BetBuilderRunProvider>
                        </AccaRunProvider>
                      </AddBetProvider>
                      </EachWayCalculatorProvider>
                    </AddBalanceProvider>
                  </OnboardingProvider>
                </AppStateProvider>
              </HeaderPatternProvider>
            </UiFontProvider>
          </BrandAccentProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

