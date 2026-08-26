"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { EmptyState } from "@/components/help/empty-state";
import { SetupWizardForm } from "@/components/help/setup-wizard-form";
import { api } from "@/hooks/use-app-state";
import { isOnboardingComplete } from "@/lib/onboarding";
import type { BalanceSummary } from "@/lib/services/balances.types";

/**
 * Signed-in first-run page. Guests go to login; Finish writes bank/bookies
 * then lands on /desk. A finished desk that revisits /setup goes home.
 */
export function SetupPageClient() {
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const needsWizard =
    isLoaded === true && isSignedIn === true && !isOnboardingComplete(user?.id);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/login");
      return;
    }
    if (!isOnboardingComplete(user?.id)) return;
    let cancelled = false;
    void api<BalanceSummary>("/api/accounts")
      .then((summary) => {
        if (cancelled) return;
        const ready = summary.accounts.some(
          (row) => row.type === "bank" || row.type === "bookie"
        );
        if (ready) {
          router.replace("/desk");
          return;
        }
        setOpened(true);
      })
      .catch(() => {
        if (!cancelled) setOpened(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, router, user?.id]);

  if (!opened && !needsWizard) {
    return (
        <EmptyState
          busy
          bare
          compact
          title="Loading set-up"
          description="Opening your desk set-up."
          className="w-full max-w-lg"
        />
    );
  }

  return <SetupWizardForm variant="page" />;
}
