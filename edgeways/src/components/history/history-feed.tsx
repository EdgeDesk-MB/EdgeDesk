"use client";

import { useEffect, useState } from "react";
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
import { EarlyFreeBetAwardButton } from "@/components/history/early-free-bet-award-button";
import {
  BalanceCorrectionDetailLine,
  balanceCorrectionNoteText,
} from "@/components/history/balance-correction-note";
import {
  showEarlyFreeBetAwardButton,
  unconditionalFreeBetEffect,
} from "@/lib/offers/early-free-bet-award";
import { cn } from "@/lib/utils";
import { Gift } from "lucide-react";

/** Local override so a saved note paints before the parent refresh lands. */
function useBalanceCorrectionNote(entry: HistoryRow) {
  const [override, setOverride] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setOverride(undefined);
  }, [entry.id, entry.note]);
  const fromEntry = balanceCorrectionNoteText(entry);
  const note =
    override !== undefined ? (override?.trim() ? override.trim() : undefined) : fromEntry;
  const displayEntry =
    override !== undefined ? ({ ...entry, note: override } as HistoryRow) : entry;
  return { note, displayEntry, setNote: setOverride };
}

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
  /** Single-line "Today, 08:56" / "Yesterday, 20:43" - History page. Home keeps the stacked two-line badge. */
  inline = false,
}: {
  entry: HistoryRow;
  ctx: HistoryContext;
  className?: string;
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

  return (
    <span className={cn("flex flex-col leading-tight tabular-nums", className)}>
      <span className="whitespace-nowrap">{primary}</span>
      <span className="whitespace-nowrap">{secondary}</span>
    </span>
  );
}

function isPnlSettlementKind(kind: HistoryRow["kind"]): boolean {
  return (
    kind === "settlement" ||
    kind === "casino_settlement" ||
    kind === "balance_adjustment"
  );
}

function entryTint(entry: HistoryRow) {
  const win = (entry.amount ?? 0) > 0.004;
  const loss = (entry.amount ?? 0) < -0.004;
  if (!isPnlSettlementKind(entry.kind)) return "";
  if (win) return "history-settlement-tint-win";
  if (loss || isFreeBetWonHistoryEntry(entry)) return "history-settlement-tint-loss";
  return "";
}

/** Top-right gradient tint - same 30° sweep as offer campaign cards */
function historyHeaderTint(entry: HistoryRow): string | null {
  if (!isPnlSettlementKind(entry.kind)) return null;
  const amount = entry.amount ?? 0;
  if (amount > 0.004) return "offer-header-tint-win";
  if (amount < -0.004 || isFreeBetWonHistoryEntry(entry)) return "offer-header-tint-loss";
  return null;
}

function historyRowShellClass(entry: HistoryRow, compact: boolean) {
  return cn(
    // Min height matches title + subtitle so single-line rows (e.g. bare "Bet placed")
    // align with double-line settlements and event rows.
    "flex w-full min-w-0 items-center gap-2 rounded-md border border-transparent transition-colors hover:border-border/60 hover:bg-selection-subtle",
    compact
      ? "box-border max-w-full min-h-[3.25rem] px-2 py-2"
      : "self-stretch min-h-[3rem] px-2 py-1.5",
    entryTint(entry)
  );
}

