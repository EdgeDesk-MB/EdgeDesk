"use client";

/**
 * "Fill slip" (J9) - emits a betslip intent for the browser extension and
 * copies the stake first, so the button is useful with or without the
 * extension installed. Fill only; placing is always the user's click on
 * the exchange.
 */

import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { emitFillSlip, type BetslipIntent } from "@/lib/betslip-intent";
import { cn } from "@/lib/utils";

export function FillSlipButton({
  intent,
  className,
  size = "sm",
}: {
  intent: BetslipIntent;
  className?: string;
  size?: "sm" | "default";
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={cn("gap-1.5", className)}
      onClick={() => {
        void emitFillSlip(intent).then((ok) => {
          if (ok) {
            toast.success(`Stake £${intent.stake.toFixed(2)} copied`, {
              description:
                "The extension fills the exchange slip if installed - you always place the bet yourself.",
            });
          }
        });
      }}
    >
      <ClipboardCheck className="size-3.5" aria-hidden /> Fill slip
    </Button>
  );
}
