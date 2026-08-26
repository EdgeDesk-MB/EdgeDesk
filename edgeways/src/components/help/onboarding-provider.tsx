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
import { DemoNoticeDialog } from "@/components/demo/demo-notice-dialog";
import { usePublicDemo } from "@/components/demo/public-demo-provider";
import { ReferAFriendDialog } from "@/components/referrals/refer-a-friend-dialog";
import { useAppState } from "@/hooks/use-app-state";
import { hasDeskActivity, needsSetup } from "@/lib/dashboard-empty";
import {
  decideOnboardingOpen,
  isOnboardingComplete,
  markOnboardingComplete,
  readAgeConfirmedAt,
  resetOnboarding,
  type OnboardingOpen,
} from "@/lib/onboarding";
import type { AppState } from "@/lib/services/state.types";

interface OnboardingContextValue {
  openWelcome: () => void;
  resetAndOpenWelcome: () => void;
  /** G2b - the first-run setup wizard (profile on /setup; bank → bookies in the modal) */
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

function decideForState(
  state: AppState | null,
  input: {
    forceOnboard: boolean;
    ageConfirmed: boolean;
    publicDemo: boolean;
    forceDemoSetup: boolean;
    userId?: string | null;
  }
): OnboardingOpen {
  return decideOnboardingOpen({
    forceOnboard: input.forceOnboard,
    ageConfirmed: input.ageConfirmed,
    hasDeskActivity: state ? hasDeskActivity(state) : false,
    needsSetup: state ? needsSetup(state) : false,
    onboardingComplete: isOnboardingComplete(input.userId),
    publicDemo: input.publicDemo,
    forceDemoSetup: input.forceDemoSetup,
  });
}

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { state, refresh } = useAppState();
  const publicDemo = usePublicDemo();
  const { user, isLoaded: clerkLoaded } = useUser();
  const [ageOpen, setAgeOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  // Decide once after the first /api/state snapshot so later polls do not
  // close an intentionally re-opened welcome tour.
  const decidedRef = useRef(false);
  const forceOnboardRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("onboard") !== "1") return;
    forceOnboardRef.current = true;
    url.searchParams.delete("onboard");
    const query = url.searchParams.toString();
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${query ? `?${query}` : ""}${url.hash}`
    );
  }, []);

  const applyDecision = useCallback((next: OnboardingOpen) => {
    if (next === "setup-page") {
      window.location.assign("/setup");
      return;
    }
    if (next === "age") setAgeOpen(true);
    if (next === "welcome") setWelcomeOpen(true);
    if (next === "setup") setSetupOpen(true);
  }, []);

  useEffect(() => {
    if (state == null || decidedRef.current) return;
    // Wait for Clerk so sign-up metadata can suppress a duplicate gate.
    if (!clerkLoaded) return;
    decidedRef.current = true;

    queueMicrotask(() => {
      const clerkConfirmed = clerkAgeConfirmed(
        user?.unsafeMetadata as Record<string, unknown>
      );
      const ageConfirmed =
        state.settings?.ageConfirmedAt != null ||
        clerkConfirmed ||
        readAgeConfirmedAt(user?.id) != null;

      const forceDemoSetup =
        publicDemo.forceSetup ||
        new URLSearchParams(window.location.search).get("setup") === "1";
      const next = decideForState(state, {
        forceOnboard: forceOnboardRef.current,
        ageConfirmed,
        publicDemo: publicDemo.active,
        forceDemoSetup,
        userId: user?.id,
      });
      if (next === "none" && hasDeskActivity(state) && !needsSetup(state)) {
        markOnboardingComplete(user?.id);
      }
      applyDecision(next);
      setChecked(true);
    });
  }, [state, clerkLoaded, user, publicDemo.active, publicDemo.forceSetup, applyDecision]);

  const handleAgeConfirmed = useCallback(() => {
    setAgeOpen(false);
    refresh();
    const next = decideForState(state, {
      forceOnboard: forceOnboardRef.current,
      ageConfirmed: true,
      publicDemo: publicDemo.active,
      forceDemoSetup: publicDemo.forceSetup,
      userId: user?.id,
    });
    applyDecision(next);
  }, [refresh, state, publicDemo.active, publicDemo.forceSetup, applyDecision, user?.id]);

  const handleClerkAgeSynced = useCallback(() => {
    refresh().then(() => {
      const next = decideForState(state, {
        forceOnboard: forceOnboardRef.current,
        ageConfirmed: true,
        publicDemo: publicDemo.active,
        forceDemoSetup: publicDemo.forceSetup,
        userId: user?.id,
      });
      applyDecision(next);
    });
  }, [refresh, state, publicDemo.active, publicDemo.forceSetup, applyDecision, user?.id]);

  const openWelcome = useCallback(() => setWelcomeOpen(true), []);

  const resetAndOpenWelcome = useCallback(() => {
    resetOnboarding(user?.id);
    setWelcomeOpen(true);
  }, [user?.id]);

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
            onComplete={() => markOnboardingComplete(user?.id)}
            onSetup={() => {
              setWelcomeOpen(false);
              setSetupOpen(true);
            }}
          />
          <SetupWizard open={setupOpen} onOpenChange={setSetupOpen} />
          <DemoNoticeDialog
            suppressed={ageOpen || setupOpen || welcomeOpen}
          />
          <ReferAFriendDialog
            suppressed={ageOpen || setupOpen || welcomeOpen}
          />
        </>
      )}
    </OnboardingContext.Provider>
  );
}
