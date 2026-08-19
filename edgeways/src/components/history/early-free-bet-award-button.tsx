"use client";

import { useState, type MouseEvent } from "react";
import { toast } from "sonner";
import { api } from "@/hooks/use-app-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogExplainer,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function EarlyFreeBetAwardButton({
  betId,
  amount,
  compact = false,
  onAwarded,
  className,
}: {
  betId: number;
  /** Expected free-bet amount, for confirm copy. */
  amount?: number;
  compact?: boolean;
  onAwarded?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function openConfirm(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (saving) return;
    setOpen(true);
  }

  async function confirmAward() {
    if (saving) return;
    setSaving(true);
    try {
      await api<{ awarded: boolean; amount: number }>(`/api/bets/${betId}/award-free-bet`, {
        method: "POST",
      });
      setOpen(false);
      toast.success("Free bet credited to bookie balance");
      onAwarded?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not mark free bet awarded");
    } finally {
      setSaving(false);
    }
  }

  const amountLabel =
    amount != null && Number.isFinite(amount) && amount > 0
      ? `£${amount.toFixed(amount % 1 === 0 ? 0 : 2)} `
      : "";

  return (
    <>
      <p
        className={cn(
          "text-muted-foreground",
          compact ? "mt-0.5 text-xs leading-snug" : "mt-1 text-sm leading-snug",
          className
        )}
      >
        If your free bet has been awarded, click{" "}
        <button
          type="button"
          onClick={openConfirm}
          className={cn(
            "font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300",
            compact ? "text-xs" : "text-sm"
          )}
          title="Bookie already released the free bet? Credit it now so settlement will not award it again."
          aria-label="Confirm free bet awarded"
        >
          here
        </button>
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent mobile="center" className="max-w-sm" showCloseButton={!saving}>
          <DialogHeader>
            <DialogTitle>Credit the free bet?</DialogTitle>
            <DialogDescription
              explainer={
                <DialogExplainer title="Credit now">
                  Settlement will not award this free bet again.
                </DialogExplainer>
              }
            >
              Credits the {amountLabel}free bet now.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void confirmAward()} disabled={saving}>
              {saving ? "Crediting…" : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
