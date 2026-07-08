"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyFlow } from "@/components/money-flow";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/help/page-header";
import { PageHeaderStat, pagePrimaryButtonProps } from "@/components/layout/page-header-actions";
import { EmptyState } from "@/components/help/empty-state";
import { api, useAppState } from "@/hooks/use-app-state";
import type { OfferSummary, OfferProfitBreakdown } from "@/lib/services/offers";
import {
  formatBetGetFreePlaceSummary,
  formatOfferScopeLabel,
  isRegionalScope,
  parseOfferRules,
} from "@/lib/offers/racing-offer-rules";
import { formatGbp } from "@/lib/format-money";
import { cn } from "@/lib/utils";
import { filterPillState } from "@/lib/ui/surface-styles";
import { formatPillLabel, offerStatusBadgeVariant } from "@/lib/ui/status-badges";
import { listOfferNextActions, offerNextActionLabel } from "@/lib/offers/next-actions";
import { OfferPipelineStrip } from "@/components/offers/offer-pipeline-strip";
import { OfferDayCalendar } from "@/components/offers/offer-day-calendar";
import { Gift, Pencil, Plus, Tag, Trash2, Trophy, X } from "lucide-react";

export default function OffersPage() {
  const { state, refresh } = useAppState(4000);
  const offers = useMemo(() => state?.offers ?? [], [state]);
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "needs_action">("all");
  const [title, setTitle] = useState("");
  const [bookmaker, setBookmaker] = useState("");
  const [expected, setExpected] = useState("");
  const [expires, setExpires] = useState("");
  const [offerStatus, setOfferStatus] = useState<"planned" | "active" | "completed" | "expired">(
    "active"
  );
  const [category, setCategory] = useState<"general" | "racing">("general");
  const [betStake, setBetStake] = useState("50");
  const [freeBetAmount, setFreeBetAmount] = useState("50");
  const [minRunners, setMinRunners] = useState("8");
  const [scopeMode, setScopeMode] = useState<"uk_ire" | "course">("uk_ire");
  const [scopeCourse, setScopeCourse] = useState("");
  const [scopeRegions, setScopeRegions] = useState<Array<"GB" | "IRE">>(["GB", "IRE"]);
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const nextActions = useMemo(() => listOfferNextActions(offers), [offers]);
  const needsActionIds = useMemo(
    () => new Set(nextActions.map((a) => a.offerId)),
    [nextActions]
  );

  const filtered = useMemo(() => {
    if (filter === "all") return offers;
    if (filter === "needs_action") return offers.filter((o) => needsActionIds.has(o.id));
    return offers.filter((o) => o.status === filter);
  }, [offers, filter, needsActionIds]);

  const totals = useMemo(() => {
    const completed = offers.filter((o) => o.status === "completed");
    return {
      active: offers.filter((o) => o.status === "active").length,
      actual: completed.reduce((a, o) => a + o.actualProfit, 0),
      expected: offers.reduce((a, o) => a + (o.expectedProfit ?? o.expectedFromBets), 0),
    };
  }, [offers]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setBookmaker("");
    setExpected("");
    setExpires("");
    setOfferStatus("active");
    setCategory("general");
    setBetStake("50");
    setFreeBetAmount("50");
    setMinRunners("8");
    setScopeMode("uk_ire");
    setScopeCourse("");
    setScopeRegions(["GB", "IRE"]);
    setEventDate(new Date().toISOString().slice(0, 10));
  }

  function startEdit(offer: OfferSummary) {
    setEditingId(offer.id);
    setTitle(offer.title);
    setBookmaker(offer.bookmaker ?? "");
    setExpected(offer.expectedProfit != null ? String(offer.expectedProfit) : "");
    setExpires(
      offer.expiresAt ? new Date(offer.expiresAt).toISOString().slice(0, 10) : ""
    );
    setOfferStatus(offer.status);

    if (offer.sport === "horse_racing") {
      setCategory("racing");
      const rules = parseOfferRules(offer);
      if (rules) {
        setBetStake(String(rules.betStake));
        setFreeBetAmount(String(rules.freeBetAmount));
        setMinRunners(String(rules.minRunners));
        setScopeRegions(rules.regions.length > 0 ? rules.regions : ["GB", "IRE"]);
      }
      if (offer.scopeCourse && !isRegionalScope(offer.scopeCourse)) {
        setScopeMode("course");
        setScopeCourse(offer.scopeCourse);
      } else {
        setScopeMode("uk_ire");
        setScopeCourse("");
      }
      setEventDate(offer.eventDate ?? new Date().toISOString().slice(0, 10));
    } else {
      setCategory("general");
    }
  }

  function buildOfferPayload(isRacing: boolean) {
    const stake = parseFloat(betStake) || 50;
    const free = parseFloat(freeBetAmount) || stake;
    const racingTitle =
      title.trim() || `Bet £${stake} get £${free} free bet (2nd–4th place)`;
    const regions =
      scopeMode === "uk_ire"
        ? scopeRegions.length > 0
          ? scopeRegions
          : (["GB", "IRE"] as ("GB" | "IRE")[])
        : (["GB", "IRE"] as ("GB" | "IRE")[]);
    const rules = isRacing
      ? {
          type: "bet_get_free_place" as const,
          minRunners: parseInt(minRunners, 10) || 8,
          regions,
          qualifyingPlaces: [2, 3, 4],
          betStake: stake,
          freeBetAmount: free,
        }
      : undefined;

    return {
      title: isRacing ? racingTitle : title.trim(),
      bookmaker: bookmaker.trim() || undefined,
      expectedProfit: expected ? parseFloat(expected) : undefined,
      status: offerStatus,
      expiresAt: expires ? new Date(expires).getTime() : undefined,
      ...(isRacing
        ? {
            sport: "horse_racing",
            offerType: "bet_get_free_place",
            scopeCourse: scopeMode === "uk_ire" ? "uk_ire" : scopeCourse.trim() || "uk_ire",
            eventDate,
            rules: JSON.stringify(rules),
            description: formatBetGetFreePlaceSummary(rules!),
          }
        : {}),
    };
  }

  async function saveOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() && category === "general" && editingId == null) return;
    setSaving(true);
    try {
      const isRacing = category === "racing";
      const payload = buildOfferPayload(isRacing);

      if (editingId != null) {
        await api(`/api/offers/${editingId}`, { method: "PATCH", json: payload });
        toast.success("Offer updated");
      } else {
        await api("/api/offers", { method: "POST", json: payload });
        toast.success("Offer added");
      }
      resetForm();
      await refresh();
    } catch (err) {
      toast.error(editingId != null ? "Could not update offer" : "Could not create offer", {
        description: String(err),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        helpId="offers"
        icon={Tag}
        title="Offers"
        description="Offer Command Centre — track campaigns, next actions, and promo P&L. Bets auto-link when the label or trigger looks like an offer."
        action={
          <>
            <PageHeaderStat label="Active">{totals.active}</PageHeaderStat>
            <PageHeaderStat label="Actions">{nextActions.length}</PageHeaderStat>
            <PageHeaderStat label="Actual">
              <MoneyFlow value={totals.actual} signColor className="inline font-semibold" />
            </PageHeaderStat>
            <Button
              {...pagePrimaryButtonProps}
              onClick={() => document.getElementById("offer-form")?.scrollIntoView({ behavior: "smooth" })}
            >
              <Plus className="size-4" /> New offer
            </Button>
          </>
        }
        toolbar={
          <>
            {(["all", "needs_action", "active", "completed"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(filterPillState(filter === f))}
              >
                {f === "needs_action"
                  ? `Needs action${nextActions.length ? ` (${nextActions.length})` : ""}`
                  : formatPillLabel(f)}
              </button>
            ))}
          </>
        }
      />

      <OfferDayCalendar offers={offers} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1" id="offer-form">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {editingId != null ? "Edit offer" : "New offer"}
            </CardTitle>
            <CardDescription>
              {editingId != null
                ? "Update details — linked bets stay attached."
                : "Or let Add bet create one from your trigger text."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-3" onSubmit={saveOffer}>
              <div className="flex flex-col gap-1.5">
                <Label>Category</Label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as typeof category)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="racing">Racing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {category === "racing" && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Bet £X get £X free bet if horse places 2nd, 3rd or 4th — UK &amp; IRE, min 8
                    runners.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="offer-stake">Bet stake (£)</Label>
                      <Input
                        id="offer-stake"
                        type="number"
                        min={1}
                        value={betStake}
                        onChange={(e) => setBetStake(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="offer-free">Free bet (£)</Label>
                      <Input
                        id="offer-free"
                        type="number"
                        min={1}
                        value={freeBetAmount}
                        onChange={(e) => setFreeBetAmount(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="offer-min-runners">Min runners</Label>
                    <Input
                      id="offer-min-runners"
                      type="number"
                      min={5}
                      value={minRunners}
                      onChange={(e) => setMinRunners(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label>Course scope</Label>
                    <Select
                      value={scopeMode}
                      onValueChange={(v) => setScopeMode(v as typeof scopeMode)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uk_ire">UK &amp; Ireland</SelectItem>
                        <SelectItem value="course">Specific course</SelectItem>
                      </SelectContent>
                    </Select>
                    {scopeMode === "uk_ire" && (
                      <p className="text-[11px] text-muted-foreground">
                        All qualifying GB &amp; IRE courses on the racing day.
                      </p>
                    )}
                  </div>
                  {scopeMode === "uk_ire" && (
                    <div className="flex flex-col gap-1.5">
                      <Label>Regions</Label>
                      <div className="flex gap-2">
                        {(
                          [
                            { id: "GB" as const, label: "UK (GB)" },
                            { id: "IRE" as const, label: "Ireland" },
                          ] as const
                        ).map(({ id, label }) => {
                          const active = scopeRegions.includes(id);
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => {
                                setScopeRegions((prev) => {
                                  if (active) {
                                    const next = prev.filter((r) => r !== id);
                                    return next.length > 0 ? next : prev;
                                  }
                                  return [...prev, id];
                                });
                              }}
                              className={filterPillState(active)}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {scopeMode === "course" && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="offer-course">Course</Label>
                      <Input
                        id="offer-course"
                        placeholder="Catterick"
                        value={scopeCourse}
                        onChange={(e) => setScopeCourse(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="offer-event-date">Racing day</Label>
                    <Input
                      id="offer-event-date"
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="offer-title">
                  {category === "racing" ? "Title (optional)" : "Title"}
                </Label>
                <Input
                  id="offer-title"
                  placeholder={
                    category === "racing"
                      ? "Auto-generated from stake amounts"
                      : "Bet £50 get £50 free bet"
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="offer-bookie">Bookie</Label>
                <Input
                  id="offer-bookie"
                  placeholder="Betfair Sportsbook"
                  value={bookmaker}
                  onChange={(e) => setBookmaker(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="offer-exp">Expected profit (£)</Label>
                <Input
                  id="offer-exp"
                  type="number"
                  step="0.01"
                  placeholder="45"
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="offer-expires">Expires</Label>
                <Input
                  id="offer-expires"
                  type="date"
                  value={expires}
                  onChange={(e) => setExpires(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Select
                  value={offerStatus}
                  onValueChange={(v) => setOfferStatus(v as typeof offerStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                disabled={saving || (category === "general" && !title.trim() && editingId == null)}
              >
                {editingId != null ? (
                  <>
                    <Pencil className="size-4" /> Save changes
                  </>
                ) : (
                  <>
                    <Plus className="size-4" /> Add offer
                  </>
                )}
              </Button>
              {editingId != null && (
                <Button type="button" variant="ghost" onClick={resetForm}>
                  <X className="size-4" /> Cancel edit
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 lg:col-span-2">
          {filtered.length === 0 && (
            <EmptyState
              icon={Gift}
              title={
                filter === "needs_action"
                  ? "Nothing needs action"
                  : filter === "active"
                    ? "No active offers"
                    : "No offers yet"
              }
              description={
                filter === "needs_action"
                  ? "All open offers are waiting on results or already complete — check back after settlements."
                  : filter === "active"
                    ? "Add a place-refund racing offer to unlock Intelligence on the Racing Desk, or log a general promo."
                    : "Add an offer manually with the form, or log a bet with a promo trigger in the tracker."
              }
              action={{ label: "Add racing offer", href: "/offers" }}
              secondaryAction={{ label: "Offers guide", href: "/help?guide=offers" }}
            />
          )}

          {filtered.map((offer) => {
            const action = nextActions.find((a) => a.offerId === offer.id);
            return (
              <OfferCard
                key={offer.id}
                offer={offer}
                nextActionLabel={action ? offerNextActionLabel(action.kind) : null}
                nextActionDetail={action?.detail ?? null}
                onRefresh={refresh}
                onEdit={startEdit}
                isEditing={editingId === offer.id}
              />
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}

function OfferCard({
  offer,
  nextActionLabel,
  nextActionDetail,
  onRefresh,
  onEdit,
  isEditing,
}: {
  offer: OfferSummary;
  nextActionLabel?: string | null;
  nextActionDetail?: string | null;
  onRefresh: () => void;
  onEdit: (offer: OfferSummary) => void;
  isEditing: boolean;
}) {
  const racingRules = offer.sport === "horse_racing" ? parseOfferRules(offer) : null;
  const rulesSummary = racingRules ? formatBetGetFreePlaceSummary(racingRules) : null;

  async function markComplete() {
    await api(`/api/offers/${offer.id}`, { method: "PATCH", json: { status: "completed" } });
    toast.success("Offer marked complete");
    onRefresh();
  }

  async function markExpired() {
    await api(`/api/offers/${offer.id}`, { method: "PATCH", json: { status: "expired" } });
    toast.success("Offer marked expired");
    onRefresh();
  }

  async function reactivate() {
    await api(`/api/offers/${offer.id}`, { method: "PATCH", json: { status: "active" } });
    toast.success("Offer reactivated");
    onRefresh();
  }

  return (
    <Card className={cn(isEditing && "ring-2 ring-primary/40")}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={offerStatusBadgeVariant(offer.status)}>
                {formatPillLabel(offer.status)}
              </Badge>
              {nextActionLabel ? (
                <Badge variant="outline" className="border-primary/30 text-primary">
                  {nextActionLabel}
                </Badge>
              ) : null}
              {offer.sport === "horse_racing" && (
                <Badge variant="outline" className="gap-1">
                  <Trophy className="size-3" /> Racing
                </Badge>
              )}
              {offer.bookmaker && (
                <span className="text-xs text-muted-foreground">{offer.bookmaker}</span>
              )}
            </div>
            <CardTitle className="mt-1 text-base leading-snug">{offer.title}</CardTitle>
            {nextActionDetail ? (
              <p className="mt-1 text-xs text-primary/90">{nextActionDetail}</p>
            ) : null}
            <OfferPipelineStrip offer={offer} className="mt-2" />
            {rulesSummary && (
              <CardDescription className="mt-1 line-clamp-2">{rulesSummary}</CardDescription>
            )}
            {!rulesSummary && offer.description && offer.description !== offer.title && (
              <CardDescription className="mt-1 line-clamp-2">{offer.description}</CardDescription>
            )}
            {offer.sport === "horse_racing" && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatOfferScopeLabel(offer.scopeCourse)}
                {racingRules && isRegionalScope(offer.scopeCourse)
                  ? ` · ${racingRules.regions.join(" & ")}`
                  : ""}
                {offer.eventDate ? ` · ${offer.eventDate}` : ""}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs text-muted-foreground">Total</div>
            <MoneyFlow value={offer.profit.totalProfit} signColor className="text-lg font-bold" />
            {(offer.expectedProfit ?? offer.expectedFromBets) > 0 && (
              <div className="text-[11px] text-muted-foreground">
                exp £{(offer.expectedProfit ?? offer.expectedFromBets).toFixed(2)}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <OfferProfitLines profit={offer.profit} />
        <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {offer.betCount} bet{offer.betCount === 1 ? "" : "s"}
          {offer.openBets > 0 ? ` · ${offer.openBets} open` : ""}
          {offer.expiresAt
            ? ` · expires ${new Date(offer.expiresAt).toLocaleDateString("en-GB")}`
            : ""}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onEdit(offer)}>
            <Pencil className="size-3.5" /> Edit
          </Button>
          <DeleteOfferDialog offer={offer} onDeleted={onRefresh} />
          {offer.status === "active" && offer.openBets === 0 && offer.betCount > 0 && (
            <Button size="sm" variant="secondary" onClick={() => void markComplete()}>
              <Gift className="size-3.5" /> Complete
            </Button>
          )}
          {(offer.status === "active" || offer.status === "planned") && (
            <Button size="sm" variant="ghost" onClick={() => void markExpired()}>
              Expire
            </Button>
          )}
          {(offer.status === "completed" || offer.status === "expired") && (
            <Button size="sm" variant="ghost" onClick={() => void reactivate()}>
              Reactivate
            </Button>
          )}
        </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OfferProfitLines({ profit }: { profit: OfferProfitBreakdown }) {
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
              <MoneyFlow value={profit.qualifyingProfit} signColor className="font-medium" />
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
                <span className="font-medium text-violet-700 dark:text-violet-300">
                  {formatGbp(profit.freeBetAwardAmount ?? 0)} awarded
                  {profit.freeBetAwardReason ? ` · ${profit.freeBetAwardReason}` : ""}
                </span>
              ) : profit.freeBetStage === "awaiting_result" ? (
                <span className="text-muted-foreground">Awaiting result</span>
              ) : profit.freeBetStage === "not_awarded" ? (
                <span className="text-muted-foreground">Not awarded</span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </span>
          </div>

          {(profit.freeBetStage === "in_use" ||
            profit.freeBetStage === "settled" ||
            profit.freeBetStage === "awarded") && (
            <div className="flex items-start justify-between gap-3 py-0.5">
              <span className="text-muted-foreground">Free bet P&amp;L</span>
              <span className="text-right">
                {profit.freeBetStage === "awarded" ? (
                  <span className="text-muted-foreground">Not used yet</span>
                ) : profit.freeBetOpenCount > 0 && profit.freeBetSettledCount === 0 ? (
                  <span className="text-muted-foreground">Open</span>
                ) : (
                  <MoneyFlow value={profit.freeBetProfit} signColor className="font-medium" />
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

  async function confirm() {
    setBusy(true);
    try {
      await api(`/api/offers/${offer.id}`, { method: "DELETE" });
      toast.success("Offer deleted");
      setOpen(false);
      onDeleted();
    } catch (err) {
      toast.error("Could not delete offer", { description: String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          <Trash2 className="size-3.5" /> Delete
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
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
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void confirm()} disabled={busy}>
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
