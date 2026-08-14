"use client";

import { DateTimePicker } from "@/components/date-time-picker";
import { END_OF_DAY_HM } from "@/components/time-picker";
import { api } from "@/hooks/use-app-state";
import { useNow } from "@/hooks/use-now";
import { freeBetExpiryLinkLabel } from "@/lib/accounts/free-bet-expiry";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/offers/offer-terms";
import { formatGbp } from "@/lib/format-money";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

export function FreeBetExpiryControl({
  lotId,
  expiresAt,
  accountName,
  remaining,
  onChanged,
}: {
  lotId: number;
  expiresAt: number | null;
  accountName: string;
  remaining: number;
  onChanged: (expiresAt: number | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const now = useNow(60_000);
  const expired = expiresAt != null && expiresAt < now;
  const label = freeBetExpiryLinkLabel(expiresAt, now);

  async function save(value: string) {
    const next = fromDatetimeLocalValue(value);
    const prev = expiresAt;
    onChanged(next);
    setBusy(true);
    try {
      await api("/api/accounts/free-bets", {
        method: "PATCH",
        json: { lotId, expiresAt: next },
      });
    } catch (e) {
      onChanged(prev);
      toast.error("Could not save expiry", { description: String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <DateTimePicker
      trigger="link"
      value={expiresAt != null ? toDatetimeLocalValue(expiresAt) : ""}
      onChange={(value) => void save(value)}
      disabled={busy}
      placeholder="Set expiry"
      displayLabel={label}
      defaultTime={END_OF_DAY_HM}
      shortcuts="ending"
      emptyLabel={
        expiresAt == null
          ? `Set expiry for ${formatGbp(remaining)} at ${accountName}`
          : `Change expiry for ${formatGbp(remaining)} at ${accountName}`
      }
      className={cn(expired && "text-warning")}
    />
  );
}
