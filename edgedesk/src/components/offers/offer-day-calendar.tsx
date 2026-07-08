"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildOfferCalendarDays } from "@/lib/offers/offer-calendar";
import type { OfferSummary } from "@/lib/services/offers";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";

function kindBadge(kind: "expires" | "planned" | "action") {
  switch (kind) {
    case "expires":
      return "border-amber-500/30 text-amber-800 dark:text-amber-300";
    case "planned":
      return "border-border text-muted-foreground";
    case "action":
      return "border-primary/30 text-primary";
  }
}

export function OfferDayCalendar({
  offers,
  className,
}: {
  offers: OfferSummary[];
  className?: string;
}) {
  const days = buildOfferCalendarDays(offers, { horizonDays: 14 });
  if (days.length === 0) return null;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4 text-primary" aria-hidden />
          <CardTitle section>Offer calendar</CardTitle>
        </div>
        <CardDescription>
          Next 14 days — actions, planned starts and expiries. Day list, not a month grid.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {days.map((day) => (
          <section key={day.dateKey} className="min-w-0">
            <h3
              className={cn(
                "mb-1.5 text-xs font-bold uppercase tracking-wide",
                day.isToday ? "text-primary" : "text-muted-foreground"
              )}
            >
              {day.label}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {day.items.map((item) => (
                <li key={`${day.dateKey}-${item.offerId}-${item.kind}`}>
                  <Link
                    href={`/offers?highlight=${item.offerId}`}
                    className="flex items-start justify-between gap-3 rounded-md border border-transparent px-2 py-2 transition-colors hover:border-border/60 hover:bg-selection-subtle"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn("text-[10px] uppercase", kindBadge(item.kind))}>
                          {item.label}
                        </Badge>
                        {item.offer.bookmaker ? (
                          <span className="text-[11px] text-muted-foreground">
                            {item.offer.bookmaker}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-sm font-medium">{item.offer.title}</p>
                      {item.kind === "action" ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.detail}</p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
