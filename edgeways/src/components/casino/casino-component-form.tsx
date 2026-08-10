"use client";

/**
 * Casino offer COMPONENT form (K1) - the reward/cost editor for one row of a
 * casino campaign. A campaign can carry any combination of these; this form
 * is shared by "add a component" (casino-log-provider.tsx, casino card "+
 * Add component") and "edit a component" (casino card edit action) - both
 * just pass a different `existing` prop.
 */

import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NumField } from "@/components/calc/num-field";
import { CasinoGamePicker } from "@/components/casino/casino-game-picker";
import { BASIS_COPY } from "@/components/casino/casino-ui";
import { MoneyFlow } from "@/components/money-flow";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import { api } from "@/hooks/use-app-state";
import {
  AMERICAN_ROULETTE_EDGE,
  EUROPEAN_ROULETTE_EDGE,
  deriveComponentEv,
  type CasinoComponentType,
} from "@/lib/calc/casino-reward-ev";
import { bestGame, matchGamesInText, type CasinoGame } from "@/lib/casino/game-library";
import type { CasinoOfferComponentRow } from "@/lib/db/schema";
import type { CasinoOfferSummary } from "@/lib/services/casino-offers.types";
import { cn } from "@/lib/utils";

const COMPONENT_LABELS: Record<CasinoComponentType, string> = {
  qualifying_wager: "Qualifying wager",
  cash: "Cash",
  bonus: "Bonus",
  free_spins: "Free spins",
  golden_chips: "Golden chips",
  cashback: "Cashback",
};

const COMPONENT_TYPES = Object.keys(COMPONENT_LABELS) as CasinoComponentType[];

function pctToFraction(pct: number): number | undefined {
  return Number.isFinite(pct) ? Math.min(1, Math.max(0, pct / 100)) : undefined;
}

