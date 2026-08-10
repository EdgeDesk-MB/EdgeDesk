import { Badge } from "@/components/ui/badge";
import {
  formatPriceTrustLabel,
  type OfferConfidence,
} from "@/lib/offers/place-refund-ev";
import type { OddsSource } from "@/lib/racing/odds";
import type { ExchangeOddsSource } from "@/lib/services/exchange/types";
import { cn } from "@/lib/utils";

export type EdgeDataSource = "demo" | "racing-api" | "error";

function trustTone(
  oddsSource?: OddsSource,
  exchangeSource?: ExchangeOddsSource,
  confidence?: OfferConfidence
): string {
  if (oddsSource === "manual") return "border-warning/40 text-warning";

  const backLive = oddsSource === "live";
  const layLive = exchangeSource === "live";
  if (backLive && layLive) return "border-success/40 text-success";
  if (backLive || layLive) return "border-warning/40 text-warning";

  if (confidence === "live") return "border-success/40 text-success";
  if (confidence === "mixed") return "border-warning/40 text-warning";
  return "border-border text-muted-foreground";
}

/**
 * What prices the user can trust on a play, in one chip.
 *
 * Demo data outranks everything: a play built from fixtures is not a live or
 * estimated reading of a real market. Shared by the Race picks dialog and the
 * offer card so the two surfaces cannot drift apart.
 */
export function OfferConfidenceBadge({
  confidence,
  oddsSource,
  exchangeSource,
  dataSource,
  className,
}: {
  confidence?: OfferConfidence;
  oddsSource?: OddsSource;
  exchangeSource?: ExchangeOddsSource;
  dataSource?: EdgeDataSource;
  className?: string;
}) {
  if (dataSource === "demo") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "h-5 shrink-0 border-edge/40 text-[11px] uppercase text-edge",
          className
        )}
      >
        Demo
      </Badge>
    );
  }

  const label = formatPriceTrustLabel(oddsSource, exchangeSource, confidence);

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 shrink-0 text-[11px] uppercase",
        trustTone(oddsSource, exchangeSource, confidence),
        className
      )}
    >
      {label}
    </Badge>
  );
}
