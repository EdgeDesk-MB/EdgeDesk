"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAppState } from "@/hooks/use-app-state";

/** Toast when offers are approaching expiry. */
export function OfferReminderListener() {
  const { state } = useAppState(5000);
  const seen = useRef(new Set<string>());
  const settings = state?.settings;

  useEffect(() => {
    if (!settings?.offerRemindersEnabled || !state?.offers) return;
    const now = Date.now();
    const msDay = 86_400_000;

    for (const offer of state.offers) {
      if (offer.status !== "active" && offer.status !== "planned") continue;
      if (offer.expiresAt == null) continue;
      const daysLeft = Math.ceil((offer.expiresAt - now) / msDay);
      if (daysLeft < 0) continue;

      for (const threshold of settings.offerReminderDays) {
        if (daysLeft !== threshold) continue;
        const key = `${offer.id}:${threshold}`;
        if (seen.current.has(key)) continue;
        seen.current.add(key);
        toast.warning(`Offer expires in ${threshold} day${threshold === 1 ? "" : "s"}: ${offer.title}`, {
          description: offer.bookmaker ?? undefined,
          action: { label: "Offers", onClick: () => window.location.assign("/offers") },
        });
      }
    }
  }, [state?.offers, settings]);

  return null;
}
