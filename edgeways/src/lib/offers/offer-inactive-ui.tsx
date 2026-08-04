import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const OFFER_INACTIVE_FIGURE_CLASS = "offer-inactive-figure";

export function isOfferExpired(offer: { status: string }): boolean {
  return offer.status === "expired";
}

export function isBetCancelled(bet: { status: string }): boolean {
  return bet.status === "void";
}

export function offerInactiveFigureClass(inactive?: boolean, className?: string) {
  return cn(inactive && OFFER_INACTIVE_FIGURE_CLASS, className);
}

/** Strike £ amounts in offer copy when a campaign is expired. */
export function OfferInactiveCurrencyText({
  text,
  inactive,
}: {
  text: string;
  inactive?: boolean;
}) {
  if (!inactive) return <>{text}</>;

  const parts = text.split(/([+-]?£[\d,.]+)/g);
  const nodes: ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    if (/^[+-]?£[\d,.]+$/.test(part)) {
      nodes.push(
        <span key={i} className={OFFER_INACTIVE_FIGURE_CLASS}>
          {part}
        </span>
      );
    } else if (part) {
      nodes.push(part);
    }
  }
  return <>{nodes}</>;
}
