"use client";

/**
 * Boost checker (J2/J2b) in the Add bet idiom: stacked Back/Lay panels, the
 * bookie chip in the Back Bet header, and an Advanced lay mode reusing the
 * tested layplan targets - underlay is the boost play (£0 if it loses, the
 * full edge if it wins). Shared by the /boosts page and the side-nav quick
 * action dialog. Verdict maths is unchanged: fair price is the exchange
 * back/lay no-vig midpoint, EV at the boosted price.
 *
 * J2b: Log for later (diary only) vs Place bet (diary + Add bet prefilled as Boost).
 */

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdvancedLaySection } from "@/components/calc/advanced-lay";
import {
  BackPanel,
  LayPanel,
  LayStakeBanner,
  PanelInput,
  PanelTextInput,
  ProfitTable,
} from "@/components/calc/bet-panels";
import { BookmakerSelect } from "@/components/calc/bookmaker-select";
import { ExchangeSelect } from "@/components/calc/exchange-select";
import { NumField } from "@/components/calc/num-field";
import { EvBasisBadge } from "@/components/ui/ev-basis-badge";
import { useAddBet } from "@/components/add-bet-provider";
import { formatEvGbp } from "@/lib/format-money";
import { useExchanges } from "@/hooks/use-exchanges";
import { api } from "@/hooks/use-app-state";
import {
  executableLayStake,
  layBounds,
  layPlanOutcome,
  type PartLay,
} from "@/lib/calc";
import {
  boostVerdict,
  betBuilderFairOdds,
  type BoostCall,
} from "@/lib/calc/boost-check";
import { contrastText } from "@/lib/brands/exchanges";
import type { BoostDiaryRow, ExchangeRow } from "@/lib/db/schema";
import { boostDiaryToAddBetPrefill } from "@/lib/services/boosts-client";
import { panelSurface } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/** Fired after a check is logged so the /boosts diary refreshes if mounted. */
export const BOOSTS_CHANGED_EVENT = "edgeways:boosts-changed";

const VERDICT_CHIP: Record<BoostCall, { label: string; className: string }> = {
  take: { label: "Take it", className: "border-success/25 bg-success/10 text-success" },
  marginal: {
    label: "Marginal",
    className: "border-warning/40 bg-warning/10 text-warning",
  },
  skip: { label: "Skip", className: "border-negative/40 bg-negative/10 text-negative" },
};

