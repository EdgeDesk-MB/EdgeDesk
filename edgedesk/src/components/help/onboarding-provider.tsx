"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { SetupWizard } from "@/components/help/setup-wizard";
import { WelcomeDialog } from "@/components/help/welcome-dialog";
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
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isOnboardingComplete()) {
      setWelcomeOpen(true);
    }
    setChecked(true);
  }, []);

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
