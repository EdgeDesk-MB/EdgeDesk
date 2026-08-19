"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { EmptyState } from "@/components/help/empty-state";
import { SetupWizardForm } from "@/components/help/setup-wizard-form";

/**
 * Signed-in first-run page. Guests go to login; Finish writes bank/bookies
 * then lands on /desk.
 */
export function SetupPageClient() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/login");
      return;
    }
    setOpened(true);
  }, [isLoaded, isSignedIn, router]);

  if (!opened) {
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
