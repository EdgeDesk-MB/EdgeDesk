"use client";

/**
 * First-run setup wizard (G2b). Dialog is bank → bookies → defaults → alerts.
 * Dialog wrapper. Hosted `/setup` adds profile questions before these steps.
 */

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { SetupWizardForm } from "@/components/help/setup-wizard-form";

export function SetupWizard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent className="sm:max-h-[min(40rem,calc(100dvh-2rem))] sm:max-w-lg sm:overflow-y-auto">
          <SetupWizardForm
            variant="dialog"
            onDismiss={() => onOpenChange(false)}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
