"use client";

import Link from "next/link";
import { MoneyFlow } from "@/components/money-flow";
import type { BetRow, HistoryRow } from "@/lib/db/schema";
import {
  formatBetMeta,
  formatHistoryEventLine,
  formatHistoryPromoLine,
  formatHistoryTimeBadgeParts,
  historyEntrySubtitle,
  historyEntryTitle,
  historyKindLabel,
  historySettledNote,
  isFreeBetPlacedHistoryEntry,
  isFreeBetWonHistoryEntry,
  resolveHistoryEvent,
  showHistoryBetLabel,
  showHistoryPromoField,
  showHistoryTriggerField,
  type HistoryContext,
} from "@/lib/history-display";
import { SportIcon } from "@/components/sport-icon";
import { cn } from "@/lib/utils";
import {
  CircleCheck,
  CircleX,
  Flag,
  Gift,
  Goal,
  NotebookPen,
  Play,
  PlusCircle,
  Zap,
} from "lucide-react";

const freeBetIconClass = "text-violet-600 dark:text-violet-400";
const freeBetTextClass = "text-violet-700 dark:text-violet-300";

function HistoryEntryTitleDisplay({
  title,
  freeBetPlaced,
  freeBetWon,
  className,
}: {
  title: string;
  freeBetPlaced: boolean;
  freeBetWon: boolean;
  className?: string;
}) {
  if (freeBetPlaced) {
    return (
      <span className={cn("truncate", freeBetTextClass, className)}>{title}</span>
    );
  }

  if (freeBetWon) {
    const marker = "Free bet won!";
    const idx = title.indexOf(marker);
    if (idx >= 0) {
      const before = title.slice(0, idx);
      const after = title.slice(idx + marker.length);
      return (
        <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1", className)}>
          {before ? <span className="truncate">{before}</span> : null}
          <span className={cn("shrink-0", freeBetTextClass)}>{marker}</span>
          {after ? <span className="truncate">{after}</span> : null}
          <Gift className={cn("size-3.5 shrink-0", freeBetIconClass)} aria-hidden />
        </span>
      );
    }

    return (
      <span className={cn("inline-flex min-w-0 max-w-full items-center gap-1", className)}>
        <span className={cn("truncate", freeBetTextClass)}>{title}</span>
        <Gift className={cn("size-3.5 shrink-0", freeBetIconClass)} aria-hidden />
      </span>
    );
  }

  return <span className={cn("truncate", className)}>{title}</span>;
}

function HistoryTimeBadgeDisplay({
  entry,
  ctx,
  className,
  spanSubtitleRow = false,
}: {
  entry: HistoryRow;
  ctx: HistoryContext;
  className?: string;
  /** When the row already has a subtitle line, stack the date/time in that space. */
  spanSubtitleRow?: boolean;
}) {
  const { primary, secondary } = formatHistoryTimeBadgeParts(entry, ctx);

  if (!secondary) {
    return (
      <span className={cn("whitespace-nowrap tabular-nums", className)}>{primary}</span>
    );
  }

  const stacked = (
    <span className="flex flex-col leading-tight tabular-nums">
      <span className="whitespace-nowrap">{primary}</span>
      <span className="whitespace-nowrap">{secondary}</span>
    </span>
  );

  if (spanSubtitleRow) {
    return <span className={cn("self-center tabular-nums", className)}>{stacked}</span>;
  }

  // Keep two-line badges out of document flow so row height stays title-driven.
  return (
    <div className={cn("relative h-0 self-start overflow-visible", className)}>
      <div className="absolute left-0 top-0">{stacked}</div>
    </div>
  );
}

function historyIcon(entry: HistoryRow, ctx: HistoryContext) {
  const freeBetPlaced = isFreeBetPlacedHistoryEntry(entry, ctx);
  const win = (entry.amount ?? 0) > 0.004;
  const loss = (entry.amount ?? 0) < -0.004;

  if (entry.kind === "bet_placed") {
    if (freeBetPlaced) return <PlusCircle className={cn("size-3.5", freeBetIconClass)} />;
    return <PlusCircle className="size-3.5 text-primary" />;
  }
  if (entry.kind === "goal") return <Goal className="size-3.5 text-emerald-600 dark:text-emerald-400" />;
  if (entry.kind === "kickoff") return <Play className="size-3.5 text-primary" />;
  if (entry.kind === "full_time") return <Flag className="size-3.5 text-sky-600 dark:text-sky-400" />;
  if (entry.kind === "two_up") return <Zap className="size-3.5 text-amber-500" />;
  if (win) return <CircleCheck className="size-3.5 text-emerald-600" />;
  if (loss || isFreeBetWonHistoryEntry(entry)) return <CircleX className="size-3.5 text-negative" />;
  return <CircleCheck className="size-3.5 text-muted-foreground" />;
}

