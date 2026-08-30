"use client";

/**
 * Daily desk chords (EDGE-78). Opens the same providers as the command palette.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAddBet } from "@/components/add-bet-provider";
import { DeskShortcutSheet } from "@/components/desk-shortcut-sheet";
import { useMatchedCalculator } from "@/components/matched-calculator-provider";
import { useOfferDialog } from "@/components/offers/offer-provider";
import { useAppState } from "@/hooks/use-app-state";
import { canDesk } from "@/lib/entitlements/effective-plan";
import {
  DESK_JUMPS,
  SETTLE_TRIGGER_SELECTOR,
  focusedOpenBetRow,
  matchSettleFocusedBetChord,
  resolveDeskKey,
  shouldIgnoreDeskShortcut,
} from "@/lib/keyboard/desk-shortcuts";

export function DeskShortcuts() {
  const router = useRouter();
  const { state } = useAppState();
  const { openAddBet } = useAddBet();
  const { openMatchedCalculator } = useMatchedCalculator();
  const { openOffer } = useOfferDialog();
  const [sheetOpen, setSheetOpen] = useState(false);
  const goPrefixAt = useRef<number | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreDeskShortcut(event, document)) return;
      const prefixWasArmed = goPrefixAt.current !== null;
      const resolved = resolveDeskKey(event, goPrefixAt.current, Date.now());
      goPrefixAt.current = resolved.nextPrefixArmedAt;
      if (!resolved.consume && !prefixWasArmed && matchSettleFocusedBetChord(event)) {
        const trigger = focusedOpenBetRow(document.activeElement)?.querySelector(
          SETTLE_TRIGGER_SELECTOR
        );
        if (trigger instanceof HTMLElement) {
          event.preventDefault();
          trigger.click();
        }
        return;
      }
      if (!resolved.consume) return;
      event.preventDefault();
      const id = resolved.action;
      if (!id) return;
      if (id === "add-bet") {
        openAddBet();
        return;
      }
      if (id === "new-offer") {
        if (!canDesk(state?.settings, "offers_pipeline")) {
          router.push("/offers");
          return;
        }
        openOffer();
        return;
      }
      if (id === "matched-calculator") {
        openMatchedCalculator();
        return;
      }
      if (id === "keyboard-help") {
        setSheetOpen(true);
        return;
      }
      const jump = DESK_JUMPS.find((item) => item.id === id);
      if (jump) router.push(jump.href);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openAddBet, openMatchedCalculator, openOffer, router, state?.settings]);

  return <DeskShortcutSheet open={sheetOpen} onOpenChange={setSheetOpen} />;
}
