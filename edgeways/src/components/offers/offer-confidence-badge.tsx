import { Badge } from "@/components/ui/badge";
import {
  formatConfidenceLabel,
  formatOddsSourceLabel,
  type OfferConfidence,
} from "@/lib/offers/place-refund-ev";
import type { OddsSource } from "@/lib/racing/odds";
import { cn } from "@/lib/utils";

export type EdgeDataSource = "demo" | "racing-api" | "error";

/**
 * How much to trust a play's figures, in one chip.
 *
 * Demo data outranks everything: a play built from fixtures is not an estimate of
 * anything real, so it must never wear a confidence tier. Shared by the Race picks
 * dialog and the offer card so the two surfaces cannot drift apart.
 */
export function OfferConfidenceBadge({
  confidence,
  oddsSource,
  dataSource,
  className,
}: {
  confidence?: OfferConfidence;
  oddsSource?: OddsSource;
  dataSource?: EdgeDataSource;
  className?: string;
}) {
  if (dataSource === "demo") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "h-4 shrink-0 border-edge/40 text-[9px] uppercase text-edge",
          className
        )}
      >
        Demo
      </Badge>
    );
  }

  const label = confidence
    ? formatConfidenceLabel(confidence)
    : formatOddsSourceLabel(oddsSource, dataSource);

  const tone =
    confidence === "live" || (!confidence && oddsSource === "live")
      ? "border-success/40 text-success"
      : confidence === "mixed" || (!confidence && oddsSource === "proxy")
        ? "border-warning/40 text-warning"
        : "border-border text-muted-foreground";

  return (
    <Badge variant="outline" className={cn("h-4 shrink-0 text-[9px] uppercase", tone, className)}>
      {label}
    </Badge>
  );
}
