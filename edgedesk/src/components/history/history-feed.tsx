"use client";

import Link from "next/link";
import { MoneyFlow } from "@/components/money-flow";
import type { BetRow, HistoryRow } from "@/lib/db/schema";
import {
  formatBetMeta,
  formatHistoryEventLine,
  formatHistoryPromoLine,
  formatHistoryTimeBadge,
  formatHistoryTimeBadgeParts,
  historyEntryHref,
  historyEntryLinkLabel,
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
import { HistoryEntryIcon } from "@/components/history/history-entry-icon";
import { cn } from "@/lib/utils";
import { Gift } from "lucide-react";

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
    /** Inline nowrap unit - same text baseline as "Bet lost ·", gift stays on the line. */
    const wonBadge = (
      <span className={cn("whitespace-nowrap", freeBetTextClass)}>
        {marker}
        <Gift
          className={cn("ml-1 inline size-3.5 align-[-0.125em]", freeBetIconClass)}
          aria-hidden
        />
      </span>
    );
    if (idx >= 0) {
      const before = title.slice(0, idx);
      const after = title.slice(idx + marker.length);
      return (
        <span className={cn("min-w-0 max-w-full", className)}>
          {before}
          {wonBadge}
          {after}
        </span>
      );
    }

    return (
      <span className={cn("min-w-0 max-w-full", className)}>
        <span className={cn("whitespace-nowrap", freeBetTextClass)}>
          {title}
          <Gift
            className={cn("ml-1 inline size-3.5 align-[-0.125em]", freeBetIconClass)}
            aria-hidden
          />
        </span>
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
  /** Single-line "Yesterday, 20:43" - History page. Home keeps the stacked two-line badge. */
  inline = false,
}: {
  entry: HistoryRow;
  ctx: HistoryContext;
  className?: string;
  /** When the row already has a subtitle line, stack the date/time in that space. */
  spanSubtitleRow?: boolean;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <span className={cn("whitespace-nowrap tabular-nums", className)}>
        {formatHistoryTimeBadge(entry, ctx)}
      </span>
    );
  }

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

function entryTint(entry: HistoryRow) {
  const isSettlement = entry.kind === "settlement";
  const win = (entry.amount ?? 0) > 0.004;
  const loss = (entry.amount ?? 0) < -0.004;
  if (!isSettlement) return "";
  if (win) return "history-settlement-tint-win";
  if (loss || isFreeBetWonHistoryEntry(entry)) return "history-settlement-tint-loss";
  return "";
}

/** Top-right gradient tint - same 30° sweep as offer campaign cards */
function historyHeaderTint(entry: HistoryRow): string | null {
  if (entry.kind !== "settlement") return null;
  const amount = entry.amount ?? 0;
  if (amount > 0.004) return "offer-header-tint-win";
  if (amount < -0.004 || isFreeBetWonHistoryEntry(entry)) return "offer-header-tint-loss";
  return null;
}

