import type { StripeMode } from "@/lib/billing/stripe-server";
import { demoDataTag } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/**
 * Test / Live mark for Stripe money. Same box as the Demo data tag so an
 * invented or test number can never be mistaken for real revenue.
 */
export function StripeModeChip({ mode }: { mode: StripeMode }) {
  return (
    <span
      className={cn(
        demoDataTag,
        mode === "live" && "bg-profit text-white"
      )}
    >
      {mode === "live" ? "Live" : "Test"}
    </span>
  );
}
