"use client";

/**
 * Casino campaign card - the desk's counterpart to OfferCampaignCard.
 * Used on the Casino list and inside CasinoViewDialog (calendar click).
 */

import { useState } from "react";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CasinoCampaignSimDialog } from "@/components/casino/casino-campaign-sim-dialog";
import { CasinoComponentDialog } from "@/components/casino/casino-component-dialog";
import { CasinoOfferEditDialog } from "@/components/casino/casino-offer-edit-dialog";
import {
  CasinoPendingReminders,
  CasinoSetReminderDialog,
} from "@/components/casino/casino-set-reminder-dialog";
import {
  BASIS_COPY,
  COMPONENT_LABELS,
  VarianceChip,
  campaignVarianceTier,
  componentSummaryLine,
} from "@/components/casino/casino-ui";
import { MoneyFlow, moneyPositiveClass } from "@/components/money-flow";
import { outlineButtonGroup } from "@/components/layout/page-header-actions";
import { VenueBadge } from "@/components/venue-badge";
import { NumField } from "@/components/calc/num-field";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import { api, useAppState } from "@/hooks/use-app-state";
import {
  groupCampaignTiers,
  shouldShowCampaignTiers,
  tierExpectedEv,
} from "@/lib/casino/campaign-tiers";
import {
  daysUntilOfferExpiry,
  formatOfferDaysLeftLabel,
  offerExpiryUrgency,
} from "@/lib/offers/offer-expiry";
import { formatRecurrenceLabel } from "@/lib/offers/offer-recurrence-shared";
import { formatGbp, roundMoney } from "@/lib/format-money";
import { offerStatusBadgeVariant } from "@/lib/ui/status-badges";
import {
  campaignCardBadge,
  campaignCardFooterMeta,
  campaignCardHeader,
  campaignCardOpenLink,
  campaignCardPnl,
  campaignCardPnlLabel,
  campaignCardTitle,
  offerCampaignCardShell,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import type { CasinoOfferComponentRow, CasinoOfferRow } from "@/lib/db/schema";
import type { CasinoOfferSummary } from "@/lib/services/casino-offers.types";

const STATUS_LABEL: Record<CasinoOfferRow["status"], string> = {
  planned: "Planned",
  active: "In progress",
  completed: "Completed",
  expired: "Expired",
};

function DeleteButton({
  onConfirm,
  label,
  labelled = false,
}: {
  onConfirm: () => void;
  label: string;
  /** Campaign footers: labelled destructive ghost. Step rows stay icon-only. */
  labelled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  if (armed) {
    return (
      <Button variant="destructive" size="sm" onClick={onConfirm} onBlur={() => setArmed(false)}>
        Delete?
      </Button>
    );
  }
  if (labelled) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="text-destructive hover:text-destructive"
        aria-label={label}
        onClick={() => setArmed(true)}
      >
        <Trash2 className="size-3.5" /> Delete
      </Button>
    );
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground"
      aria-label={label}
      onClick={() => setArmed(true)}
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}

function DeleteCampaignDialog({
  offer,
  onRemoved,
}: {
  offer: CasinoOfferSummary;
  onRemoved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const recurring = Boolean(offer.seriesId && offer.recurrence?.enabled);
  const [scope, setScope] = useState<"instance" | "future">("instance");

  async function confirmDelete() {
    setBusy(true);
    try {
      const qs = recurring && scope === "future" ? "?scope=future" : "";
      await api(`/api/casino/${offer.id}${qs}`, { method: "DELETE" });
      setOpen(false);
      onRemoved();
    } catch {
      // keep dialog open so the user can retry
    } finally {
      setBusy(false);
    }
  }

  if (!recurring) {
    return (
      <DeleteButton
        onConfirm={() => void confirmDelete()}
        label="Delete campaign"
        labelled
      />
    );
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
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          aria-label="Delete campaign"
        >
          <Trash2 className="size-3.5" /> Delete
        </Button>
      </DialogTrigger>
      <DialogContent mobile="center" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete campaign?</DialogTitle>
          <DialogDescription>
            This permanently removes &ldquo;{offer.title}&rdquo;. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2 text-sm">
          <legend className="sr-only">Delete scope</legend>
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="radio"
              name={`casino-delete-scope-${offer.id}`}
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
              name={`casino-delete-scope-${offer.id}`}
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

type CompleteMode = "net_profit" | "new_balance";

function CompleteDialog({
  offer,
  onDone,
  mobile = "sheet",
}: {
  offer: CasinoOfferSummary;
  onDone: () => void;
  mobile?: "sheet" | "center";
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Controlled open (not DialogTrigger) so the Button stays on the Press path. */}
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Complete
      </Button>
      {/* Remount on open so mode / amounts reset cleanly between campaigns. */}
      {open ? (
        <CompleteDialogForm
          offer={offer}
          onDone={onDone}
          onOpenChange={setOpen}
          mobile={mobile}
        />
      ) : null}
    </Dialog>
  );
}

function CompleteDialogForm({
  offer,
  onDone,
  onOpenChange,
  mobile = "sheet",
}: {
  offer: CasinoOfferSummary;
  onDone: () => void;
  onOpenChange: (open: boolean) => void;
  mobile?: "sheet" | "center";
}) {
  const { state } = useAppState(0);
  const hasCasino = Boolean(offer.casino?.trim());
  const casinoName = offer.casino?.trim() ?? "";
  const currentBalance = roundMoney(
    state?.balances.accounts.find(
      (a) => a.type === "bookie" && a.name.trim().toLowerCase() === casinoName.toLowerCase()
    )?.balance ?? 0
  );

  const [mode, setMode] = useState<CompleteMode>("net_profit");
  const [profit, setProfit] = useState(0);
  const [newBalance, setNewBalance] = useState(currentBalance);
  const [saving, setSaving] = useState(false);

  const derivedProfit =
    mode === "new_balance" ? roundMoney(newBalance - currentBalance) : roundMoney(profit);

  function changeMode(next: CompleteMode) {
    setMode(next);
    if (next === "new_balance") setNewBalance(currentBalance);
    else setProfit(0);
  }

  async function complete() {
    setSaving(true);
    try {
      await api(`/api/casino/${offer.id}`, {
        method: "PATCH",
        json: { status: "completed", actualProfit: derivedProfit },
      });
      onOpenChange(false);
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-w-sm" mobile={mobile}>
      <DialogHeader>
        <DialogTitle>Complete campaign</DialogTitle>
        <DialogDescription>
          {mode === "new_balance"
            ? "Set the wallet after cashing out. The change from the current balance is recorded as Casino P&L."
            : "Net result of the whole campaign, covering stake, bonus and cash out together."}
        </DialogDescription>
      </DialogHeader>

      <Tabs value={mode} onValueChange={(v) => changeMode(v as CompleteMode)}>
        <TabsList>
          <TabsTrigger value="net_profit">Net profit</TabsTrigger>
          <TabsTrigger value="new_balance" disabled={!hasCasino}>
            New balance
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {mode === "net_profit" ? (
        <NumField label="Net profit" prefix="£" value={profit} onChange={setProfit} />
      ) : (
        <div className="flex flex-col gap-3">
          <NumField
            label="New balance"
            prefix="£"
            value={newBalance}
            onChange={setNewBalance}
            hint={`Current ${formatGbp(currentBalance)}`}
            labelExtra={
              <span
                className={cn(
                  "text-xs font-semibold tabular-nums",
                  derivedProfit > 0
                    ? moneyPositiveClass
                    : derivedProfit < 0
                      ? "text-negative"
                      : "text-muted-foreground"
                )}
              >
                Net {formatGbp(derivedProfit, { signed: true })}
              </span>
            }
          />
        </div>
      )}

      {hasCasino ? (
        <p className="text-xs text-muted-foreground">
          Updates the {offer.casino} wallet and counts toward total P&L as Casino P&L
          (kept separate from Betting P&L).
        </p>
      ) : (
        <p className="text-xs font-medium text-warning">
          Set a casino on the campaign first so the bookie wallet can update.
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={() => void complete()} disabled={saving}>
          Save result
        </Button>
      </div>
    </DialogContent>
  );
}

function ComponentRow({
  offer,
  component,
  onChanged,
  dialogMobile = "sheet",
}: {
  offer: CasinoOfferSummary;
  component: CasinoOfferComponentRow;
  onChanged: (offer: CasinoOfferSummary) => void;
  dialogMobile?: "sheet" | "center";
}) {
  async function remove() {
    const res = await api<{ offer: CasinoOfferSummary }>(
      `/api/casino/${offer.id}/components/${component.id}`,
      { method: "DELETE" }
    );
    onChanged(res.offer);
  }

  return (
    <div className="flex items-center gap-2 rounded border border-border/60 bg-background px-2.5 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium">
          {COMPONENT_LABELS[component.componentType]}{" "}
          <MoneyFlow
            value={component.expectedEv}
            signColor
            signDisplay
            estimate
            className="font-semibold tabular-nums"
          />
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {componentSummaryLine(component)}
        </p>
      </div>
      <CasinoComponentDialog
        casinoOfferId={offer.id}
        existing={component}
        siblings={offer.components}
        onSaved={onChanged}
        mobile={dialogMobile}
      />
      <DeleteButton onConfirm={() => void remove()} label="Remove step" />
    </div>
  );
}

/** Flat steps, or Tier 1…N when the campaign is a stake ladder (UI-only grouping). */
function CampaignStepList({
  offer,
  onChanged,
  dialogMobile = "sheet",
}: {
  offer: CasinoOfferSummary;
  onChanged: (offer: CasinoOfferSummary) => void;
  dialogMobile?: "sheet" | "center";
}) {
  const tiers = groupCampaignTiers(offer.components);
  const showTiers = shouldShowCampaignTiers(tiers);

  if (!showTiers) {
    return (
      <div className="flex flex-col gap-1.5">
        {offer.components.map((c) => (
          <ComponentRow
            key={c.id}
            offer={offer}
            component={c}
            onChanged={onChanged}
            dialogMobile={dialogMobile}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {tiers.map((tier) => {
        const tierEv = tierExpectedEv(tier.components);
        return (
          <div
            key={`tier-${tier.index}-${tier.components[0]?.id ?? tier.index}`}
            className="rounded-md border border-border/60 bg-muted/20 p-2"
          >
            <div className="mb-1.5 flex items-baseline justify-between gap-2 px-0.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tier {tier.index}
              </p>
              <MoneyFlow
                value={tierEv}
                signColor
                signDisplay
                estimate
                className="text-xs font-semibold tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              {tier.components.map((c) => (
                <ComponentRow
                  key={c.id}
                  offer={offer}
                  component={c}
                  onChanged={onChanged}
                  dialogMobile={dialogMobile}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CasinoCampaignCard({
  offer,
  onChanged,
  onRemoved,
  onEdit,
  nestedDialogMobile = "sheet",
}: {
  offer: CasinoOfferSummary;
  onChanged: (offer: CasinoOfferSummary) => void;
  onRemoved: () => void;
  /** When set, Edit closes this surface and opens the editor as a sibling (view modal). */
  onEdit?: (offer: CasinoOfferSummary) => void;
  nestedDialogMobile?: "sheet" | "center";
}) {
  const tier = campaignVarianceTier(offer.components);
  const settled = offer.status === "completed" && offer.actualProfit != null;
  const headerEv = settled ? offer.actualProfit! : offer.expectedEv;
  const isExpired = offer.status === "expired";
  const daysLeft = daysUntilOfferExpiry(offer.expiresAt);
  const expiryLabel =
    !settled && !isExpired ? formatOfferDaysLeftLabel(daysLeft) : null;
  const expiryUrgency = offerExpiryUrgency(daysLeft);
  const headerTintClass = isExpired
    ? "offer-header-tint-expired"
    : headerEv > 0.005
      ? "offer-header-tint-win"
      : headerEv < -0.005
        ? "offer-header-tint-loss"
        : null;

  return (
    <Card className={cn(offerCampaignCardShell, "gap-0 overflow-hidden py-0")}>
      <CardHeader className={cn(campaignCardHeader, headerTintClass ?? "bg-card")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {offer.casino ? <VenueBadge name={offer.casino} kind="bookie" size="md" /> : null}
              <Badge
                variant={offerStatusBadgeVariant(offer.status)}
                className={campaignCardBadge}
              >
                {STATUS_LABEL[offer.status]}
              </Badge>
            </div>
            <CardTitle className={campaignCardTitle}>{offer.title}</CardTitle>
            {offer.offerUrl ? (
              <a
                href={offer.offerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={campaignCardOpenLink}
              >
                <ExternalLink className="size-3 shrink-0" />
                Open offer
              </a>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p className={campaignCardPnlLabel}>
              {settled ? "Realised" : "Total EV"}
            </p>
            <MoneyFlow value={headerEv} signColor estimate={!settled} className={campaignCardPnl} />
            <div className="mt-0.5 flex items-center justify-end gap-1.5">
              <EvBasisBadge
                basis={offer.evBasis}
                description={offer.evBasis === "estimated" ? BASIS_COPY.entered : BASIS_COPY.defaulted}
              />
              {tier ? <VarianceChip tier={tier} /> : null}
            </div>
          </div>
        </div>
        {settled ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Expected{" "}
            <MoneyFlow
              value={offer.expectedEv}
              signColor
              signDisplay
              estimate
              className="inline font-medium"
            />{" "}
            → Realised{" "}
            <MoneyFlow
              value={offer.actualProfit!}
              signColor
              signDisplay
              className="inline font-medium"
            />
          </p>
        ) : null}
      </CardHeader>

      <CardContent className="border-t border-border/50 py-2.5">
        {offer.components.length > 0 ? (
          <CampaignStepList
            offer={offer}
            onChanged={onChanged}
            dialogMobile={nestedDialogMobile}
          />
        ) : (
          <p className="rounded border border-dashed border-border/60 px-2.5 py-2 text-xs text-muted-foreground">
            Nothing logged yet, add a step to get an EV verdict.
          </p>
        )}
        <div className="mt-2">
          <CasinoComponentDialog
            casinoOfferId={offer.id}
            siblings={offer.components}
            onSaved={onChanged}
            mobile={nestedDialogMobile}
          />
        </div>
        <CasinoPendingReminders offer={offer} onChanged={onChanged} />
      </CardContent>

      {offer.recurrence?.enabled ? (
        <CardContent className="border-t border-border/50 py-2.5">
          <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2.5 text-xs">
            <p className="font-medium text-foreground">
              {formatRecurrenceLabel(offer.recurrence.rule)}
              {offer.recurrence.instanceDate ? ` · ${offer.recurrence.instanceDate}` : ""}
            </p>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-muted-foreground">
              <input
                type="checkbox"
                onChange={(e) => {
                  if (!e.target.checked) return;
                  void api<{ offer: CasinoOfferSummary }>(`/api/casino/${offer.id}`, {
                    method: "PATCH",
                    json: { stopRecurrence: true },
                  }).then((r) => onChanged(r.offer));
                }}
              />
              Stop repeating from this occurrence forward
            </label>
          </div>
        </CardContent>
      ) : null}

      <CardContent className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 py-3.5 pl-(--card-spacing) pr-[calc(var(--card-spacing)-4px)]">
        <span className={campaignCardFooterMeta}>
          {offer.components.length} step{offer.components.length === 1 ? "" : "s"}
          {expiryLabel && expiryUrgency === "today" ? (
            <>
              {" · "}
              <span className="font-medium text-rose-600 dark:text-rose-400">{expiryLabel}</span>
            </>
          ) : expiryLabel && expiryUrgency === "tomorrow" ? (
            <>
              {" · "}
              <span className="font-medium text-orange-600 dark:text-orange-400">{expiryLabel}</span>
            </>
          ) : expiryLabel ? (
            ` · ${expiryLabel}`
          ) : null}
        </span>
        <div className="flex flex-wrap gap-1.5">
          <DeleteCampaignDialog offer={offer} onRemoved={onRemoved} />
          <div className={outlineButtonGroup}>
            {onEdit ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onEdit(offer)}
              >
                <Pencil className="size-3.5" /> Edit
              </Button>
            ) : (
              <CasinoOfferEditDialog
                offer={offer}
                onSaved={onChanged}
                mobile={nestedDialogMobile}
              />
            )}
            {offer.status === "planned" || offer.status === "active" ? (
              <CasinoSetReminderDialog
                offer={offer}
                onChanged={onChanged}
                mobile={nestedDialogMobile}
              />
            ) : null}
            {offer.components.length > 0 ? (
              <CasinoCampaignSimDialog
                title={offer.title}
                components={offer.components}
                analyticEv={offer.expectedEv}
                defaultVolatility={tier ?? undefined}
                mobile={nestedDialogMobile}
              />
            ) : null}
            {offer.status === "planned" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void api(`/api/casino/${offer.id}`, {
                    method: "PATCH",
                    json: { status: "active" },
                  }).then(() => onChanged({ ...offer, status: "active" }))
                }
              >
                Start
              </Button>
            ) : null}
            {offer.status === "planned" || offer.status === "active" ? (
              <CompleteDialog
                offer={offer}
                onDone={onRemoved}
                mobile={nestedDialogMobile}
              />
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