function historyRowShellClass(entry: HistoryRow, compact: boolean) {
  return cn(
    "flex w-full min-w-0 items-start gap-2 rounded-md border border-transparent transition-colors hover:border-border/60 hover:bg-selection-subtle cursor-pointer",
    compact ? "box-border max-w-full px-2 py-2" : "self-stretch px-2 py-1.5",
    entryTint(entry)
  );
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
  const href = historyEntryHref(entry, ctx);
  const linkLabel = historyEntryLinkLabel(entry, ctx);

  if (compact) {
    return (
      <Link href={href} className={historyRowShellClass(entry, true)} aria-label={linkLabel}>
        <HistoryTimeBadgeDisplay
          entry={entry}
          ctx={ctx}
          spanSubtitleRow={Boolean(compactDescription)}
          className={cn(
            "w-[4.75rem] shrink-0 self-start text-left text-[11px] font-semibold text-muted-foreground",
            compactDescription && "self-center"
          )}
        />
        <div className="flex w-4 shrink-0 justify-center self-start pt-0.5">
          <HistoryEntryIcon entry={entry} ctx={ctx} />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <HistoryEntryTitleDisplay
            title={title}
            freeBetPlaced={freeBetPlaced}
            freeBetWon={freeBetWon}
            className="block text-[13px] font-medium leading-snug"
          />
          {compactDescription ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {compactDescription}
            </span>
          ) : null}
        </div>
        {isSettlement && entry.amount != null ? (
          <span className="ml-auto shrink-0 self-start text-right text-[13px] font-semibold tabular-nums">
            <MoneyFlow value={entry.amount} signColor signDisplay />
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <Link href={href} className={historyRowShellClass(entry, false)} aria-label={linkLabel}>
      <HistoryTimeBadgeDisplay
        entry={entry}
        ctx={ctx}
        className="w-[4.5rem] shrink-0 pt-0.5 text-left text-[11px] font-semibold text-muted-foreground"
      />
      <div className="flex w-4 shrink-0 justify-center pt-0.5">
        <HistoryEntryIcon entry={entry} ctx={ctx} />
      </div>
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
    </Link>
  );
}

export function HistoryEntryCard({
  entry,
  ctx,
  bet,
  collapsed = false,
}: {
  entry: HistoryRow;
  ctx: HistoryContext;
  bet?: BetRow;
  /** Hide bet details band — header summary only */
  collapsed?: boolean;
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
    <article className="offer-campaign-card overflow-hidden rounded-lg ring-1 ring-border/50 dark:ring-[color-mix(in_oklch,black_55%,var(--border))] dark:ring-opacity-100">
      <div
        className={cn(
          collapsed ? "px-3 py-2.5" : "px-4 pt-4 pb-3",
          historyHeaderTint(entry) ?? "bg-card"
        )}
      >
        <div className={cn("flex items-start", collapsed ? "gap-2" : "gap-3")}>
          <div
            className={cn(
              "flex w-4 shrink-0 flex-col items-center pt-0.5",
              collapsed ? "gap-0.5" : "gap-1 pt-1"
            )}
          >
            <HistoryEntryIcon entry={entry} ctx={ctx} />
            {event && !collapsed ? (
              <SportIcon sport={event.sport} size={16} className="text-muted-foreground" />
            ) : null}
          </div>

          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {historyKindLabel(entry.kind)}
                  </span>
                  <HistoryTimeBadgeDisplay
                    entry={entry}
                    ctx={ctx}
                    inline
                    className="text-[11px] text-muted-foreground"
                  />
                </div>
                <h3
                  className={cn(
                    "mt-0.5 font-bold leading-snug",
                    collapsed ? "text-sm" : "text-base"
                  )}
                >
                  <HistoryEntryTitleDisplay
                    title={title}
                    freeBetPlaced={freeBetPlaced}
                    freeBetWon={freeBetWon}
                  />
                </h3>
                {!collapsed && subtitle ? (
                  <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                ) : null}
                {!collapsed && eventLine ? (
                  <p className="mt-1 text-sm text-foreground/80">{eventLine}</p>
                ) : null}
                {!collapsed && settledNote ? (
                  <p className="mt-1 text-xs text-muted-foreground">{settledNote}</p>
                ) : null}
                {collapsed && eventLine ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{eventLine}</p>
                ) : null}
              </div>
              {entry.kind === "settlement" && entry.amount != null && (
                <MoneyFlow
                  value={entry.amount}
                  signColor
                  signDisplay
                  className={cn(
                    "shrink-0 font-bold tabular-nums",
                    collapsed ? "text-base" : "text-xl"
                  )}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {!collapsed && bet ? (
        <div className="border-t border-border/50 bg-card px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="w-4 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <dl className="flex flex-col gap-2 text-sm">
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

              <div className="mt-3 flex justify-end">
                <Link
                  href={`/tracker?highlight=${bet.id}`}
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  View in tracker →
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function HistoryFeed({
  entries,
  ctx,
  compact = false,
  emptyMessage = "Nothing yet - key match moments and bet results land here in real time.",
}: {
  entries: HistoryRow[];
  ctx: HistoryContext;
  compact?: boolean;
  emptyMessage?: string;
}) {
  if (entries.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", compact && "px-[var(--layout-card-x)] pt-2")}>
        {emptyMessage}
      </p>
    );
  }
  return (
    <div
      className={cn(
        "box-border flex w-full max-w-full min-w-0 flex-col",
        /* Compact Home: horizontal inset lives on the scrollport so rows can be 100% of the content box. */
        compact ? "mt-2 gap-1.5" : "gap-3"
      )}
    >
      {entries.map((entry) => (
        <HistoryEntryRow key={entry.id} entry={entry} ctx={ctx} compact={compact} />
      ))}
    </div>
  );
}
