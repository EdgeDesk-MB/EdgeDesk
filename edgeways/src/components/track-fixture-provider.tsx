"use client";

import { createContext, useCallback, useContext, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FixtureBrowserContent } from "@/components/events/fixture-browser";
import { preventDialogDismissOnPortaledContent } from "@/lib/dialog-portal";

type TrackFixtureContextValue = {
  openTrackFixture: () => void;
  closeTrackFixture: () => void;
};

const TrackFixtureContext = createContext<TrackFixtureContextValue | null>(null);

export function useTrackFixture() {
  const ctx = useContext(TrackFixtureContext);
  if (!ctx) {
    throw new Error("useTrackFixture must be used within TrackFixtureProvider");
  }
  return ctx;
}

export function TrackFixtureProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const openTrackFixture = useCallback(() => setOpen(true), []);
  const closeTrackFixture = useCallback(() => setOpen(false), []);

  return (
    <TrackFixtureContext.Provider value={{ openTrackFixture, closeTrackFixture }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton
          className="flex max-w-[min(72rem,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0 sm:top-20 sm:bottom-20 sm:h-auto sm:max-h-none sm:max-w-[min(72rem,calc(100%-2rem))] sm:translate-y-0"
          onFocusOutside={preventDialogDismissOnPortaledContent}
          onPointerDownOutside={preventDialogDismissOnPortaledContent}
          onInteractOutside={preventDialogDismissOnPortaledContent}
        >
          <DialogHeader className="mx-0 mt-0 shrink-0 border-b-0">
            <DialogTitle>Browse fixtures</DialogTitle>
            <DialogDescription>
              Pick a match or race to track.
            </DialogDescription>
          </DialogHeader>
          {open ? <FixtureBrowserContent variant="dialog" /> : null}
        </DialogContent>
      </Dialog>
    </TrackFixtureContext.Provider>
  );
}
