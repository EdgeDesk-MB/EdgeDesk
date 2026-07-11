"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { OfferDialog } from "@/components/offers/offer-dialog";
import { OfferViewDialog } from "@/components/offers/offer-view-dialog";
import type { OfferEditorPrefill } from "@/components/offers/offer-editor-form";
import { useAppState } from "@/hooks/use-app-state";
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
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<OfferEditorPrefill | undefined>();
  const [formKey, setFormKey] = useState(0);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewOfferState, setViewOfferState] = useState<OfferSummary | null>(null);
  const { state, refresh } = useAppState(5000);

  const openOffer = useCallback((next?: OfferEditorPrefill) => {
    setPrefill(next ? { ...next } : undefined);
    setFormKey((k) => k + 1);
    setOpen(true);
  }, []);

  const viewOffer = useCallback((offer: OfferSummary) => {
    setViewOfferState(offer);
    setViewOpen(true);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) setPrefill(undefined);
  }, []);

  const handleViewOpenChange = useCallback((next: boolean) => {
    setViewOpen(next);
    if (!next) setViewOfferState(null);
  }, []);

  const offers = useMemo(() => state?.offers ?? [], [state?.offers]);

  useEffect(() => {
    if (!viewOpen || viewOfferState == null) return;
    const fresh = offers.find((o) => o.id === viewOfferState.id);
    if (fresh) {
      setViewOfferState(fresh);
    } else {
      setViewOpen(false);
      setViewOfferState(null);
    }
  }, [offers, viewOpen, viewOfferState?.id]);

  const viewAction = viewOfferState ? deriveOfferNextAction(viewOfferState) : null;

  function handleViewEdit(offer: OfferSummary) {
    setViewOpen(false);
    setViewOfferState(null);
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