export function CasinoComponentForm({
  casinoOfferId,
  existing,
  initialComponentType,
  sourceText,
  initialGameName,
  onSaved,
  initialValues,
  onCancel,
  submitLabel,
}: {
  casinoOfferId: number;
  /** Present = edit mode; absent = add mode */
  existing?: CasinoOfferComponentRow;
  /** Add-mode only - preselects the type dropdown (defaults to qualifying wager) */
  initialComponentType?: CasinoComponentType;
  /** Add-mode only - promo text to match eligible games against the library */
  sourceText?: string;
  /** Add-mode only - preselect a library game by name (e.g. carried from prior wizard step) */
  initialGameName?: string | null;
  /** Add-mode only - prefill from a paste-parser draft (fractions 0-1) */
  initialValues?: {
    amount?: number | null;
    wageringMultiplier?: number | null;
    rtp?: number | null;
    contributionPct?: number | null;
    spins?: number | null;
    chipCount?: number | null;
    chipValue?: number | null;
    spinValue?: number | null;
    cashbackPct?: number | null;
  };
  onSaved: (offer: CasinoOfferSummary) => void;
  onCancel: () => void;
  /** Add-mode primary button label (e.g. "Next step" in the log wizard). */
  submitLabel?: string;
}) {
  const stepTypeId = useId();
  const [componentType, setComponentType] = useState<CasinoComponentType>(
    existing?.componentType ?? initialComponentType ?? "qualifying_wager"
  );
  const [amount, setAmount] = useState(existing?.amount ?? initialValues?.amount ?? 20);
  const [wageringMultiplier, setWageringMultiplier] = useState(
    existing?.wageringMultiplier ??
      (initialValues?.wageringMultiplier != null ? initialValues.wageringMultiplier : NaN)
  );
  const [rtpPct, setRtpPct] = useState(
    existing?.rtp != null
      ? existing.rtp * 100
      : initialValues?.rtp != null
        ? initialValues.rtp * 100
        : NaN
  );
  const [contributionPct, setContributionPct] = useState(
    existing?.contributionPct != null
      ? existing.contributionPct * 100
      : initialValues?.contributionPct != null
        ? initialValues.contributionPct * 100
        : NaN
  );
  const [spins, setSpins] = useState(existing?.spins ?? initialValues?.spins ?? 20);
  const [spinValue, setSpinValue] = useState(
    existing?.spinValue ?? initialValues?.spinValue ?? 0.4
  );
  const [chipCount, setChipCount] = useState(existing?.chipCount ?? initialValues?.chipCount ?? 10);
  const [chipValue, setChipValue] = useState(existing?.chipValue ?? initialValues?.chipValue ?? 5);
  const [houseEdgePreset, setHouseEdgePreset] = useState<"european" | "american" | "custom">(
    existing?.houseEdgePreset ?? "european"
  );
  const [cashbackPct, setCashbackPct] = useState(
    existing?.cashbackPct != null
      ? existing.cashbackPct * 100
      : initialValues?.cashbackPct != null
        ? initialValues.cashbackPct * 100
        : 10
  );
  const [cashbackCap, setCashbackCap] = useState(existing?.cashbackCap ?? NaN);
  const [games, setGames] = useState<CasinoGame[]>([]);
  const [selectedGameIds, setSelectedGameIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ games: CasinoGame[] }>("/api/casino/games")
      .then((r) => {
        setGames(r.games);
        const seedName = (initialGameName ?? existing?.game)?.trim();
        if (seedName) {
          const exact = r.games.find(
            (g) => g.name.toLowerCase() === seedName.toLowerCase()
          );
          if (exact) {
            applySelection([exact.id], r.games);
            return;
          }
        }
        if (sourceText) {
          const matched = matchGamesInText(sourceText, r.games);
          if (matched.length > 0) applySelection(matched.map((g) => g.id), r.games);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applySelection(ids: number[], pool: CasinoGame[] = games) {
    setSelectedGameIds(ids);
    const best = bestGame(pool.filter((g) => ids.includes(g.id)));
    if (best) setRtpPct(best.rtp * 100);
  }

  function applyEdgePreset(preset: "european" | "american") {
    setHouseEdgePreset(preset);
    const edge = preset === "european" ? EUROPEAN_ROULETTE_EDGE : AMERICAN_ROULETTE_EDGE;
    setRtpPct((1 - edge) * 100);
  }

  const rtpEntered = Number.isFinite(rtpPct);
  const previewEv = useMemo(() => {
    const rtp = rtpEntered ? rtpPct / 100 : undefined;
    return deriveComponentEv({
      componentType,
      amount,
      wageringMultiplier: Number.isFinite(wageringMultiplier) ? wageringMultiplier : undefined,
      rtp,
      contributionPct: pctToFraction(contributionPct),
      spins,
      spinValue,
      chipCount,
      chipValue,
      cashbackPct: pctToFraction(cashbackPct),
      cashbackCap: Number.isFinite(cashbackCap) ? cashbackCap : undefined,
    });
  }, [
    componentType,
    amount,
    wageringMultiplier,
    rtpPct,
    rtpEntered,
    contributionPct,
    spins,
    spinValue,
    chipCount,
    chipValue,
    cashbackPct,
    cashbackCap,
  ]);

  const recommendedGame = bestGame(games.filter((g) => selectedGameIds.includes(g.id)));

  function buildPayload(): Record<string, unknown> {
    const rtp = rtpEntered ? rtpPct / 100 : null;
    const game = recommendedGame?.name ?? null;
    switch (componentType) {
      case "qualifying_wager":
        return { componentType, amount, rtp, game };
      case "cash":
        return { componentType, amount };
      case "bonus":
        return {
          componentType,
          amount,
          wageringMultiplier: Number.isFinite(wageringMultiplier) ? wageringMultiplier : 0,
          rtp,
          contributionPct: pctToFraction(contributionPct) ?? null,
          game,
        };
      case "free_spins":
        return {
          componentType,
          spins,
          spinValue,
          rtp,
          wageringMultiplier: Number.isFinite(wageringMultiplier) ? wageringMultiplier : null,
          contributionPct: pctToFraction(contributionPct) ?? null,
          game,
        };
      case "golden_chips":
        return { componentType, chipCount, chipValue, rtp: rtp ?? 1 - EUROPEAN_ROULETTE_EDGE, houseEdgePreset };
      case "cashback":
        return {
          componentType,
          amount,
          rtp,
          cashbackPct: pctToFraction(cashbackPct) ?? 0.1,
          cashbackCap: Number.isFinite(cashbackCap) ? cashbackCap : null,
          game,
        };
    }
  }

  async function save() {
    setSaving(true);
    try {
      const path = existing
        ? `/api/casino/${casinoOfferId}/components/${existing.id}`
        : `/api/casino/${casinoOfferId}/components`;
      const res = await api<{ offer: CasinoOfferSummary }>(path, {
        method: existing ? "PATCH" : "POST",
        json: buildPayload(),
      });
      onSaved(res.offer);
    } catch {
      // Validation rejections leave the form open for correction.
    } finally {
      setSaving(false);
    }
  }

  const canSave = (() => {
    switch (componentType) {
      case "qualifying_wager":
      case "cash":
      case "bonus":
        return amount > 0;
      case "free_spins":
        return spins > 0 && spinValue > 0;
      case "golden_chips":
        return chipCount > 0 && chipValue > 0;
      case "cashback":
        return amount > 0 && Number.isFinite(cashbackPct) && cashbackPct > 0;
    }
  })();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={stepTypeId} className="text-xs font-normal text-muted-foreground">
          Step type
        </Label>
        <Select
          value={componentType}
          onValueChange={(v) => setComponentType(v as CasinoComponentType)}
        >
          <SelectTrigger
            id={stepTypeId}
            className={cn(
              "h-8 w-full min-w-0 justify-between px-2.5 text-left text-sm font-normal text-foreground"
            )}
          >
            <SelectValue placeholder="Choose step type" />
          </SelectTrigger>
          <SelectContent position="popper" className="z-[200]">
            {COMPONENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {COMPONENT_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {componentType === "qualifying_wager" ? (
          <p className="text-xs leading-snug text-muted-foreground">
            A cost, not a reward - the deposit staked to unlock whatever else this campaign
            carries. Its EV is always £0 or below. Add another qualifying wager for the next
            stake tier on a ladder offer.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {componentType === "qualifying_wager" ? (
          <>
            <NumField label="Wager amount" prefix="£" value={amount} onChange={setAmount} min={0} />
            <NumField
              label="Game RTP (%)"
              value={rtpPct}
              onChange={(v) => setRtpPct(Number.isFinite(v) ? Math.min(100, v) : v)}
              min={50}
              step={0.1}
              placeholder="96 default"
              hint={rtpEntered ? undefined : "Using the 96% slot default"}
            />
          </>
        ) : null}

        {componentType === "cash" ? (
          <NumField
            label="Cash amount"
            prefix="£"
            value={amount}
            onChange={setAmount}
            min={0}
            className="col-span-2"
          />
        ) : null}

        {componentType === "bonus" ? (
          <>
            <NumField label="Bonus value" prefix="£" value={amount} onChange={setAmount} min={0} />
            <NumField
              label="Wagering (×)"
              value={wageringMultiplier}
              onChange={setWageringMultiplier}
              min={0}
              step={1}
              placeholder="Optional"
            />
            <NumField
              label="Game RTP (%)"
              value={rtpPct}
              onChange={(v) => setRtpPct(Number.isFinite(v) ? Math.min(100, v) : v)}
              min={50}
              step={0.1}
              placeholder="96 default"
              hint={rtpEntered ? undefined : "Using the 96% slot default"}
            />
            <NumField
              label="Contribution (%)"
              value={contributionPct}
              onChange={setContributionPct}
              min={1}
              step={5}
              placeholder="Optional"
            />
          </>
        ) : null}

        {componentType === "free_spins" ? (
          <>
            <NumField label="No. of spins" value={spins} onChange={setSpins} min={0} step={1} />
            <NumField label="Spin value" prefix="£" value={spinValue} onChange={setSpinValue} min={0} />
            <NumField
              label="Game RTP (%)"
              value={rtpPct}
              onChange={(v) => setRtpPct(Number.isFinite(v) ? Math.min(100, v) : v)}
              min={50}
              step={0.1}
              placeholder="96 default"
              hint={rtpEntered ? undefined : "Using the 96% slot default"}
            />
            <NumField
              label="Winnings wager (×)"
              value={wageringMultiplier}
              onChange={setWageringMultiplier}
              min={0}
              step={1}
              placeholder="Optional"
              hint="Playthrough on the spin winnings before cashout, if any"
            />
            <NumField
              label="Contribution (%)"
              value={contributionPct}
              onChange={setContributionPct}
              min={1}
              step={5}
              placeholder="Optional"
              className="col-span-2"
            />
          </>
        ) : null}

        {componentType === "golden_chips" ? (
          <>
            <NumField label="No. of chips" value={chipCount} onChange={setChipCount} min={0} step={1} />
            <NumField label="Chip value" prefix="£" value={chipValue} onChange={setChipValue} min={0} />
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">House edge</Label>
              <Tabs
                value={houseEdgePreset}
                onValueChange={(v) => {
                  if (v === "custom") setHouseEdgePreset("custom");
                  else applyEdgePreset(v as "european" | "american");
                }}
              >
                <TabsList>
                  <TabsTrigger value="european">European 2.70%</TabsTrigger>
                  <TabsTrigger value="american">American 5.26%</TabsTrigger>
                  <TabsTrigger value="custom">Custom</TabsTrigger>
                </TabsList>
              </Tabs>
              {houseEdgePreset === "custom" ? (
                <NumField
                  label="RTP (%)"
                  value={rtpPct}
                  onChange={(v) => setRtpPct(Number.isFinite(v) ? Math.min(100, v) : v)}
                  min={50}
                  step={0.01}
                  className="max-w-40"
                />
              ) : null}
            </div>
          </>
        ) : null}

        {componentType === "cashback" ? (
          <>
            <NumField
              label="Expected turnover"
              prefix="£"
              value={amount}
              onChange={setAmount}
              min={0}
            />
            <NumField
              label="Game RTP (%)"
              value={rtpPct}
              onChange={(v) => setRtpPct(Number.isFinite(v) ? Math.min(100, v) : v)}
              min={50}
              step={0.1}
              placeholder="96 default"
              hint={rtpEntered ? undefined : "Using the 96% slot default"}
            />
            <NumField
              label="Cashback (%)"
              value={cashbackPct}
              onChange={(v) => setCashbackPct(Number.isFinite(v) ? Math.min(100, v) : v)}
              min={0}
              step={1}
            />
            <NumField
              label="Cap"
              prefix="£"
              value={cashbackCap}
              onChange={setCashbackCap}
              min={0}
              placeholder="No cap"
            />
          </>
        ) : null}
      </div>

      {componentType !== "cash" ? (
        <CasinoGamePicker
          games={games}
          selectedIds={selectedGameIds}
          onToggle={(id) =>
            applySelection(
              selectedGameIds.includes(id)
                ? selectedGameIds.filter((x) => x !== id)
                : [...selectedGameIds, id]
            )
          }
          onRemove={(id) => applySelection(selectedGameIds.filter((x) => x !== id))}
        />
      ) : null}

      <div className="rounded-md border bg-selection-subtle/50 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            This step&apos;s EV
          </span>
          {componentType !== "golden_chips" && componentType !== "cash" ? (
            <EvBasisBadge
              basis={rtpEntered ? "estimated" : "heuristic"}
              description={rtpEntered ? BASIS_COPY.entered : BASIS_COPY.defaulted}
            />
          ) : null}
        </div>
        <p className="mt-1">
          <MoneyFlow
            value={previewEv}
            signColor
            signDisplay
            estimate
            className="text-sm font-semibold tabular-nums"
          />
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => void save()} disabled={saving || !canSave}>
          {existing ? "Save step" : (submitLabel ?? "Add step")}
        </Button>
      </div>
    </div>
  );
}
