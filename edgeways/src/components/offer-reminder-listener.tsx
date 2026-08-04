"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useAppState } from "@/hooks/use-app-state";
import {
  readSeenOfferReminderKeys,
  storeSeenOfferReminderKeys,
} from "@/lib/offers/offer-reminder-seen";
import { selectOfferExpiryReminders } from "@/lib/offers/offer-reminders";

/** Toast when offers are approaching expiry (explicit or scoped race/event). */
export function OfferReminderListener() {
  const { state } = useAppState(5000);
  const settings = state?.settings;

  useEffect(() => {
    if (!settings?.offerRemindersEnabled || !state?.offers) return;

    const seen = readSeenOfferReminderKeys();
    const reminders = selectOfferExpiryReminders(
      state.offers.map((o) => ({
        id: o.id,
        title: o.title,
        bookmaker: o.bookmaker,
        status: o.status,
        seriesId: o.seriesId,
        instanceDate: o.instanceDate,
        expiresAt: o.expiresAt,
        eventDate: o.eventDate,
        scopeRaceLabel: o.scopeRaceLabel,
        scopeRaceId: o.scopeRaceId,
        sport: o.sport,
      })),
      settings.offerReminderDays,
      Date.now(),
      { seen }
    );

    if (reminders.length === 0) return;

    let dirty = false;
    for (const reminder of reminders) {
      if (seen.has(reminder.seenKey)) continue;
      seen.add(reminder.seenKey);
      dirty = true;
      toast.warning(reminder.message, {
        description: reminder.bookmaker ?? undefined,
        action: { label: "Offers", onClick: () => window.location.assign("/offers") },
      });
    }
    if (dirty) storeSeenOfferReminderKeys(seen);
  }, [state?.offers, settings]);

  return null;
}
