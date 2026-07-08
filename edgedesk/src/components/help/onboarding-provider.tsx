"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { WelcomeDialog } from "@/components/help/welcome-dialog";
import {
  isOnboardingComplete,
  markOnboardingComplete,
  resetOnboarding,
} from "@/lib/onboarding";

interface OnboardingContextValue {
  openWelcome: () => void;
  resetAndOpenWelcome: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [welcomeOpen, setWelcomeOpen] = useState(false);
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

  const value = useMemo(
    () => ({ openWelcome, resetAndOpenWelcome }),
    [openWelcome, resetAndOpenWelcome]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
      {checked && (
        <WelcomeDialog
          open={welcomeOpen}
          onOpenChange={setWelcomeOpen}
          onComplete={markOnboardingComplete}
        />
      )}
    </OnboardingContext.Provider>
  );
}
