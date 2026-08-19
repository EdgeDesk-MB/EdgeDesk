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
import { PlanRouteGate } from "@/components/plan-route-gate";
import { AppTopBar } from "@/components/app-top-bar";
import { OnboardingProvider } from "@/components/help/onboarding-provider";
import { AppStateProvider } from "@/components/app-state-provider";
import { AppearanceSettingsSync } from "@/components/appearance-settings-sync";
import { DocumentTitleController } from "@/components/document-title-controller";
import { DeskSurfaceLock } from "@/components/desk-surface-lock";
import { cookies } from "next/headers";
import { PublicDemoProvider } from "@/components/demo/public-demo-provider";
import { DemoPlanBar } from "@/components/demo/demo-plan-bar";
import { PUBLIC_DEMO_COOKIE } from "@/lib/demo/public-demo";

/**
 * Desk chrome: shell, top bar, and interactive providers.
 * Marketing routes live outside this group and skip the desk.
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const demoActive = (await cookies()).get(PUBLIC_DEMO_COOKIE)?.value === "1";
  return (
    <PublicDemoProvider initialActive={demoActive}>
    <AppStateProvider>
      <DeskSurfaceLock />
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
                                <div className="flex h-dvh max-w-full flex-col overflow-hidden">
                                  <DemoPlanBar />
                                  <AppTopBar />
                                  <AppShell>
                                    <PlanRouteGate>{children}</PlanRouteGate>
                                  </AppShell>
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
    </PublicDemoProvider>
  );
}
