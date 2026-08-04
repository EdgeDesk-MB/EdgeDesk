"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildOfferCalendarBoard,
  buildOfferCalendarDays,
  countCalendarPriorities,
  filterCalendarBoardByPriority,
  filterCalendarDaysByPriority,
  type OfferCalendarItem,
  type OfferCalendarPriority,
} from "@/lib/offers/offer-calendar";
import type { OfferSummary } from "@/lib/services/offers.types";
import { isOfferExpired } from "@/lib/offers/offer-inactive-ui";
import { formatOfferDaysLeftLabel } from "@/lib/offers/offer-expiry";
import { VenueBadge } from "@/components/venue-badge";
import { OfferPipelineStrip } from "@/components/offers/offer-pipeline-strip";
import { OfferCategoryIcon } from "@/components/offers/offer-category-icon";
import { Badge } from "@/components/ui/badge";
import {
  offerCategoryFromSport,
  offerCategoryLabel,
} from "@/lib/offers/offer-categories";
import {
  filterPillCountState,
  filterPillGroup,
  filterPillState,
  offerCalendarCardShell,
} from "@/lib/ui/surface-styles";
import { moneyPositiveClass } from "@/components/money-flow";
import { cn } from "@/lib/utils";
import { CalendarDays, Columns3, List } from "lucide-react";

type CalendarView = "board" | "agenda";

const VIEW_STORAGE_KEY = "edgeways:offer-calendar-view";
const PRIORITY_FILTER_STORAGE_KEY = "edgeways:offer-calendar-priority-filter";

const ALL_PRIORITIES: OfferCalendarPriority[] = ["critical", "high", "medium", "low"];

const PRIORITY_LABELS: Record<OfferCalendarPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

function readStoredView(): CalendarView {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY);
    return raw === "agenda" || raw === "board" ? raw : "board";
  } catch {
    return "board";
  }
}

