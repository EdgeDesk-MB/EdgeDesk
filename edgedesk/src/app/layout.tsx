import type { Metadata, Viewport } from "next";
import { Noto_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { QuickLogSheet } from "@/components/quick-log-sheet";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { AlertWatcher } from "@/components/alert-watcher";
import { CommandPalette } from "@/components/command-palette";
import { AddBalanceProvider } from "@/components/add-balance-provider";
import { AddBetProvider } from "@/components/add-bet-provider";
import { TrackFixtureProvider } from "@/components/track-fixture-provider";
import { MatchedCalculatorProvider } from "@/components/matched-calculator-provider";
import { OfferProvider } from "@/components/offers/offer-provider";
import { FreeBetsProvider } from "@/components/accounts/free-bets-convert-dialog";
import { RacingAutopilotListener } from "@/components/racing-autopilot-listener";
import { OfferReminderListener } from "@/components/offer-reminder-listener";
import { AppNav } from "@/components/app-nav";
import { AppTopBar } from "@/components/app-top-bar";
import { OnboardingProvider } from "@/components/help/onboarding-provider";
import { AppStateProvider } from "@/components/app-state-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { pagePanel } from "@/lib/ui/surface-styles";
import { appShellGap, appShellPadding } from "@/lib/ui/app-shell-layout";
import { cn } from "@/lib/utils";

const notoSans = Noto_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EdgeDesk - Matched Betting Command Centre",
  description: "Calculators, live events and real-time profit tracking for matched betting",
  icons: { apple: "/icon-180.png" },
};

/** viewport-fit=cover makes env(safe-area-inset-*) live for the mobile sheets. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${notoSans.variable} ${geistMono.variable} h-full overflow-hidden antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full overflow-hidden bg-canvas">
        <ThemeProvider>
          <OnboardingProvider>
            <AppStateProvider>
              <AddBalanceProvider>
                <AddBetProvider>
                  <TrackFixtureProvider>
                    <MatchedCalculatorProvider>
                      <OfferProvider>
                        <FreeBetsProvider>
                          <div className="flex h-dvh flex-col overflow-hidden">
                            <AppTopBar />
                            <div className="app-scroll min-h-0 flex-1 overflow-y-auto">
                              <div
                                className={cn(
                                  "flex w-full items-stretch",
                                  appShellPadding,
                                  appShellGap
                                )}
                              >
                              <AppNav />
                              <div className="flex min-w-0 flex-1 flex-col p-0 sm:p-1">
                                <main
                                  className={cn(
                                    pagePanel,
                                    "flex w-full flex-col dark:shadow-none",
                                    "max-sm:rounded-none max-sm:shadow-none max-sm:ring-0"
                                  )}
                                >
                                  {children}
                                </main>
                              </div>
                              </div>
                            </div>
                          </div>
                          <Toaster richColors position="top-right" />
                          <QuickLogSheet />
                          <PwaInstallPrompt />
                          <CommandPalette />
                          <AlertWatcher />
                          <RacingAutopilotListener />
                          <OfferReminderListener />
                        </FreeBetsProvider>
                      </OfferProvider>
                    </MatchedCalculatorProvider>
                  </TrackFixtureProvider>
                </AddBetProvider>
              </AddBalanceProvider>
            </AppStateProvider>
          </OnboardingProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
