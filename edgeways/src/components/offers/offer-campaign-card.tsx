"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MoneyFlow } from "@/components/money-flow";
import { api, useAppState } from "@/hooks/use-app-state";
import {
  offerExpiringAlertDedupePrefix,
  offerExpiringAlertKeys,
} from "@/lib/alerts/rules";
import {
  dismissAlertNotifications,
  suppressAlertKeys,
} from "@/lib/alerts/seen";
import { DEFAULT_TUNING } from "@/lib/services/settings-shared";
import { filterPillState } from "@/lib/ui/surface-styles";
import type { OfferSummary, OfferProfitBreakdown } from "@/lib/services/offers.types";
import {
  canManuallyCompleteOffer,
  offerManualCompleteBlockedReason,
} from "@/lib/offers/offer-complete";
import {
  offerCategoryFromSport,
  offerCategoryLabel,
} from "@/lib/offers/offer-categories";
import { formatOfferExpiry } from "@/lib/offers/offer-terms";
import { buildCampaignDetailsContext } from "@/lib/offers/offer-campaign-details";
import {
  offerIssueStatusLabel,
  effectiveOfferExpiryMs,
  daysUntilOfferExpiry,
  formatOfferDaysLeftLabel,
  offerExpiryUrgency,
} from "@/lib/offers/offer-expiry";
import { formatGbp } from "@/lib/format-money";
import { cn } from "@/lib/utils";
import { offerStatusBadgeVariant } from "@/lib/ui/status-badges";
import { OfferPipelineStrip } from "@/components/offers/offer-pipeline-strip";
import { OfferCategoryIcon } from "@/components/offers/offer-category-icon";
import {
  isOfferExpired,
  offerInactiveFigureClass,
  OfferInactiveCurrencyText,
} from "@/lib/offers/offer-inactive-ui";
import { formatCaptureLine } from "@/lib/offers/ev-capture";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import {
  isRegionalScope,
  offerHasResultTrigger,
  parseOfferRules,
} from "@/lib/offers/racing-offer-rules";
import { CourseRaceTimes } from "@/components/offers/course-race-times";
import { OfferEdgePanel } from "@/components/offers/offer-edge-panel";
import { VenueBadge } from "@/components/venue-badge";
import {
  offerFreeBetAmount,
  offerHasFreeBetReward,
} from "@/lib/offers/offer-ui";
import { outlineButtonGroup } from "@/components/layout/page-header-actions";
import { Check, ChevronDown, Eye, Pencil, Sparkles, Trash2 } from "lucide-react";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function OfferCampaignCard({
  offer,
  highlighted,
  nextActionLabel,
  nextActionDetail,
  onRefresh,
  onEdit,
  onView,
  defaultDetailsOpen = false,
}: {
  offer: OfferSummary;
  highlighted?: boolean;
  nextActionLabel?: string | null;
  nextActionDetail?: string | null;
  onRefresh: () => void;
  onEdit: (offer: OfferSummary) => void;
  onView?: (offer: OfferSummary) => void;
  defaultDetailsOpen?: boolean;
}) {
  const [detailsOpen, setDetailsOpen] = useState(defaultDetailsOpen);
  const {
    rulesSummary,
    descriptionLine,
    uniqueImportant,
    scopeLine,
  } = buildCampaignDetailsContext(offer);
  const racingRules = offer.sport === "horse_racing" ? parseOfferRules(offer) : null;
  const minRunners = racingRules?.minRunners ?? null;

  // Offer Edge only makes sense while the offer is still live and there are races
  // to run it on, so an undated or finished campaign shows nothing.
  const edgeDate = offer.eventDate ?? todayIso();
  const showEdgePanel =
    racingRules != null &&
    offerHasResultTrigger(racingRules) &&
    (offer.status === "active" || offer.status === "planned") &&
    edgeDate >= todayIso();
  const categoryId = offerCategoryFromSport(offer.sport);
  const categoryLabel = offerCategoryLabel(offer.sport);
  const hasFreeBet = offerHasFreeBetReward(offer);
  const freeBetAmt = offerFreeBetAmount(offer);

  const expiryMs = effectiveOfferExpiryMs(offer);
  const expiryDaysLeft = expiryMs != null ? daysUntilOfferExpiry(expiryMs) : null;
  const expiryUrgency = offerExpiryUrgency(expiryDaysLeft);

  const hasProfitLines = (() => {
    const p = offer.profit;
    return (
      p.qualifyingSettledCount > 0 ||
      p.qualifyingOpenCount > 0 ||
      p.freeBetStage !== "none" ||
      p.freeBetAwarded ||
      p.freeBetSettledCount > 0 ||
      p.freeBetOpenCount > 0
    );
  })();

  const hasDetails =
    Boolean(rulesSummary) ||
    Boolean(descriptionLine) ||
    Boolean(uniqueImportant) ||
    Boolean(scopeLine) ||
    hasProfitLines;

  const detailsSummary = [
    rulesSummary?.split(" · ")[0] ?? descriptionLine?.slice(0, 48) ?? null,
    uniqueImportant?.split("\n")[0]?.slice(0, 48) ?? null,
    hasProfitLines ? "Profit & Loss breakdown" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  function quietOfferNotifications() {
    const alertKeys = offerExpiringAlertKeys(offer.id);
    suppressAlertKeys(alertKeys);
    void dismissAlertNotifications(alertKeys);
  }

  async function markComplete() {
    quietOfferNotifications();
    try {
      await api(`/api/offers/${offer.id}`, { method: "PATCH", json: { status: "completed" } });
      toast.success("Offer marked complete");
      onRefresh();
    } catch (e) {
      toast.error("Could not complete offer", { description: String(e) });
    }
  }

  async function markExpired() {
    quietOfferNotifications();
    await api(`/api/offers/${offer.id}`, { method: "PATCH", json: { status: "expired" } });
    toast.success("Offer marked expired");
    onRefresh();
  }

  async function reactivate() {
    await api(`/api/offers/${offer.id}`, { method: "PATCH", json: { status: "active" } });
    toast.success("Offer reactivated");
    onRefresh();
  }

  const headerTintValue =
    Math.abs(offer.profit.totalProfit) > 0.005
      ? offer.profit.totalProfit
      : (offer.expectedProfit ?? offer.expectedFromBets);
  const isExpired = isOfferExpired(offer);
  const headerTintClass = isExpired
    ? "offer-header-tint-expired"
    : headerTintValue > 0.005
      ? "offer-header-tint-win"
      : headerTintValue < -0.005
        ? "offer-header-tint-loss"
        : null;
  const inactiveFigure = offerInactiveFigureClass(isExpired);
  const canComplete = canManuallyCompleteOffer(offer);
  const completeBlockedReason = offerManualCompleteBlockedReason(offer);
  const issueStatusLabel = offerIssueStatusLabel(offer);

  function handleCardActivate() {
    onView?.(offer);
  }

  function stopCardActivate(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation();
  }

  return (
    <Card
      id={`offer-card-${offer.id}`}
      role={onView ? "button" : undefined}
      tabIndex={onView ? 0 : undefined}
      onClick={onView ? handleCardActivate : undefined}
      onKeyDown={
        onView
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleCardActivate();
              }
            }
          : undefined
      }
      className={cn(
        "offer-campaign-card gap-0 overflow-hidden py-0 dark:ring-[color-mix(in_oklch,black_55%,var(--border))] dark:ring-opacity-100",
        highlighted && "bet-row-highlight",
        onView && "cursor-pointer transition-[box-shadow] hover:ring-foreground/20"
      )}
    >
      <CardHeader
        className={cn("space-y-0 pt-(--card-spacing) pb-3", headerTintClass ?? "bg-card")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {offer.bookmaker ? <VenueBadge name={offer.bookmaker} size="md" /> : null}
              {issueStatusLabel ? (
                <Badge variant={offerStatusBadgeVariant(offer.status)}>
                  {issueStatusLabel}
                </Badge>
              ) : null}
              <Badge variant="outline" className="gap-1 font-normal">
                <OfferCategoryIcon category={categoryId} size={12} className="opacity-80" />
                {categoryLabel}
              </Badge>
              {hasFreeBet ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                >
                  <Sparkles className="size-3" />
                  {freeBetAmt != null ? `${formatGbp(freeBetAmt)} FB` : "Free bet"}
                </Badge>
              ) : null}
            </div>
            <CardTitle className="mt-2 text-xl font-bold leading-snug text-foreground">
              {offer.title}
            </CardTitle>
            {nextActionDetail ? (
              <p className="mt-1 text-xs text-primary/90">{nextActionDetail}</p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            {(() => {
              const expected = offer.expectedProfit ?? offer.expectedFromBets;
              const actual = offer.profit.totalProfit;
              const hasActual = Math.abs(actual) > 0.005;
              const hasExpected = Math.abs(expected) > 0.005;
              if (hasExpected && hasActual) {
                return (
                  <>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Total
                    </p>
                    <MoneyFlow
                      value={actual}
                      signColor={!isExpired}
                      className={cn("text-xl font-bold tabular-nums", inactiveFigure)}
                    />
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Exp. profit{" "}
                      <MoneyFlow
                        value={expected}
                        signColor={false}
                        className={cn(
                          "inline font-medium tabular-nums",
                          isExpired
                            ? inactiveFigure
                            : "text-emerald-600 dark:text-emerald-400"
                        )}
                      />
                    </p>
                  </>
                );
              }
              if (hasExpected) {
                return (
                  <>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Exp. profit
                    </p>
                    <MoneyFlow
                      value={expected}
                      signColor={false}
                      className={cn(
                        "text-xl font-bold tabular-nums",
                        isExpired
                          ? inactiveFigure
                          : "text-emerald-600 dark:text-emerald-400"
                      )}
                    />
                  </>
                );
              }
              return (
                <>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Total
                  </p>
                  <MoneyFlow
                    value={actual}
                    signColor={!isExpired}
                    className={cn("text-xl font-bold tabular-nums", inactiveFigure)}
                  />
                </>
              );
            })()}
          </div>
        </div>

        <OfferPipelineStrip offer={offer} className="mt-3" />

        {offer.evLock ? (() => {
          const captureLine = formatCaptureLine(offer.evLock);
          if (!captureLine) return null;
          return (
            <div className="mt-2 rounded-md border border-border/50 bg-muted/40 px-2.5 py-1.5">
              <div className="flex items-center gap-1.5">
                <EvBasisBadge basis={offer.evLock.basis} />
                <span className="text-[11px] text-muted-foreground">
                  <OfferInactiveCurrencyText text={captureLine} inactive={isExpired} />
                </span>
                {offer.evLock.version > 1 ? (
                  <span className="ml-auto shrink-0 rounded bg-border/60 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                    re-locked v{offer.evLock.version}
                  </span>
                ) : null}
              </div>
              <MistakeTagRow evLock={offer.evLock} offerId={offer.id} onRefresh={onRefresh} />
            </div>
          );
        })() : null}

        {showEdgePanel ? (
          <div className="mt-2" onClick={stopCardActivate} onKeyDown={stopCardActivate}>
            <OfferEdgePanel offerId={offer.id} eventDate={edgeDate} />
          </div>
        ) : null}
      </CardHeader>

      {hasDetails ? (
        <div
          className="offer-card-details border-t border-border/50"
          onClick={stopCardActivate}
          onKeyDown={stopCardActivate}
        >
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            className="flex w-full min-h-9 items-baseline gap-2 px-(--card-spacing) py-2.5 text-left transition-colors hover:bg-foreground/5"
          >
            <span className="shrink-0 text-xs font-semibold tracking-wide text-foreground">
              Details
            </span>
            {!detailsOpen && detailsSummary ? (
              <span className="min-w-0 flex-1 text-[11px] leading-normal text-muted-foreground line-clamp-2">
                {detailsSummary}
              </span>
            ) : (
              <span className="min-w-0 flex-1" aria-hidden />
            )}
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 self-center text-muted-foreground transition-transform",
                detailsOpen && "rotate-180"
              )}
            />
          </button>
          {detailsOpen ? (
            <div className="flex flex-col gap-2 border-t border-border/50 px-(--card-spacing) py-2.5">
              {rulesSummary ? (
                <p className="text-xs leading-normal text-muted-foreground">{rulesSummary}</p>
              ) : null}
              {descriptionLine ? (
                <p className="text-xs leading-snug text-muted-foreground">{descriptionLine}</p>
              ) : null}
              {uniqueImportant ? (
                <p className="whitespace-pre-line rounded-md border border-amber-500/25 bg-amber-500/5 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300">
                  {uniqueImportant}
                </p>
              ) : null}
              {scopeLine ? (
                <p className="text-[11px] text-muted-foreground">{scopeLine}</p>
              ) : null}
              {/* Meeting times only for course-wide scope. Race-scoped offers
                  already show the single race in scopeLine above. */}
              {offer.sport === "horse_racing" &&
                !isRegionalScope(offer.scopeCourse) &&
                offer.eventDate &&
                !offer.scopeRaceId?.trim() ? (
                  <CourseRaceTimes
                    scopeCourse={offer.scopeCourse!}
                    eventDate={offer.eventDate}
                    minRunners={minRunners}
                  />
                ) : null}
              <OfferProfitLines profit={offer.profit} inactive={isExpired} />
            </div>
          ) : null}
        </div>
      ) : null}

      <CardContent
        className="offer-card-footer flex flex-wrap items-center justify-between gap-2 border-t border-border/50 py-2.5 pl-(--card-spacing) pr-[calc(var(--card-spacing)-4px)]"
        onClick={stopCardActivate}
        onKeyDown={stopCardActivate}
      >
        <span className="text-xs text-muted-foreground">
          {offer.status === "planned" && offer.startsOn ? (
            <>
              <span className="font-medium text-foreground">Starts {offer.startsOn}</span>
              {" · "}
            </>
          ) : null}
          {offer.betCount} bet{offer.betCount === 1 ? "" : "s"}
          {offer.openBets > 0 ? ` · ${offer.openBets} open` : ""}
          {expiryMs != null && expiryUrgency === "today" ? (
            <>{" · "}<span className="font-medium text-rose-600 dark:text-rose-400">{formatOfferDaysLeftLabel(expiryDaysLeft)}</span></>
          ) : expiryMs != null && expiryUrgency === "tomorrow" ? (
            <>{" · "}<span className="font-medium text-orange-600 dark:text-orange-400">{formatOfferDaysLeftLabel(expiryDaysLeft)}</span></>
          ) : expiryMs != null ? (
            ` · expires ${formatOfferExpiry(expiryMs)}`
          ) : null}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {(offer.status === "active" || offer.status === "planned") && (
            <Button size="sm" variant="ghost" onClick={() => void markExpired()}>
              Expire
            </Button>
          )}
          <DeleteOfferDialog offer={offer} onDeleted={onRefresh} />
          <div className={outlineButtonGroup}>
            <Button size="sm" variant="outline" onClick={() => onEdit(offer)}>
              <Pencil className="size-3.5" /> Edit
            </Button>
            {onView ? (
              <Button size="sm" variant="outline" onClick={() => onView(offer)}>
                <Eye className="size-3.5" /> View
              </Button>
            ) : null}
            {offer.status === "active" && offer.betCount > 0 ? (
              <span title={completeBlockedReason ?? undefined} className="inline-flex">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void markComplete()}
                  disabled={!canComplete}
                >
                  <Check className="size-3.5 text-violet-600 dark:text-violet-400" />
                  Complete
                </Button>
              </span>
            ) : null}
          </div>
          {(offer.status === "completed" || offer.status === "expired") && (
            <Button size="sm" variant="ghost" onClick={() => void reactivate()}>
              Reactivate
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OfferProfitLines({
  profit,
  inactive,
}: {
  profit: OfferProfitBreakdown;
  inactive?: boolean;
}) {
  const inactiveFigure = offerInactiveFigureClass(inactive);
  const hasQualifying =
    profit.qualifyingSettledCount > 0 || profit.qualifyingOpenCount > 0;
  const hasFreeBetTrack =
    profit.freeBetStage !== "none" ||
    profit.freeBetAwarded ||
    profit.freeBetSettledCount > 0 ||
    profit.freeBetOpenCount > 0;

  if (!hasQualifying && !hasFreeBetTrack) return null;

  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
      {hasQualifying && (
        <div className="flex items-start justify-between gap-3 py-0.5">
          <span className="text-muted-foreground">Qualifying</span>
          <span className="text-right">
            {profit.qualifyingOpenCount > 0 && profit.qualifyingSettledCount === 0 ? (
              <span className="text-muted-foreground">Open</span>
            ) : (
              <MoneyFlow
                value={profit.qualifyingProfit}
                signColor={!inactive}
                className={cn("font-medium", inactiveFigure)}
              />
            )}
          </span>
        </div>
      )}

      {hasFreeBetTrack && (
        <>
          <div className="flex items-start justify-between gap-3 py-0.5">
            <span className="text-muted-foreground">Free bet</span>
            <span className="text-right">
              {profit.freeBetAwarded ? (
                <span
                  className={cn(
                    "font-medium text-violet-700 dark:text-violet-300",
                    inactiveFigure
                  )}
                >
                  {formatGbp(profit.freeBetAwardAmount ?? 0)} awarded
                  {profit.freeBetAwardReason ? ` · ${profit.freeBetAwardReason}` : ""}
                </span>
              ) : profit.freeBetStage === "awaiting_result" ? (
                <span className="text-muted-foreground">Awaiting result</span>
              ) : profit.freeBetStage === "not_awarded" ? (
                <span className="text-muted-foreground">Not awarded</span>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </span>
          </div>

          {(profit.freeBetStage === "in_use" ||
            profit.freeBetStage === "settled" ||
            profit.freeBetSettledCount > 0 ||
            profit.freeBetOpenCount > 0) && (
            <div className="flex items-start justify-between gap-3 py-0.5">
              <span className="text-muted-foreground">Conversion</span>
              <span className="text-right">
                {profit.freeBetOpenCount > 0 && profit.freeBetSettledCount === 0 ? (
                  <span className="text-muted-foreground">Open</span>
                ) : (
                  <MoneyFlow
                    value={profit.freeBetProfit}
                    signColor={!inactive}
                    className={cn("font-medium", inactiveFigure)}
                  />
                )}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DeleteOfferDialog({
  offer,
  onDeleted,
}: {
  offer: OfferSummary;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const recurring = Boolean(offer.seriesId && offer.recurrence?.enabled);
  const [scope, setScope] = useState<"instance" | "future">("instance");

  async function confirmDelete() {
    setBusy(true);
    const alertKeys = offerExpiringAlertKeys(offer.id);
    // Suppress before DELETE returns so a stale Do Next poll cannot toast/push
    // for a campaign the user has just removed.
    suppressAlertKeys(alertKeys);
    void dismissAlertNotifications(alertKeys);
    try {
      const qs = recurring && scope === "future" ? "?scope=future" : "";
      await api(`/api/offers/${offer.id}${qs}`, { method: "DELETE" });
      void api("/api/alerts", {
        method: "PATCH",
        json: { dedupePrefix: offerExpiringAlertDedupePrefix(offer.id), read: true },
      }).catch(() => {});
      toast.success(
        recurring && scope === "future" ? "Offer deleted and series stopped" : "Offer deleted"
      );
      setOpen(false);
      onDeleted();
    } catch (e) {
      toast.error("Could not delete offer", { description: String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setScope("instance");
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          <Trash2 className="size-3.5" /> Delete
        </Button>
      </DialogTrigger>
      <DialogContent mobile="center" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete offer?</DialogTitle>
          <DialogDescription>
            This permanently removes &ldquo;{offer.title}&rdquo;.
            {offer.betCount > 0
              ? ` ${offer.betCount} linked bet${offer.betCount === 1 ? "" : "s"} will be unlinked but not deleted.`
              : ""}{" "}
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {recurring ? (
          <fieldset className="space-y-2 text-sm">
            <legend className="sr-only">Delete scope</legend>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name={`delete-scope-${offer.id}`}
                className="mt-1"
                checked={scope === "instance"}
                onChange={() => setScope("instance")}
              />
              <span>
                <span className="font-medium text-foreground">This occurrence only</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  The series keeps repeating. This date will not come back.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name={`delete-scope-${offer.id}`}
                className="mt-1"
                checked={scope === "future"}
                onChange={() => setScope("future")}
              />
              <span>
                <span className="font-medium text-foreground">This and future occurrences</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Stops the series from this date. Past history stays.
                </span>
              </span>
            </label>
          </fieldset>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => void confirmDelete()}>
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


/** One-tap mistake tagging on under-captured settled campaigns (B7). Never forced. */
const MISTAKE_TAG_OPTIONS = [
  { tag: "laid_late", label: "Laid late" },
  { tag: "wrong_market", label: "Wrong market" },
  { tag: "odds_moved", label: "Odds moved" },
  { tag: "bookie_voided", label: "Bookie voided" },
  { tag: "other", label: "Other" },
] as const;

function MistakeTagRow({
  evLock,
  offerId,
  onRefresh,
}: {
  evLock: NonNullable<OfferSummary["evLock"]>;
  offerId: number;
  onRefresh: () => void;
}) {
  const [skipped, setSkipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  // Shared app-state context - no extra polling. Threshold tunable via E1.
  const { state } = useAppState();
  const captureThreshold =
    state?.settings.tuning.mistakeCapturePct ?? DEFAULT_TUNING.mistakeCapturePct;

  // Only meaningful once settled, and only worth asking when capture dipped.
  if (evLock.capturePct == null) return null;
  const underCaptured = evLock.capturePct < captureThreshold;

  async function setTag(tag: string | null) {
    setSaving(true);
    try {
      await api(`/api/offers/${offerId}`, { method: "PATCH", json: { mistakeTag: tag } });
      setEditing(false);
      onRefresh();
    } catch (e) {
      toast.error("Could not save tag", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  if (evLock.mistakeTag && !editing) {
    const label =
      MISTAKE_TAG_OPTIONS.find((o) => o.tag === evLock.mistakeTag)?.label ??
      evLock.mistakeTag;
    return (
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
        <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-medium text-rose-700 dark:text-rose-300">
          Leak: {label}
        </span>
        <button
          type="button"
          className="text-muted-foreground underline-offset-2 hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
        >
          Change
        </button>
      </div>
    );
  }

  if ((!underCaptured && !editing) || skipped) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        What went wrong?
      </span>
      {MISTAKE_TAG_OPTIONS.map((o) => (
        <button
          key={o.tag}
          type="button"
          disabled={saving}
          className={cn(filterPillState(evLock.mistakeTag === o.tag), "px-2 py-0.5 text-[10px] leading-none")}
          onClick={() => void setTag(o.tag)}
        >
          {o.label}
        </button>
      ))}
      <button
        type="button"
        disabled={saving}
        className="ml-0.5 text-[10px] text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => {
          if (editing && evLock.mistakeTag) void setTag(null);
          setSkipped(true);
          setEditing(false);
        }}
      >
        {editing && evLock.mistakeTag ? "Clear" : "Skip"}
      </button>
    </div>
  );
}