export function HistoryEntryRow({
  entry,
  ctx,
  compact = false,
  onFreeBetAwarded,
  onNoteSaved,
}: {
  entry: HistoryRow;
  ctx: HistoryContext;
  compact?: boolean;
  onFreeBetAwarded?: () => void;
  onNoteSaved?: () => void;
}) {
  const isBetSettlement = entry.kind === "settlement";
  const showsPnlAmount = isPnlSettlementKind(entry.kind);
  const bet = entry.betId != null ? ctx.betsById.get(entry.betId) : undefined;
  const event = resolveHistoryEvent(entry, ctx);
  const eventLine = formatHistoryEventLine(entry, ctx);
  const settledNote = historySettledNote(entry, ctx);
  const promo = entry.betId != null ? ctx.promoByBetId[entry.betId] : undefined;
  const subtitle = historyEntrySubtitle(entry, bet, promo);
  const { note: correctionNote, displayEntry, setNote } = useBalanceCorrectionNote(entry);
  const isBalanceAdjustment = entry.kind === "balance_adjustment";
  const compactDescription = compact
    ? isBalanceAdjustment
      ? undefined
      : (subtitle ?? eventLine ?? (entry.kind === "casino_settlement" ? entry.detail : undefined))
    : undefined;
  const title = historyEntryTitle(entry, ctx);
  const freeBetPlaced = isFreeBetPlacedHistoryEntry(entry, ctx);
  const freeBetWon = isFreeBetWonHistoryEntry(entry);
  const href = historyEntryHref(entry, ctx);
  const linkLabel = historyEntryLinkLabel(entry, ctx);
  const offerTitle =
    bet?.offerId != null ? ctx.offerTitleById.get(bet.offerId) : undefined;
  const showEarlyAward = showEarlyFreeBetAwardButton(entry, bet, promo, offerTitle);
  const earlyAwardAmount = bet
    ? unconditionalFreeBetEffect(bet, offerTitle)?.amount
    : undefined;
  // Feed rows always use compact prompt density (text-xs) to match other subtitles.
  const earlyAwardPrompt =
    showEarlyAward && bet ? (
      <EarlyFreeBetAwardButton
        betId={bet.id}
        amount={earlyAwardAmount}
        compact
        onAwarded={onFreeBetAwarded}
      />
    ) : null;
  const correctionDetail = isBalanceAdjustment ? (
    <BalanceCorrectionDetailLine
      entry={displayEntry}
      note={correctionNote}
      onSaved={(next) => {
        setNote(next);
        onNoteSaved?.();
      }}
    />
  ) : null;

  if (compact) {
    return (
      <div className={historyRowShellClass(entry, true)}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <HistoryTimeBadgeDisplay
            entry={entry}
            ctx={ctx}
            className="w-[4.75rem] shrink-0 text-left text-[11px] font-semibold text-muted-foreground"
          />
          <div className="flex w-4 shrink-0 justify-center">
            <HistoryEntryIcon entry={entry} ctx={ctx} />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <Link
              href={href}
              className="cursor-pointer"
              aria-label={linkLabel}
            >
              <HistoryEntryTitleDisplay
                title={title}
                freeBetPlaced={freeBetPlaced}
                freeBetWon={freeBetWon}
                className="block text-[13px] font-medium leading-snug"
              />
            </Link>
            {correctionDetail}
            {compactDescription ? (
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {compactDescription}
              </span>
            ) : null}
            {earlyAwardPrompt}
          </div>
        </div>
        {showsPnlAmount && entry.amount != null ? (
          <span className="shrink-0 text-right text-[13px] font-semibold tabular-nums">
            <MoneyFlow value={entry.amount} signColor signDisplay />
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={historyRowShellClass(entry, false)}>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <HistoryTimeBadgeDisplay
          entry={entry}
          ctx={ctx}
          className="w-[4.5rem] shrink-0 text-left text-[11px] font-semibold text-muted-foreground"
        />
        <div className="flex w-4 shrink-0 justify-center">
          <HistoryEntryIcon entry={entry} ctx={ctx} />
        </div>
        <span className="min-w-0 flex-1 text-left">
          <Link href={href} className="cursor-pointer" aria-label={linkLabel}>
            <HistoryEntryTitleDisplay
              title={title}
              freeBetPlaced={freeBetPlaced}
              freeBetWon={freeBetWon}
              className="block text-[13px] font-medium"
            />
          </Link>
          {correctionDetail}
          {!isBalanceAdjustment && subtitle ? (
            <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
          ) : null}
          {entry.kind === "casino_settlement" && entry.detail && !subtitle ? (
            <span className="block truncate text-xs text-muted-foreground">{entry.detail}</span>
          ) : null}
          {event && eventLine ? (
            <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground/80">
              <SportIcon sport={event.sport} size={11} className="shrink-0 text-muted-foreground/70" />
              <span className="truncate">{eventLine}</span>
            </span>
          ) : null}
          {earlyAwardPrompt}
          {settledNote && (
            <span className="mt-0.5 block text-[10px] text-muted-foreground">{settledNote}</span>
          )}
          {bet && isBetSettlement && (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              {formatBetMeta(bet).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
          )}
          {bet && entry.kind === "bet_placed" && !showEarlyAward && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
              {formatBetMeta(bet).slice(0, 3).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
          )}
        </span>
      </div>
      {showsPnlAmount && entry.amount != null ? (
        <span className="shrink-0 text-right text-[13px] font-semibold tabular-nums">
          <MoneyFlow value={entry.amount} signColor signDisplay />
        </span>
      ) : null}
    </div>
  );
}

export function HistoryEntryCard({
  entry,
  ctx,
  bet,
  collapsed = false,
  onFreeBetAwarded,
  onNoteSaved,
}: {
  entry: HistoryRow;
  ctx: HistoryContext;
  bet?: BetRow;
  /** Hide bet details band — header summary only */
  collapsed?: boolean;
  onFreeBetAwarded?: () => void;
  onNoteSaved?: () => void;
}) {
  const settledNote = historySettledNote(entry, ctx);
  const promo = entry.betId != null ? ctx.promoByBetId[entry.betId] : undefined;
  const event = resolveHistoryEvent(entry, ctx);
  const eventLine = formatHistoryEventLine(entry, ctx, {
    omitRaceTime: entry.kind === "settlement" && event?.sport === "horse_racing",
  });
  const subtitle = historyEntrySubtitle(entry, bet, promo);
  const { note: correctionNote, displayEntry, setNote } = useBalanceCorrectionNote(entry);
  const isBalanceAdjustment = entry.kind === "balance_adjustment";
  const title = historyEntryTitle(entry, ctx);
  const freeBetPlaced = isFreeBetPlacedHistoryEntry(entry, ctx);
  const freeBetWon = isFreeBetWonHistoryEntry(entry);
  const offerTitle =
    bet?.offerId != null ? ctx.offerTitleById.get(bet.offerId) : undefined;
  const showEarlyAward = showEarlyFreeBetAwardButton(entry, bet, promo, offerTitle);
  const earlyAwardAmount = bet
    ? unconditionalFreeBetEffect(bet, offerTitle)?.amount
    : undefined;

  return (
    <article className="offer-campaign-card overflow-hidden rounded-lg ring-1 ring-border/50 dark:ring-[color-mix(in_oklch,black_55%,var(--border))] dark:ring-opacity-100">
      <div
        className={cn(
          collapsed ? "flex min-h-[3.75rem] items-center px-3 py-2.5" : "px-4 pt-4 pb-3",
          historyHeaderTint(entry) ?? "bg-card"
        )}
      >
        <div className={cn("flex w-full min-w-0 items-start", collapsed ? "gap-2" : "gap-3")}>
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
            <div className="flex w-full items-start justify-between gap-2">
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
                {isBalanceAdjustment ? (
                  <BalanceCorrectionDetailLine
                    entry={displayEntry}
                    note={correctionNote}
                    onSaved={(next) => {
                      setNote(next);
                      onNoteSaved?.();
                    }}
                    className={cn(
                      collapsed ? "mt-0.5" : "mt-1",
                      !collapsed && "text-sm"
                    )}
                    textClassName={!collapsed ? "text-sm" : undefined}
                  />
                ) : null}
                {!isBalanceAdjustment && !collapsed && subtitle ? (
                  <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                ) : null}
                {!collapsed &&
                entry.kind === "casino_settlement" &&
                entry.detail &&
                !subtitle ? (
                  <p className="mt-1 text-sm text-muted-foreground">{entry.detail}</p>
                ) : null}
                {!collapsed && eventLine ? (
                  <p className="mt-1 text-sm text-foreground/80">{eventLine}</p>
                ) : null}
                {collapsed && eventLine ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{eventLine}</p>
                ) : null}
                {showEarlyAward && bet ? (
                  <EarlyFreeBetAwardButton
                    betId={bet.id}
                    amount={earlyAwardAmount}
                    compact={collapsed}
                    onAwarded={onFreeBetAwarded}
                  />
                ) : null}
                {!collapsed && settledNote ? (
                  <p className="mt-1 text-xs text-muted-foreground">{settledNote}</p>
                ) : null}
              </div>
              {isPnlSettlementKind(entry.kind) && entry.amount != null ? (
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <MoneyFlow
                    value={entry.amount}
                    signColor
                    signDisplay
                    className={cn(
                      "shrink-0 font-bold tabular-nums",
                      collapsed ? "text-base" : "text-xl"
                    )}
                  />
                </div>
              ) : null}
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
  onFreeBetAwarded,
  onNoteSaved,
}: {
  entries: HistoryRow[];
  ctx: HistoryContext;
  compact?: boolean;
  emptyMessage?: string;
  onFreeBetAwarded?: () => void;
  onNoteSaved?: () => void;
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
        <HistoryEntryRow
          key={entry.id}
          entry={entry}
          ctx={ctx}
          compact={compact}
          onFreeBetAwarded={onFreeBetAwarded}
          onNoteSaved={onNoteSaved}
        />
      ))}
    </div>
  );
}
