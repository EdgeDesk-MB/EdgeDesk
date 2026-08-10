"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { OfferDialog } from "@/components/offers/offer-dialog";
import { OfferViewDialog } from "@/components/offers/offer-view-dialog";
import type { OfferEditorPrefill } from "@/components/offers/offer-editor-form";
import { useAppState } from "@/hooks/use-app-state";
import {
  useDevStickyJson,
  useDevStickyOpen,
} from "@/lib/dev/use-dev-sticky-open";
import { deriveOfferNextAction, offerNextActionLabel } from "@/lib/offers/next-actions";
import type { OfferSummary } from "@/lib/services/offers.types";

type OfferContextValue = {
  openOffer: (prefill?: OfferEditorPrefill) => void;
  viewOffer: (offer: OfferSummary) => void;
};

const OfferContext = createContext<OfferContextValue | null>(null);

export function useOfferDialog() {
  const ctx = useContext(OfferContext);
  if (!ctx) {
    throw new Error("useOfferDialog must be used within OfferProvider");
  }
  return ctx;
}

export function OfferProvider({ children }: { children: React.ReactNode }) {
  // Dev sticky: HMR remounts wipe useState; keep shell open while iterating.
  const [open, setOpen] = useDevStickyOpen("offer-editor");
  const [prefill, setPrefill] = useState<OfferEditorPrefill | undefined>();
  const [formKey, setFormKey] = useState(0);
  const [viewSeedId, setViewSeedId] = useDevStickyJson<number | null>(
    "offer-view-id",
    null
  );
  const { state, refresh } = useAppState(5000);

  const openOffer = useCallback((next?: OfferEditorPrefill) => {
    setPrefill(next ? { ...next } : undefined);
    setFormKey((k) => k + 1);
    setOpen(true);
  }, []);

  const viewOffer = useCallback((offer: OfferSummary) => {
    setViewSeedId(offer.id);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setPrefill(undefined);
  }, []);

  const handleViewOpenChange = useCallback((next: boolean) => {
    if (!next) setViewSeedId(null);
  }, []);

  const offers = useMemo(() => state?.offers ?? [], [state?.offers]);

  // The dialog always shows the freshest polled copy; if the campaign
  // vanishes from the list, the derived open flag closes it.
  const viewOfferState =
    viewSeedId != null ? (offers.find((o) => o.id === viewSeedId) ?? null) : null;
  const viewOpen = viewOfferState != null;

  const viewAction = viewOfferState ? deriveOfferNextAction(viewOfferState) : null;

  function handleViewEdit(offer: OfferSummary) {
    setViewSeedId(null);
    openOffer({ editOffer: offer });
  }

  function handleRefresh() {
    void refresh();
  }

  return (
    <OfferContext.Provider value={{ openOffer, viewOffer }}>
      {children}
      <OfferDialog
        open={open}
        onOpenChange={handleOpenChange}
        prefill={prefill}
        formKey={formKey}
        onSaved={handleRefresh}
      />
      {/* Campaign details modal — keep OfferViewDialog import graph stable for HMR. */}
      <OfferViewDialog
        open={viewOpen}
        onOpenChange={handleViewOpenChange}
        offer={viewOfferState}
        nextActionLabel={viewAction ? offerNextActionLabel(viewAction.kind) : null}
        nextActionDetail={viewAction?.detail ?? null}
        onRefresh={handleRefresh}
        onEdit={handleViewEdit}
      />
    </OfferContext.Provider>
  );
}