export function BoostCheckerForm({
  onLogged,
  className,
}: {
  onLogged?: () => void;
  className?: string;
}) {
  const { openAddBet } = useAddBet();
  const [mode, setMode] = useState<"boost" | "builder">("boost");
  const [label, setLabel] = useState("");
  const [bookmaker, setBookmaker] = useState("");
  const [stake, setStake] = useState(10);
  const [boostedOdds, setBoostedOdds] = useState(NaN);
  const [exchangeBack, setExchangeBack] = useState(NaN);
  const [exchangeLay, setExchangeLay] = useState(NaN);
  // Builder mode
  const [legs, setLegs] = useState<number[]>([NaN, NaN]);
  const [haircutPct, setHaircutPct] = useState(0);
  const [haircutTouched, setHaircutTouched] = useState(false);
  // Advanced lay planning (boost mode)
  const [advanced, setAdvanced] = useState(false);
  const [partLays, setPartLays] = useState<PartLay[]>([]);
  const [layStakeOverride, setLayStakeOverride] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const { exchanges, defaultExchange } = useExchanges();
  const [exchangeOverride, setExchangeOverride] = useState<ExchangeRow | null>(null);
  const exchange = exchangeOverride ?? defaultExchange;
  const commission = (exchange?.commissionPct ?? 2) / 100;

  const builderFair = useMemo(() => {
    const valid = legs.filter((l) => Number.isFinite(l) && l > 1);
    if (valid.length === 0 || valid.length !== legs.length) return null;
    return betBuilderFairOdds(valid.map((fairOdds) => ({ fairOdds })), haircutPct);
  }, [legs, haircutPct]);

  const verdict = useMemo(() => {
    if (mode === "boost") {
      if (![boostedOdds, exchangeBack, exchangeLay].every((v) => Number.isFinite(v))) return null;
      return boostVerdict({ boostedOdds, exchangeBack, exchangeLay, stake });
    }
    if (!Number.isFinite(boostedOdds) || builderFair == null) return null;
    return boostVerdict({
      boostedOdds,
      exchangeBack: builderFair,
      exchangeLay: builderFair,
      stake,
    });
  }, [mode, boostedOdds, exchangeBack, exchangeLay, stake, builderFair]);

  const planInput = useMemo(() => {
    if (mode !== "boost") return null;
    if (!(stake > 0 && boostedOdds > 1 && exchangeLay > 1)) return null;
    return {
      mode: "qualifying" as const,
      backStake: stake,
      backOdds: boostedOdds,
      layOdds: exchangeLay,
      commission,
      partLays: advanced ? partLays.filter((p) => p.odds > 1 && p.stake > 0) : [],
    };
  }, [mode, stake, boostedOdds, exchangeLay, commission, advanced, partLays]);
  const bounds = useMemo(() => (planInput ? layBounds(planInput) : null), [planInput]);
  const layStake = useMemo(
    () => (planInput ? executableLayStake(planInput, layStakeOverride) : 0),
    [planInput, layStakeOverride]
  );
  const preview = useMemo(
    () => (planInput ? layPlanOutcome({ ...planInput, layStake }) : null),
    [planInput, layStake]
  );

  const basis = mode === "boost" || haircutTouched ? "estimated" : "heuristic";
  const chip = verdict ? VERDICT_CHIP[verdict.verdict] : null;

  async function persistDiary(): Promise<BoostDiaryRow | null> {
    if (!verdict || !label.trim()) return null;
    const { entry } = await api<{ entry: BoostDiaryRow }>("/api/boosts", {
      method: "POST",
      json: {
        label: label.trim(),
        bookmaker: bookmaker.trim() || undefined,
        kind: mode,
        boostedOdds,
        fairOdds: verdict.fairOdds,
        stake,
        evGbp: verdict.evGbp,
        basis,
        layStake: mode === "boost" && layStake > 0 ? layStake : undefined,
        layOdds: mode === "boost" && exchangeLay > 1 ? exchangeLay : undefined,
        commission: mode === "boost" ? commission : undefined,
        exchangeId: mode === "boost" ? exchange?.id : undefined,
        exchangeBack: mode === "boost" && exchangeBack > 1 ? exchangeBack : undefined,
      },
    });
    return entry;
  }

  async function logForLater() {
    if (!verdict || !label.trim()) return;
    setSaving(true);
    try {
      await persistDiary();
      setLabel("");
      window.dispatchEvent(new Event(BOOSTS_CHANGED_EVENT));
      onLogged?.();
    } finally {
      setSaving(false);
    }
  }

  async function placeBet() {
    if (!verdict || !label.trim()) return;
    setSaving(true);
    try {
      // Edge case A: create Logged row first so cancel of Add bet loses nothing.
      const entry = await persistDiary();
      if (!entry) return;
      setLabel("");
      window.dispatchEvent(new Event(BOOSTS_CHANGED_EVENT));
      onLogged?.();
      openAddBet(boostDiaryToAddBetPrefill(entry));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Tabs
        value={mode}
        onValueChange={(v) => {
          setMode(v as typeof mode);
          setLayStakeOverride(null);
        }}
      >
        <TabsList>
          <TabsTrigger value="boost">Price boost</TabsTrigger>
          <TabsTrigger value="builder">Bet builder</TabsTrigger>
        </TabsList>
      </Tabs>

      <BackPanel
        title="Back Bet"
        venue={bookmaker}
        chip={
          <BookmakerSelect
            value={bookmaker}
            onChange={setBookmaker}
            className="[--pi:var(--panel)] [--pi-dark:var(--panel-dark)]"
          />
        }
      >
        <PanelTextInput
          label="Selection"
          value={label}
          onChange={setLabel}
          placeholder={mode === "boost" ? "e.g. Salah anytime scorer" : "e.g. Salah + over 2.5"}
        />
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <PanelInput
            label="Back stake"
            prefix="£"
            value={stake}
            onChange={setStake}
            min={0}
            placeholder="10.00"
          />
          <PanelInput
            label={mode === "boost" ? "Boosted odds (decimal)" : "Offered builder odds"}
            value={boostedOdds}
            onChange={setBoostedOdds}
            min={1}
            placeholder="3.00"
          />
        </div>
      </BackPanel>

      {mode === "boost" ? (
        <LayPanel
          title="Lay Bet"
          exchange={exchange}
          chip={
            <span className="flex items-center gap-2.5">
              {exchange && (
                <span
                  className="rounded px-2 py-0.5 text-[11px] font-bold"
                  style={{
                    backgroundColor: exchange.brandColor,
                    color: contrastText(exchange.brandColor),
                  }}
                >
                  {exchange.name.toUpperCase()}
                </span>
              )}
              <label className="flex items-center gap-1.5 text-xs font-semibold text-black/70 dark:text-white/80">
                Advanced
                <Switch
                  tone="onPanel"
                  className="scale-90"
                  checked={advanced}
                  onCheckedChange={(on) => {
                    setAdvanced(on);
                    if (!on) {
                      setPartLays([]);
                      setLayStakeOverride(null);
                    }
                  }}
                />
              </label>
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <ExchangeSelect
              onPanel
              exchanges={exchanges}
              value={exchange}
              onChange={setExchangeOverride}
              showCommission
            />
            <PanelInput
              label="Lay odds (decimal)"
              value={exchangeLay}
              onChange={setExchangeLay}
              min={1}
              placeholder="2.70"
              exchangeOddsStepping
            />
          </div>
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <PanelInput
              label="Exchange back (decimal)"
              value={exchangeBack}
              onChange={setExchangeBack}
              min={1}
              placeholder="2.60"
              exchangeOddsStepping
            />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-black/60 dark:text-white/70">
                Fair odds (no-vig midpoint)
              </span>
              <div className="flex h-11 items-center rounded-md bg-[var(--pi)] px-3 text-lg font-bold tabular-nums text-black/85 dark:bg-[var(--pi-dark)] dark:text-white/95">
                {verdict ? verdict.fairOdds.toFixed(2) : "–"}
              </div>
            </div>
          </div>
          {advanced &&
            (bounds ? (
              <AdvancedLaySection
                bounds={bounds}
                layStake={layStake}
                onLayStake={setLayStakeOverride}
                partLays={partLays}
                onPartLays={setPartLays}
                accent={exchange?.brandColor ?? "#1e293b"}
              />
            ) : (
              <p className="text-xs text-black/60 dark:text-white/60">
                Enter back stake, boosted odds and lay odds to unlock the
                underlay/standard/overlay slider - Underlay is the boost play: £0 back if it
                loses, the full edge if it wins.
              </p>
            ))}
          {bounds ? (
            <LayStakeBanner
              value={layStake}
              onChange={(v) =>
                setLayStakeOverride(Number.isFinite(v) && v >= 0 ? v : null)
              }
            />
          ) : null}
        </LayPanel>
      ) : (
        <div className={cn(panelSurface, "flex flex-col gap-2 p-4")}>
          <Label className="text-xs text-muted-foreground">
            Fair odds per leg (from the exchange or your own read)
          </Label>
          {legs.map((leg, i) => (
            <div key={i} className="flex items-center gap-2">
              <NumField
                label={`Leg ${i + 1}`}
                value={leg}
                onChange={(v) => setLegs(legs.map((l, j) => (j === i ? v : l)))}
                min={1.01}
                step={0.01}
                placeholder="2.00"
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                className="mt-5 size-8 text-muted-foreground"
                aria-label={`Remove leg ${i + 1}`}
                disabled={legs.length <= 1}
                onClick={() => setLegs(legs.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setLegs([...legs, NaN])}
            >
              <Plus className="size-3.5" /> Add leg
            </Button>
            <NumField
              label="Correlation haircut (%)"
              value={haircutPct}
              onChange={(v) => {
                setHaircutPct(Number.isFinite(v) ? v : 0);
                setHaircutTouched(true);
              }}
              min={0}
              step={5}
              className="w-40"
              hint={haircutTouched ? undefined : "Same-match legs are correlated - fair is shorter than the product"}
            />
          </div>
          {builderFair != null ? (
            <p className="text-xs text-muted-foreground">
              Fair builder odds: <span className="font-medium tabular-nums">{builderFair.toFixed(2)}</span>
              <span className="ml-2 text-muted-foreground/80">
                A same-match builder can&apos;t be laid as one bet - this mode is verdict-only.
              </span>
            </p>
          ) : null}
        </div>
      )}

      {mode === "boost" && preview && layStake > 0 ? (
        <ProfitTable
          rows={[
            {
              label: "If back (bookie) bet wins",
              bookie: preview.ifBackWins.bookie,
              exchange: preview.ifBackWins.exchange,
              accent: "back",
            },
            {
              label: "If lay (exchange) bet wins",
              bookie: preview.ifBackLoses.bookie,
              exchange: preview.ifBackLoses.exchange,
              accent: "lay",
            },
          ]}
          guaranteed={preview.guaranteed}
          exchange={exchange}
          venue={bookmaker}
          totalLabel="Guaranteed (worst case)"
        />
      ) : null}

      <div className="rounded-md border bg-selection-subtle/50 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Verdict
          </span>
          {verdict && chip ? (
            <span className="flex items-center gap-2">
              <EvBasisBadge
                basis={basis}
                description={
                  basis === "heuristic"
                    ? "Assumes independent legs - set a correlation haircut for a fairer price"
                    : "Based on the prices you entered"
                }
              />
              <Badge variant="outline" className={chip.className}>
                {chip.label}
              </Badge>
            </span>
          ) : null}
        </div>
        {verdict ? (
          <p className="mt-1 text-sm font-semibold tabular-nums">
            {verdict.edgePct >= 0 ? "+" : ""}
            {verdict.edgePct.toFixed(1)}% edge · EV {formatEvGbp(verdict.evGbp, { signed: true })}{" "}
            <span className="font-normal text-muted-foreground">
              · fair {verdict.fairOdds.toFixed(2)}
            </span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the prices to get a verdict.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => void logForLater()}
          disabled={saving || !verdict || !label.trim()}
        >
          Log for later
        </Button>
        <Button
          onClick={() => void placeBet()}
          disabled={saving || !verdict || !label.trim()}
        >
          Place bet
        </Button>
      </div>
    </div>
  );
}
