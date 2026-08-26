"use client";

import { useRouter } from "next/navigation";
import { PlaceZoneBar } from "@/components/racing/place-zone-bar";
import { EmptyState } from "@/components/help/empty-state";
import { VenueBadge } from "@/components/venue-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MoneyFlow, NumFlow } from "@/components/money-flow";
import type { RacingDeskActiveBet } from "@/lib/racing-desk/types";
import { openBetOutcomeLabel } from "@/lib/pnl/open-bet-valuation";
import { outlineButtonGroup } from "@/components/layout/page-header-actions";
import {
  campaignCardBadge,
  campaignCardHeader,
  campaignCardNextAction,
  campaignCardPnl,
  campaignCardPnlLabel,
  campaignCardStakeLine,
  campaignCardTitle,
  offerCampaignCardShell,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { formatGbp } from "@/lib/format-money";
import { formatClockTime } from "@/lib/time-format";
import { Eye, NotebookPen } from "lucide-react";

function activeBetHeaderTint(expectedProfit: number | null): string | null {
  if (expectedProfit == null) return null;
  if (expectedProfit > 0.005) return "offer-header-tint-win";
  if (expectedProfit < -0.005) return "offer-header-tint-loss";
  return null;
}

export function ActiveBetsStrip({
  bets,
  onSelectRace,
  onBrowseRaces,
}: {
  bets: RacingDeskActiveBet[];
  onSelectRace?: (raceExternalId: string) => void;
  onBrowseRaces?: () => void;
}) {
  const router = useRouter();

  if (bets.length === 0) {
    return (
      <EmptyState
        icon={NotebookPen}
        title="No active bets"
        description="Log a racing bet from a racecard, or an acca, bet builder or systems run with a racing leg. Race results settle each-way and extra-place automatically."
        action={
          onBrowseRaces
            ? { label: "Browse races", onClick: onBrowseRaces }
            : undefined
        }
      />
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <h2 className="text-sm font-semibold tracking-tight">Active bets</h2>
        <span className="min-w-0 text-pretty break-words text-xs text-muted-foreground">
          {bets.some((bet) => bet.kind && bet.kind !== "bet")
            ? `${bets.length} open · singles settle from the race result; acca, bet builder and systems open on their desk`
            : `${bets.length} open · race result settles EW / EP automatically`}
        </span>
      </div>
      <div className="flex flex-col gap-4.5">
        {bets.map((b) => {
          const marketLabel =
            b.kind === "acca"
              ? "Acca"
              : b.kind === "bet_builder"
                ? "Bet builder"
                : b.kind === "systems"
                  ? "Systems"
                  : b.mode === "extra_place"
                    ? "Extra place"
                    : b.mode === "each_way" || b.market === "each_way"
                      ? "Each way"
                      : b.market === "extra_place"
                        ? "Extra place"
                        : b.market === "win"
                          ? "Win"
                          : b.market;
          const off =
            b.startTime != null
              ? formatClockTime(new Date(b.startTime))
              : b.offTime;
          const headerTint = activeBetHeaderTint(b.expectedProfit);
          const stakeOdds =
            b.backStake > 0 && b.backOdds > 1
              ? `${formatGbp(b.backStake)} @ ${b.backOdds.toFixed(2)}`
              : null;
          const deskHref = b.kind && b.kind !== "bet" ? b.href : null;
          const isDesk = Boolean(deskHref);
          const deskCta =
            b.kind === "acca"
              ? "Acca desk"
              : b.kind === "bet_builder"
                ? "Bet builder desk"
                : b.kind === "systems"
                  ? "Systems desk"
                  : null;

          return (
            <Card
              key={b.betId}
              className={cn(offerCampaignCardShell, "flex-col gap-0 py-0")}
            >
              <div
                className={cn(
                  campaignCardHeader,
                  "px-(--card-spacing)",
                  headerTint ?? "bg-card"
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {b.bookmaker ? <VenueBadge name={b.bookmaker} size="sm" /> : null}
                      <Badge variant="outline" className={cn("text-[11px]", campaignCardBadge)}>
                        {marketLabel}
                      </Badge>
                      <Badge variant="secondary" className="text-[11px]">
                        Active
                      </Badge>
                    </div>
                    <p
                      className={cn(
                        campaignCardTitle,
                        "mt-0 min-w-0 text-pretty break-words text-[15px]"
                      )}
                    >
                      {b.selection || b.label}
                    </p>
                    <p className="min-w-0 text-pretty break-words text-xs text-muted-foreground">
                      {[isDesk ? b.label : null, b.course, off, isDesk ? null : stakeOdds]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {isDesk && stakeOdds ? (
                      <p className={cn(campaignCardStakeLine, "mt-1")}>{stakeOdds}</p>
                    ) : null}
                    {isDesk && b.progressCaption ? (
                      <p className="min-w-0 text-pretty break-words text-xs text-muted-foreground">
                        {b.progressCaption}
                      </p>
                    ) : null}
                    {b.triggerNote ? (
                      <p
                        className={cn(
                          campaignCardNextAction,
                          "mt-0 min-w-0 text-pretty break-words font-medium"
                        )}
                      >
                        Next: {b.triggerNote}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    {b.expectedProfit != null ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={campaignCardPnlLabel}>
                          {openBetOutcomeLabel(b.outcomeKind)}
                        </span>
                        <MoneyFlow
                          value={b.expectedProfit}
                          signColor
                          signDisplay
                          className={cn(campaignCardPnl, "text-[21px]")}
                        />
                      </div>
                    ) : isDesk ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <span className={campaignCardPnlLabel}>Campaign P&L</span>
                        <span
                          className={cn(
                            campaignCardPnl,
                            "text-[21px] leading-tight text-muted-foreground"
                          )}
                        >
                          In play
                        </span>
                      </div>
                    ) : null}
                    {b.mode === "extra_place" && b.profitIfExtraPlace != null && (
                      <div className="mt-1 text-xs">
                        <span className="text-muted-foreground">If EP </span>
                        <MoneyFlow
                          value={b.profitIfExtraPlace}
                          signColor
                          signDisplay
                          className="font-semibold"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-t border-border/50 py-3.5 pl-(--card-spacing) pr-[calc(var(--card-spacing)-4px)]">
                <div className="min-w-0 flex-1 space-y-1.5">
                  {(b.exchangePlaces != null || b.bookiePlaces != null) && (
                    <PlaceZoneBar
                      exchangePlaces={b.exchangePlaces ?? 3}
                      bookiePlaces={b.bookiePlaces ?? b.exchangePlaces ?? 3}
                      compact
                    />
                  )}
                  {b.mode === "extra_place" && b.impliedExtraPlaceOdds != null && (
                    <p className="text-xs text-muted-foreground">
                      QL{" "}
                      <MoneyFlow
                        value={b.qualifyingLoss ?? 0}
                        signColor
                        signDisplay
                        className="font-medium"
                      />
                      {" · "}
                      Implied EP odds{" "}
                      <NumFlow
                        value={b.impliedExtraPlaceOdds}
                        digits={1}
                        className="font-medium"
                      />
                    </p>
                  )}
                </div>
                <div className={cn(outlineButtonGroup, "shrink-0")}>
                  {b.raceExternalId && onSelectRace && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectRace(b.raceExternalId!)}
                    >
                      <Eye className="size-3.5" />
                      View race
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      router.push(deskHref ?? `/tracker?highlight=${b.betId}`);
                    }}
                  >
                    <NotebookPen className="size-3.5" />
                    {deskCta ?? "Tracker"}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
