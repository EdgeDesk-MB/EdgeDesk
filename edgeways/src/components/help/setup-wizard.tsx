"use client";

/**
 * First-run setup wizard (G2b). Dialog is bank → bookies → defaults → alerts.
 * Dialog wrapper. Hosted `/setup` adds profile questions before these steps.
 */

import { useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SetupWizardForm } from "@/components/help/setup-wizard-form";

export function SetupWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const dirtyRef = useRef(false);

  function requestClose() {
    if (
      dirtyRef.current &&
      typeof window !== "undefined" &&
      !window.confirm("Leave set-up? You can come back and finish later.")
    ) {
      return;
    }
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          requestClose();
          return;
        }
        onOpenChange(true);
      }}
    >
      {open ? (
        <DialogContent className="sm:max-h-[min(40rem,calc(100dvh-2rem))] sm:max-w-lg sm:overflow-y-auto">
          <SetupWizardForm
            variant="dialog"
            onDirtyChange={(dirty) => {
              dirtyRef.current = dirty;
            }}
            onDismiss={requestClose}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
