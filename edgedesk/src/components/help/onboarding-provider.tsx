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
import { SetupWizard } from "@/components/help/setup-wizard";
import { WelcomeDialog } from "@/components/help/welcome-dialog";
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

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { state } = useAppState();
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  // Decide once after the first /api/state snapshot so later polls do not
  // close an intentionally re-opened welcome tour.
  const decidedRef = useRef(false);

  useEffect(() => {
    if (state == null || decidedRef.current) return;
    decidedRef.current = true;

    queueMicrotask(() => {
      if (hasDeskActivity(state)) {
        markOnboardingComplete();
        setChecked(true);
        return;
      }

      if (!isOnboardingComplete()) setWelcomeOpen(true);
      setChecked(true);
    });
  }, [state]);

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
      {checked && (
        <>
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