function readStoredPriorityFilter(): Set<OfferCalendarPriority> | null {
  try {
    const raw = localStorage.getItem(PRIORITY_FILTER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter(
      (p): p is OfferCalendarPriority =>
        p === "critical" || p === "high" || p === "medium" || p === "low"
    );
    return valid.length > 0 ? new Set(valid) : null;
  } catch {
    return null;
  }
}

function storePriorityFilter(filter: Set<OfferCalendarPriority> | null) {
  try {
    if (!filter || filter.size === 0) {
      localStorage.removeItem(PRIORITY_FILTER_STORAGE_KEY);
    } else {
      localStorage.setItem(PRIORITY_FILTER_STORAGE_KEY, JSON.stringify([...filter]));
    }
  } catch {
    // ignore
  }
}

function priorityStyles(priority: OfferCalendarPriority) {
  switch (priority) {
    case "critical":
      return {
        bar: "bg-rose-500",
        dot: "bg-rose-500",
        label: "Critical",
      };
    case "high":
      return {
        bar: "bg-amber-500",
        dot: "bg-amber-500",
        label: "High",
      };
    case "medium":
      return {
        bar: "bg-sky-500",
        dot: "bg-sky-500",
        label: "Medium",
      };
    case "low":
      return {
        bar: "bg-muted-foreground/40",
        dot: "bg-muted-foreground/50",
        label: "Low",
      };
  }
}

function PriorityFilterBar({
  selected,
  counts,
  onChange,
}: {
  selected: Set<OfferCalendarPriority> | null;
  counts: Record<OfferCalendarPriority, number>;
  onChange: (next: Set<OfferCalendarPriority> | null) => void;
}) {
  const showAll = selected === null || selected.size === 0;

  function toggleAll() {
    onChange(null);
  }

  function togglePriority(priority: OfferCalendarPriority) {
    if (showAll) {
      onChange(new Set([priority]));
      return;
    }
    const next = new Set(selected);
    if (next.has(priority)) {
      next.delete(priority);
      onChange(next.size === 0 ? null : next);
      return;
    }
    next.add(priority);
    if (next.size === ALL_PRIORITIES.length) {
      onChange(null);
      return;
    }
    onChange(next);
  }

  return (
    <div
      className={filterPillGroup}
      role="group"
      aria-label="Filter by priority"
    >
      <button
        type="button"
        onClick={toggleAll}
        className={cn(filterPillState(showAll), "text-[11px]")}
      >
        All
      </button>
      {ALL_PRIORITIES.map((priority) => {
        const active = !showAll && selected!.has(priority);
        const p = priorityStyles(priority);
        const count = counts[priority];
        const hasCount = count > 0;
        return (
          <button
            key={priority}
            type="button"
            onClick={() => togglePriority(priority)}
            className={cn(filterPillState(active, { hasCount }), "text-[11px]")}
            title={`${p.label} priority`}
          >
            <span className={cn("size-1.5 shrink-0 rounded-full", p.dot)} aria-hidden />
            {PRIORITY_LABELS[priority]}
            {hasCount ? (
              <span className={filterPillCountState(active)}>{count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Remaining expected value — plain text on header tint, like Campaign exp. profit. */
function RemainingEvBadge({
  remainingEv,
  variant,
}: {
  remainingEv: number;
  variant: "board" | "agenda";
}) {
  if (remainingEv <= 0.5) return null;
  const amount = remainingEv >= 10 ? remainingEv.toFixed(0) : remainingEv.toFixed(1);
  return (
    <div
      className="shrink-0 text-right"
      title="Estimated remaining expected value on this offer"
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Est.
      </p>
      <p
        className={cn(
          "font-bold tabular-nums",
          moneyPositiveClass,
          variant === "board" ? "text-base" : "text-2xl"
        )}
      >
        £{amount}
      </p>
    </div>
  );
}

/** Agenda day total — white pill, grey Est. label, bright green amount. */
function DayEstPill({ amount }: { amount: number }) {
  const formatted = amount >= 10 ? amount.toFixed(0) : amount.toFixed(1);
  return (
    <span
      className="inline-flex items-baseline gap-0.5 rounded-full bg-white px-2 py-0.5 text-[10px] ring-1 ring-border/50 dark:bg-card"
      title="Sum of estimated remaining EV for offers on this day"
    >
      <span className="font-medium text-muted-foreground">Est.</span>
      <span className={cn("font-bold tabular-nums", moneyPositiveClass)}>
        £{formatted}
      </span>
    </span>
  );
}

function calendarHeaderTint(offer: OfferSummary, remainingEv: number): string | null {
  if (isOfferExpired(offer)) return "offer-header-tint-expired";
  // Tint follows the Est. remaining EV shown on the card, not realised
  // totalProfit (which includes sunk qualifying losses mid-pipeline).
  if (remainingEv > 0.5) return "offer-header-tint-win";
  if (remainingEv < -0.005) return "offer-header-tint-loss";
  return null;
}

function CalendarItemCard({
  item,
  variant = "board",
  onOfferClick,
}: {
  item: OfferCalendarItem;
  variant?: "board" | "agenda";
  onOfferClick?: (offer: OfferSummary) => void;
}) {
  const p = priorityStyles(item.priority);
  const expiry = formatOfferDaysLeftLabel(item.daysLeft);
  const headerTint = calendarHeaderTint(item.offer, item.remainingEv);
  const categoryId = offerCategoryFromSport(item.offer.sport);
  const categoryLabel = offerCategoryLabel(item.offer.sport);

  return (
    <button
      type="button"
      onClick={() => onOfferClick?.(item.offer)}
      className={cn(offerCalendarCardShell, "w-full")}
      aria-label={`View campaign: ${item.offer.title} (${p.label} priority)`}
    >
      <span className={cn("z-10 w-1 shrink-0 self-stretch", p.bar)} aria-hidden />
      <div
        className={cn(
          "relative z-[2] min-w-0 flex-1",
          headerTint ?? "bg-card",
          variant === "board"
            ? "px-3 pt-[10px] pb-6"
            : "px-2.5 pt-2 pb-5"
        )}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {item.offer.bookmaker ? (
                  <VenueBadge name={item.offer.bookmaker} size="sm" />
                ) : null}
                <Badge
                  variant="outline"
                  className="h-auto gap-1 px-2 py-0.5 text-[10px] font-medium leading-tight"
                >
                  <OfferCategoryIcon category={categoryId} size={10} className="opacity-80" />
                  {categoryLabel}
                </Badge>
              </div>
              <p
                className={cn(
                  "mt-1 break-words font-bold leading-snug",
                  variant === "board" ? "text-sm" : "text-base"
                )}
              >
                {item.offer.title}
              </p>
            </div>
            <RemainingEvBadge remainingEv={item.remainingEv} variant={variant} />
          </div>

          <OfferPipelineStrip
            offer={item.offer}
            className={cn("mt-1", variant === "agenda" && "pr-0.5")}
          />

          {expiry ? (
            <p
              className={cn(
                "text-[10px] font-medium tabular-nums",
                item.daysLeft != null && item.daysLeft < 1
                  ? "text-rose-700 dark:text-rose-300"
                  : item.daysLeft != null && item.daysLeft < 2
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-muted-foreground"
              )}
            >
              {expiry}
            </p>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function BoardView({
  offers,
  priorityFilter,
  onOfferClick,
}: {
  offers: OfferSummary[];
  priorityFilter: Set<OfferCalendarPriority> | null;
  onOfferClick?: (offer: OfferSummary) => void;
}) {
  const columns = useMemo(() => {
    const board = buildOfferCalendarBoard(offers);
    return filterCalendarBoardByPriority(board, priorityFilter);
  }, [offers, priorityFilter]);

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {columns.map((col) => {
        const columnEv = col.items.reduce((sum, i) => sum + Math.max(0, i.remainingEv), 0);
        return (
        <section
          key={col.id}
          className={cn(
            "flex min-h-[8rem] flex-col rounded-lg border border-border/60",
            col.id !== "later" && "bg-muted/15",
            col.id === "later" && "bg-background"
          )}
        >
          <header className="flex items-start justify-between gap-2 border-b border-border/50 px-3 py-2">
            <div className="min-w-0">
              <h3 className="text-xs font-bold uppercase tracking-wide text-foreground">
                {col.title}
              </h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{col.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {columnEv > 0.5 ? <DayEstPill amount={columnEv} /> : null}
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                {col.items.length}
              </span>
            </div>
          </header>
          <ul className="flex flex-1 flex-col gap-2 p-2">
            {col.items.length === 0 ? (
              <li className="px-2 py-6 text-center text-[11px] text-muted-foreground">
                Nothing here
              </li>
            ) : (
              col.items.map((item) => (
                <li key={`${col.id}-${item.offerId}-${item.kind}`}>
                  <CalendarItemCard item={item} variant="board" onOfferClick={onOfferClick} />
                </li>
              ))
            )}
          </ul>
        </section>
        );
      })}
    </div>
  );
}

function AgendaView({
  offers,
  priorityFilter,
  onOfferClick,
}: {
  offers: OfferSummary[];
  priorityFilter: Set<OfferCalendarPriority> | null;
  onOfferClick?: (offer: OfferSummary) => void;
}) {
  const days = useMemo(() => {
    const agenda = buildOfferCalendarDays(offers, { horizonDays: 14 });
    return filterCalendarDaysByPriority(agenda, priorityFilter);
  }, [offers, priorityFilter]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col gap-3">
      {days.map((day) => {
        const isCollapsed = collapsed[day.dateKey] === true;
        const criticalCount = day.items.filter((i) => i.priority === "critical").length;
        const dayEv = day.items.reduce((sum, i) => sum + Math.max(0, i.remainingEv), 0);
        return (
          <section
            key={day.dateKey}
            className={cn(
              "overflow-hidden rounded-lg border border-border/60",
              day.isToday && "border-primary/30"
            )}
          >
            <button
              type="button"
              onClick={() =>
                setCollapsed((prev) => ({ ...prev, [day.dateKey]: !isCollapsed }))
              }
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
                "bg-muted/40 hover:bg-muted/60 dark:bg-input/25 dark:hover:bg-input/40",
                day.isToday && "bg-primary/10 hover:bg-primary/15 dark:bg-primary/15"
              )}
            >
              <h3
                className={cn(
                  "flex-1 text-xs font-bold uppercase tracking-wide",
                  day.isToday ? "text-primary-text" : "text-foreground"
                )}
              >
                {day.label}
              </h3>
              {dayEv > 0.5 ? <DayEstPill amount={dayEv} /> : null}
              {criticalCount > 0 ? (
                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-800 dark:text-rose-300">
                  {criticalCount} critical
                </span>
              ) : null}
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {day.items.length}
              </span>
              <span
                className={cn(
                  "text-muted-foreground transition-transform",
                  !isCollapsed && "rotate-180"
                )}
                aria-hidden
              >
                ▾
              </span>
            </button>
            {!isCollapsed ? (
              <ul className="flex flex-col gap-2 border-t border-border/50 p-2">
                {day.items.map((item) => (
                  <li key={`${day.dateKey}-${item.offerId}-${item.kind}`}>
                    <CalendarItemCard
                      item={item}
                      variant="agenda"
                      onOfferClick={onOfferClick}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

export function OfferDayCalendar({
  offers,
  className,
  onOfferClick,
  /** When true (standalone page), always render - empty state included. */
  standalone = false,
}: {
  offers: OfferSummary[];
  className?: string;
  onOfferClick?: (offer: OfferSummary) => void;
  standalone?: boolean;
}) {
  // Stored preferences load after mount: reading localStorage during the first
  // render would disagree with the server HTML and break hydration.
  const [view, setView] = useState<CalendarView>("board");
  const [priorityFilter, setPriorityFilter] = useState<Set<OfferCalendarPriority> | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setView(readStoredView());
      setPriorityFilter(readStoredPriorityFilter());
    });
  }, []);

  const hasItems = useMemo(
    () => buildOfferCalendarDays(offers, { horizonDays: 14 }).length > 0,
    [offers]
  );
  const priorityCounts = useMemo(() => countCalendarPriorities(offers), [offers]);
  const filteredHasItems = useMemo(() => {
    if (view === "board") {
      return filterCalendarBoardByPriority(buildOfferCalendarBoard(offers), priorityFilter).some(
        (col) => col.items.length > 0
      );
    }
    return filterCalendarDaysByPriority(buildOfferCalendarDays(offers, { horizonDays: 14 }), priorityFilter).length > 0;
  }, [offers, priorityFilter, view]);

  if (!hasItems && !standalone) return null;

  function changeView(next: CalendarView) {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  function changePriorityFilter(next: Set<OfferCalendarPriority> | null) {
    setPriorityFilter(next);
    storePriorityFilter(next);
  }

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <PriorityFilterBar
        selected={priorityFilter}
        counts={priorityCounts}
        onChange={changePriorityFilter}
      />
      <div className={filterPillGroup}>
        <button
          type="button"
          onClick={() => changeView("board")}
          className={cn(
            filterPillState(view === "board"),
            "inline-flex items-center gap-1 px-2.5 py-1 text-[11px]"
          )}
        >
          <Columns3 className="size-3" />
          Board
        </button>
        <button
          type="button"
          onClick={() => changeView("agenda")}
          className={cn(
            filterPillState(view === "agenda"),
            "inline-flex items-center gap-1 px-2.5 py-1 text-[11px]"
          )}
        >
          <List className="size-3" />
          Agenda
        </button>
      </div>
    </div>
  );

  const emptyFilterMessage = (
    <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
      No offers match the selected priority filter.
    </p>
  );

  if (standalone) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {toolbar}
        {!hasItems ? (
          <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            No offer actions or expiries in the next 14 days.
          </p>
        ) : !filteredHasItems ? (
          emptyFilterMessage
        ) : view === "board" ? (
          <BoardView
            offers={offers}
            priorityFilter={priorityFilter}
            onOfferClick={onOfferClick}
          />
        ) : (
          <AgendaView
            offers={offers}
            priorityFilter={priorityFilter}
            onOfferClick={onOfferClick}
          />
        )}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary-text" aria-hidden />
              <CardTitle section>Offer calendar</CardTitle>
            </div>
            <CardDescription>
              Next 14 days - priority first. Board for tasks, agenda by day.
            </CardDescription>
          </div>
          {toolbar}
        </div>
      </CardHeader>
      <CardContent>
        {!hasItems ? (
          <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            No offer actions or expiries in the next 14 days.
          </p>
        ) : !filteredHasItems ? (
          emptyFilterMessage
        ) : view === "board" ? (
          <BoardView
            offers={offers}
            priorityFilter={priorityFilter}
            onOfferClick={onOfferClick}
          />
        ) : (
          <AgendaView
            offers={offers}
            priorityFilter={priorityFilter}
            onOfferClick={onOfferClick}
          />
        )}
      </CardContent>
    </Card>
  );
}
