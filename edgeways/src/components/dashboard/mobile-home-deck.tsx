"use client";

/**
 * Mobile Home swipe deck (C1) - one widget in focus at a time via CSS
 * scroll-snap, pagination dots, remembered last position. Rendered `< sm`
 * only; the desktop grid keeps the same components in a different container,
 * and widgets never know which mode they are in.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface HomeDeckCard {
  id: string;
  label: string;
  node: ReactNode;
}

const STORAGE_KEY = "edgeways-home-deck-card";

function readStoredCard(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeCard(id: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* private mode */
  }
}

export function MobileHomeDeck({
  cards,
  /** "auto" = context-aware start card; otherwise a pinned card id. */
  pin = "auto",
  hasOpenPositions = false,
  hasPlanWork = false,
  className,
}: {
  cards: HomeDeckCard[];
  pin?: string;
  hasOpenPositions?: boolean;
  hasPlanWork?: boolean;
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const didInitRef = useRef(false);

  const scrollToIndex = useCallback((index: number, smooth: boolean) => {
    const scroller = scrollerRef.current;
    const child = scroller?.children[index] as HTMLElement | undefined;
    if (!scroller || !child) return;
    scroller.scrollTo({
      left: child.offsetLeft - (scroller.clientWidth - child.clientWidth) / 2,
      behavior: smooth ? "smooth" : "instant",
    });
  }, []);

  // Initial position: this session's remembered card, else the user's pin,
  // else the deterministic context pick (open positions → chart; morning with
  // plan work → plan; otherwise hero). The programmatic scroll fires
  // onScroll, which sets the active index.
  useEffect(() => {
    if (didInitRef.current || cards.length === 0) return;
    didInitRef.current = true;
    const contextPick = hasOpenPositions
      ? "chart"
      : new Date().getHours() < 12 && hasPlanWork
        ? "plan"
        : "hero";
    const startId =
      readStoredCard() ?? (pin !== "auto" ? pin : contextPick);
    const index = cards.findIndex((c) => c.id === startId);
    if (index > 0) scrollToIndex(index, false);
  }, [cards, pin, hasOpenPositions, hasPlanWork, scrollToIndex]);

  const onScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.children.length === 0) return;
    const centre = scroller.scrollLeft + scroller.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < scroller.children.length; i++) {
      const child = scroller.children[i] as HTMLElement;
      const childCentre = child.offsetLeft + child.clientWidth / 2;
      const dist = Math.abs(childCentre - centre);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    setActiveIndex((prev) => {
      if (prev !== best && cards[best]) storeCard(cards[best].id);
      return best;
    });
  }, [cards]);

  if (cards.length === 0) return null;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      {/* Full-bleed: mobile uses the whole page, no desktop-style gutters. */}
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        role="group"
        aria-roledescription="carousel"
        aria-label="Home widgets"
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((card, i) => (
          <div
            key={card.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${card.label} (${i + 1} of ${cards.length})`}
            className="flex w-screen shrink-0 snap-center flex-col overflow-hidden bg-background"
          >
            <div className="app-scroll-nested min-h-0 flex-1 overflow-y-auto">
              {card.node}
            </div>
          </div>
        ))}
      </div>

      <div className="flex shrink-0 items-center justify-center pb-1.5">
        {cards.map((card, i) => (
          <button
            key={card.id}
            type="button"
            aria-label={`Go to ${card.label}`}
            aria-current={i === activeIndex ? "true" : undefined}
            className="flex size-8 items-center justify-center"
            onClick={() => scrollToIndex(i, true)}
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full transition-colors",
                i === activeIndex ? "bg-primary" : "bg-muted-foreground/30"
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
