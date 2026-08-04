"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAppState } from "@/hooks/use-app-state";

/** Shows toasts when racing autopilot settles races from background polling. */
export function RacingAutopilotListener() {
  const { state } = useAppState(2000);
  const seen = useRef(new Set<number>());

  useEffect(() => {
    for (const notice of state?.racingAutopilot ?? []) {
      if (seen.current.has(notice.id)) continue;
      seen.current.add(notice.id);
      toast.success(notice.message, {
        description: "Linked bets settled automatically.",
        action: { label: "Tracker", onClick: () => window.location.assign("/tracker") },
      });
    }
  }, [state?.racingAutopilot]);

  return null;
}
