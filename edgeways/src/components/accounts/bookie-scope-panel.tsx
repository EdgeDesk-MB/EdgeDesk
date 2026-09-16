"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookieEarlyPayoutRules } from "@/components/bets/bookie-early-payout-rules";
import { HorseRacingIcon } from "@/components/sport-icon";
import { FormSection } from "@/components/ui/form-section";
import { api } from "@/hooks/use-app-state";
import { useBookieScopes } from "@/hooks/use-bookie-scopes";
import { isAutoOrEmptyScopeNote, type AccountNotesSource } from "@/lib/accounts/notes-source";
import {
  formatBookieScopeNote,
  formatEpScopeChip,
  scopesForBookie,
  type EpBookieSetup,
} from "@/lib/twoup/bookie-offers";
import { Timer } from "lucide-react";

export function BookieScopePanel({
  bookie,
  accountId,
  notes,
  notesSource,
  onNotesAutoFilled,
  surface = "early_payout",
}: {
  bookie: string;
  /** Omit where there is no account yet to patch a note onto (e.g. a preview). */
  accountId?: number;
  notes?: string | null;
  notesSource?: AccountNotesSource;
  onNotesAutoFilled?: (notes: string) => void;
  surface?: "early_payout" | "racing";
}) {
  const { setup, persistSetup } = useBookieScopes();
  const [earlyOpen, setEarlyOpen] = useState(surface !== "racing");
  const [racingOpen, setRacingOpen] = useState(surface === "racing");
  const earlySummary = useMemo(() => {
    const rules = scopesForBookie(setup, bookie);
    return rules.length > 0 ? rules.map(formatEpScopeChip).join(", ") : "No rules yet";
  }, [bookie, setup]);

  useEffect(() => {
    if (surface === "racing") {
      setRacingOpen(true);
      return;
    }
    setEarlyOpen(true);
  }, [surface]);

  const handleEarlyPayoutChange = useCallback(
    (next: EpBookieSetup) => {
      persistSetup(next);
      if (accountId == null || !isAutoOrEmptyScopeNote(notes, notesSource)) return;
      const autoNote = formatBookieScopeNote(next, bookie);
      if (autoNote === (notes ?? "")) return;
      onNotesAutoFilled?.(autoNote);
      void api(`/api/accounts/${accountId}`, {
        method: "PATCH",
        json: { notes: autoNote || null, notesSource: "scope" },
      }).catch(() => {
        // Best-effort background text-fill; the scope save above already covers user-facing errors.
      });
    },
    [accountId, bookie, notes, notesSource, onNotesAutoFilled, persistSetup]
  );

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <FormSection
        title="Early payout"
        icon={<Timer className="size-3.5" />}
        open={earlyOpen}
        onOpenChange={setEarlyOpen}
        summary={earlySummary}
      >
        <BookieEarlyPayoutRules
          bookie={bookie}
          selection={setup}
          onChange={handleEarlyPayoutChange}
        />
      </FormSection>
      <FormSection
        title="Racing"
        icon={<HorseRacingIcon className="size-3.5" />}
        open={racingOpen}
        onOpenChange={setRacingOpen}
        summary="Coming soon"
      >
        <p className="text-xs text-muted-foreground">
          Scope for horse racing coming soon.
        </p>
      </FormSection>
    </div>
  );
}