function entryTint(entry: HistoryRow) {
  const isSettlement = entry.kind === "settlement";
  const win = (entry.amount ?? 0) > 0.004;
  const loss = (entry.amount ?? 0) < -0.004;
  if (!isSettlement) return "";
  if (win) return "history-settlement-tint-win";
  if (loss || isFreeBetWonHistoryEntry(entry)) return "history-settlement-tint-loss";
  return "";
}

export function HistoryEntryRow({
  entry,
  ctx,
  compact = false,
}: {
  entry: HistoryRow;
  ctx: HistoryContext;
  compact?: boolean;
}) {
  const isSettlement = entry.kind === "settlement";
  const bet = entry.betId != null ? ctx.betsById.get(entry.betId) : undefined;
  const event = resolveHistoryEvent(entry, ctx);
  const eventLine = formatHistoryEventLine(entry, ctx);
  const settledNote = historySettledNote(entry, ctx);
  const promo = entry.betId != null ? ctx.promoByBetId[entry.betId] : undefined;
  const subtitle = historyEntrySubtitle(entry, bet, promo);
  const compactDescription = compact ? (subtitle ?? eventLine) : undefined;
  const title = historyEntryTitle(entry, ctx);
  const freeBetPlaced = isFreeBetPlacedHistoryEntry(entry, ctx);
  const freeBetWon = isFreeBetWonHistoryEntry(entry);

  if (compact) {
    return (
      <div
        className={cn(
          "grid grid-cols-[minmax(4.75rem,auto)_1rem_minmax(0,1fr)_4.5rem] grid-rows-[auto_auto] items-start gap-x-2 gap-y-0.5 rounded-md border border-transparent py-2 pl-2 pr-[calc(0.5rem+0.5rem)] transition-colors hover:border-border/60 hover:bg-selection-subtle",
          entryTint(entry)
        )}
      >
        <HistoryTimeBadgeDisplay
          entry={entry}
          ctx={ctx}
          spanSubtitleRow={Boolean(compactDescription)}
          className={cn(
            "row-start-1 shrink-0 self-start text-left text-[11px] font-semibold text-muted-foreground",
            compactDescription && "row-span-2 self-center"
          )}
        />
        <div className="row-start-1 flex w-4 shrink-0 justify-center self-start pt-0.5">
          {historyIcon(entry, ctx)}
        </div>
        <HistoryEntryTitleDisplay
          title={title}
          freeBetPlaced={freeBetPlaced}
          freeBetWon={freeBetWon}
          className="col-start-3 row-start-1 self-start text-left text-[13px] font-medium leading-snug"
        />
        <span className="col-start-4 row-start-1 shrink-0 self-start text-right text-[13px] font-semibold tabular-nums">
          {isSettlement && entry.amount != null ? (
            <MoneyFlow value={entry.amount} signColor signDisplay />
          ) : null}
        </span>
        {compactDescription ? (
          <span className="col-start-3 col-end-5 row-start-2 min-w-0 truncate text-left text-xs text-muted-foreground">
            {compactDescription}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-border/60 hover:bg-selection-subtle",
        entryTint(entry)
      )}
    >
      <HistoryTimeBadgeDisplay
        entry={entry}
        ctx={ctx}
        className="w-[4.5rem] shrink-0 pt-0.5 text-left text-[11px] font-semibold text-muted-foreground"
      />
      <div className="flex w-4 shrink-0 justify-center pt-0.5">{historyIcon(entry, ctx)}</div>
      <span className="min-w-0 flex-1 text-left">
        <HistoryEntryTitleDisplay
          title={title}
          freeBetPlaced={freeBetPlaced}
          freeBetWon={freeBetWon}
          className="block text-[13px] font-medium"
        />
        {subtitle && (
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        )}
        {event && eventLine && (
          <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground/80">
            <SportIcon sport={event.sport} size={11} className="shrink-0 text-muted-foreground/70" />
            <span className="truncate">{eventLine}</span>
          </span>
        )}
        {settledNote && (
          <span className="mt-0.5 block text-[10px] text-muted-foreground">{settledNote}</span>
        )}
        {bet && isSettlement && (
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            {formatBetMeta(bet).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        )}
        {bet && entry.kind === "bet_placed" && (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            {formatBetMeta(bet).slice(0, 3).map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        )}
      </span>
      {isSettlement && entry.amount != null && (
        <span className="shrink-0 pt-0.5 text-[13px] font-semibold tabular-nums">
          <MoneyFlow value={entry.amount} signColor signDisplay />
        </span>
      )}
      {bet && (
        <Link
          href={`/tracker?highlight=${bet.id}`}
          className="shrink-0 pt-0.5 text-muted-foreground transition-colors hover:text-primary"
          aria-label="Open bet in tracker"
        >
          <NotebookPen className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

export function HistoryEntryCard({
  entry,
  ctx,
  bet,
}: {
  entry: HistoryRow;
  ctx: HistoryContext;
  bet?: BetRow;
}) {
  const settledNote = historySettledNote(entry, ctx);
  const promo = entry.betId != null ? ctx.promoByBetId[entry.betId] : undefined;
  const event = resolveHistoryEvent(entry, ctx);
  const eventLine = formatHistoryEventLine(entry, ctx, {
    omitRaceTime: entry.kind === "settlement" && event?.sport === "horse_racing",
  });
  const subtitle = historyEntrySubtitle(entry, bet, promo);
  const title = historyEntryTitle(entry, ctx);
  const freeBetPlaced = isFreeBetPlacedHistoryEntry(entry, ctx);
  const freeBetWon = isFreeBetWonHistoryEntry(entry);

  return (
    <article className={cn("rounded-lg p-4 ring-1 ring-border/50", entryTint(entry))}>
      <div className="flex items-start gap-3">
        <div className="flex w-4 shrink-0 flex-col items-center gap-1 pt-1">
          {historyIcon(entry, ctx)}
          {event && <SportIcon sport={event.sport} size={16} className="text-muted-foreground" />}
        </div>

        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {historyKindLabel(entry.kind)}
                </span>
                <HistoryTimeBadgeDisplay
                  entry={entry}
                  ctx={ctx}
                  className="text-xs text-muted-foreground"
                />
              </div>
              <h3 className="mt-0.5 text-base font-bold leading-snug">
                <HistoryEntryTitleDisplay
                  title={title}
                  freeBetPlaced={freeBetPlaced}
                  freeBetWon={freeBetWon}
                />
              </h3>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
              {eventLine && <p className="mt-1 text-sm text-foreground/80">{eventLine}</p>}
              {settledNote && <p className="mt-1 text-xs text-muted-foreground">{settledNote}</p>}
            </div>
            {entry.kind === "settlement" && entry.amount != null && (
              <MoneyFlow value={entry.amount} signColor signDisplay className="shrink-0 text-xl font-bold" />
            )}
          </div>

          {bet && (
            <dl className="mt-4 flex flex-col gap-2 border-t pt-3 text-sm">
              {showHistoryBetLabel(bet) && (
                <div>
                  <dt className="text-xs text-muted-foreground">Bet</dt>
                  <dd className="font-medium">{bet.label}</dd>
                </div>
              )}
              {bet.bookmaker && (
                <div>
                  <dt className="text-xs text-muted-foreground">Bookie</dt>
                  <dd>{bet.bookmaker}</dd>
                </div>
              )}
              {bet.selection && (
                <div>
                  <dt className="text-xs text-muted-foreground">Selection</dt>
                  <dd>{bet.selection}</dd>
                </div>
              )}
              {bet.expectedProfit != null && entry.kind === "bet_placed" && (
                <div>
                  <dt className="text-xs text-muted-foreground">Expected</dt>
                  <dd>
                    <MoneyFlow value={bet.expectedProfit} signColor signDisplay />
                  </dd>
                </div>
              )}
              {showHistoryPromoField(entry, promo) && (
                <div>
                  <dt className="text-xs text-muted-foreground">Promo</dt>
                  <dd className="text-violet-700 dark:text-violet-300">{formatHistoryPromoLine(promo!)}</dd>
                </div>
              )}
              {showHistoryTriggerField(bet) && (
                <div>
                  <dt className="text-xs text-muted-foreground">Trigger</dt>
                  <dd className="text-amber-700 dark:text-amber-400">{bet.triggerText}</dd>
                </div>
              )}
            </dl>
          )}

          {bet && (
            <div className="mt-3 flex justify-end">
              <Link
                href={`/tracker?highlight=${bet.id}`}
                className="text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                View in tracker →
              </Link>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function HistoryFeed({
  entries,
  ctx,
  compact = false,
  emptyMessage = "Nothing yet — key match moments and bet results land here in real time.",
}: {
  entries: HistoryRow[];
  ctx: HistoryContext;
  compact?: boolean;
  emptyMessage?: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <div className={cn("flex flex-col", compact ? "mt-2 gap-1.5 px-[var(--layout-card-x)]" : "gap-3")}>
      {entries.map((entry) => (
        <HistoryEntryRow key={entry.id} entry={entry} ctx={ctx} compact={compact} />
      ))}
    </div>
  );
}
