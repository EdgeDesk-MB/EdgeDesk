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
            <DialogHeader>
              <DialogTitle>Edgeways is for over-18s only</DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-col gap-2">
                  <p>
                    You must be 18 or over to use Edgeways, so we can&apos;t let
                    you in today. If someone else&apos;s gambling is affecting
                    you, support is available.
                  </p>
                  <ResponsibleGamblingNote />
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeclined(false)}>
                Go back
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4" /> Edgeways is for over-18s only
              </DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-col gap-2">
                  <p>
                    Edgeways tracks matched betting, staking against bookmaker
                    promotions. You must be 18 or over to use it.
                  </p>
                  <ResponsibleGamblingNote />
                </div>
              </DialogDescription>
            </DialogHeader>
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
