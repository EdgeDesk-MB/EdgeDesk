"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResponsibleGamblingNote } from "@/components/compliance/responsible-gambling-note";
import { api } from "@/hooks/use-app-state";
import { dialogTitleIcon } from "@/lib/ui/surface-styles";

/**
 * First-run 18+ confirmation (EDGE-13). Non-dismissible: the app only opens
 * once the user confirms, and the confirmation is persisted in app_settings
 * (`ageConfirmedAt`). Declining swaps to a blocking message rather than a
 * dead end. When accounts land (EDGE-19+) the same copy and note are reused
 * at signup — design once, reuse everywhere.
 */
export function AgeGateDialog({
  open,
  onConfirmed,
}: {
  open: boolean;
  onConfirmed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await api("/api/settings", {
        method: "PATCH",
        json: { ageConfirmedAt: Date.now() },
      });
      onConfirmed();
    } catch (e) {
      toast.error("Could not save confirmation", { description: String(e) });
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {declined ? (
          <>
            <DialogHeader className="pr-6">
              <DialogTitle>Over-18s only</DialogTitle>
              <DialogDescription>
                You must be 18 or over to use Edgeways.
              </DialogDescription>
            </DialogHeader>
            <ResponsibleGamblingNote />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeclined(false)}>
                Go back
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="pr-6">
              <DialogTitle className="flex items-center gap-2.5">
                <ShieldCheck className={dialogTitleIcon} /> Over-18s only
              </DialogTitle>
              <DialogDescription>
                You must be 18 or over to use Edgeways.
              </DialogDescription>
            </DialogHeader>
            <ResponsibleGamblingNote />
            <DialogFooter className="flex-col-reverse sm:justify-between">
              <Button
                variant="ghost"
                onClick={() => setDeclined(true)}
                disabled={busy}
              >
                I&apos;m under 18
              </Button>
              <Button onClick={confirm} disabled={busy}>
                Confirm I&apos;m 18 or over
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
