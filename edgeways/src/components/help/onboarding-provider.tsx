"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useUser } from "@clerk/nextjs";
import { SetupWizard } from "@/components/help/setup-wizard";
import { WelcomeDialog } from "@/components/help/welcome-dialog";
import { AgeGateDialog } from "@/components/compliance/age-gate-dialog";
import { SyncClerkAgeConfirmation } from "@/components/compliance/sync-clerk-age";
import { useAppState } from "@/hooks/use-app-state";
import { hasDeskActivity } from "@/lib/dashboard-empty";
import {
  isOnboardingComplete,
  markOnboardingComplete,
  resetOnboarding,
} from "@/lib/onboarding";

interface OnboardingContextValue {
  openWelcome: () => void;
  resetAndOpenWelcome: () => void;
  /** G2b - the first-run setup wizard (bank → bookies → defaults → alerts) */
  openSetup: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}

function clerkAgeConfirmed(
  meta: Record<string, unknown> | undefined
): boolean {
  if (!meta) return false;
  return meta.ageConfirmed === true || typeof meta.ageConfirmedAt === "number";
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { state, refresh } = useAppState();
  const { user, isLoaded: clerkLoaded } = useUser();
  const [ageOpen, setAgeOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  // Decide once after the first /api/state snapshot so later polls do not
  // close an intentionally re-opened welcome tour.
  const decidedRef = useRef(false);

  useEffect(() => {
    if (state == null || decidedRef.current) return;
    // Wait for Clerk so sign-up metadata can suppress a duplicate gate.
    if (!clerkLoaded) return;
    decidedRef.current = true;

    queueMicrotask(() => {
      // The 18+ gate (EDGE-13) precedes everything, welcome tour included.
      // Skip opening it when Clerk already holds a sign-up confirmation; sync
      // will write ageConfirmedAt and refresh.
      if (state.settings?.ageConfirmedAt == null) {
        if (clerkAgeConfirmed(user?.unsafeMetadata as Record<string, unknown>)) {
          setChecked(true);
          return;
        }
        setAgeOpen(true);
        setChecked(true);
        return;
      }
      if (hasDeskActivity(state)) {
        markOnboardingComplete();
        setChecked(true);
        return;
      }

      if (!isOnboardingComplete()) setWelcomeOpen(true);
      setChecked(true);
    });
  }, [state, clerkLoaded, user]);

  const handleAgeConfirmed = useCallback(() => {
    setAgeOpen(false);
    refresh();
    // Run the welcome decision the gate deferred.
    if (state && !hasDeskActivity(state) && !isOnboardingComplete()) {
      setWelcomeOpen(true);
    }
  }, [refresh, state]);

  const handleClerkAgeSynced = useCallback(() => {
    refresh().then(() => {
      if (state && !hasDeskActivity(state) && !isOnboardingComplete()) {
        setWelcomeOpen(true);
      }
    });
  }, [refresh, state]);

  const openWelcome = useCallback(() => setWelcomeOpen(true), []);

  const resetAndOpenWelcome = useCallback(() => {
    resetOnboarding();
    setWelcomeOpen(true);
  }, []);

  const openSetup = useCallback(() => setSetupOpen(true), []);

  const value = useMemo(
    () => ({ openWelcome, resetAndOpenWelcome, openSetup }),
    [openWelcome, resetAndOpenWelcome, openSetup]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      <SyncClerkAgeConfirmation
        localAgeConfirmedAt={state?.settings?.ageConfirmedAt}
        onSynced={handleClerkAgeSynced}
      />
      {checked && (
        <>
          <AgeGateDialog open={ageOpen} onConfirmed={handleAgeConfirmed} />
          <WelcomeDialog
            open={welcomeOpen}
            onOpenChange={setWelcomeOpen}
            onComplete={markOnboardingComplete}
            onSetup={() => {
              setWelcomeOpen(false);
              setSetupOpen(true);
            }}
          />
          <SetupWizard open={setupOpen} onOpenChange={setSetupOpen} />
        </>
      )}
    </OnboardingContext.Provider>
  );
}
