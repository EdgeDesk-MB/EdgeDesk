"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { AdvancedLaySection } from "@/components/calc/advanced-lay";
import { CalculatorAddBetButton } from "@/components/calc/calculator-add-bet";
import {
  BackPanel,
  LayPanel,
  LayStakeBanner,
  PanelBookieInput,
  PanelInput,
  ProfitTable,
} from "@/components/calc/bet-panels";
import { EdgePanel } from "@/components/calc/edge-panel";
import { ExchangeSelect } from "@/components/calc/exchange-select";
import { PercentFlow } from "@/components/money-flow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { contrastText } from "@/lib/brands/exchanges";
import { useExchanges } from "@/hooks/use-exchanges";
import {
  layBounds,
  layPlanOutcome,
  executableLayStake,
  specialBonusExtras,
  SPECIAL_BONUS_HINTS,
  SPECIAL_BONUS_LABELS,
  type BetMode,
  type PartLay,
  type SpecialBonus,
  type SpecialBonusKind,
} from "@/lib/calc";
import type { ExchangeRow } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import type { MatchedCalculatorPrefill } from "@/components/matched-calculator-provider";

const modeLabels: Record<BetMode, string> = {
  qualifying: "Qualifying bet",
  free_snr: "Free bet (SNR)",
  free_sr: "Free bet (SR)",
  risk_free: "Money back if bet loses",
};

const modeHints: Record<BetMode, string> = {
  qualifying: "Placing a bet to qualify for a free bet or bonus.",
  free_snr: "Converting a free bet into cash - stake not returned.",
  free_sr: "Free bet where the stake IS returned on a win.",
  risk_free: "Losing stakes are refunded (usually as a free bet).",
};

const BONUS_KINDS = Object.keys(SPECIAL_BONUS_LABELS) as SpecialBonusKind[];

export function MatchedCalculator({
  className,
  prefill,
  open = true,
}: {
  className?: string;
  prefill?: MatchedCalculatorPrefill;
  open?: boolean;
}) {
  const { exchanges, defaultExchange } = useExchanges();
  const [exchange, setExchange] = useState<ExchangeRow | null>(null);
  const [mode, setMode] = useState<BetMode>("qualifying");
  const [bookmaker, setBookmaker] = useState("");
  const [backStake, setBackStake] = useState(10);
  const [backOdds, setBackOdds] = useState(3);
  const [layOdds, setLayOdds] = useState(3.1);
  const [commission, setCommission] = useState(2);
  const [refundAmount, setRefundAmount] = useState(10);
  const [refundRetention, setRefundRetention] = useState(70);
  const [bonusKind, setBonusKind] = useState<SpecialBonusKind>("none");
  const [bonusAmount, setBonusAmount] = useState(10);
  const [bonusMaxStake, setBonusMaxStake] = useState(10);
  const [bonusMaxReturn, setBonusMaxReturn] = useState(NaN);
  const [bonusFbRetention, setBonusFbRetention] = useState(70);
  const [advanced, setAdvanced] = useState(false);
  const [partLays, setPartLays] = useState<PartLay[]>([]);
  const [layStakeOverride, setLayStakeOverride] = useState<number | null>(null);

  useEffect(() => {
    if (!exchange && defaultExchange) {
      queueMicrotask(() => {
        setExchange(defaultExchange);
        setCommission(defaultExchange.commissionPct);
      });
    }
  }, [defaultExchange, exchange]);

  useEffect(() => {
    if (!open || !prefill) return;
    queueMicrotask(() => {
    if (prefill.mode) setMode(prefill.mode);
    if (prefill.bookmaker) setBookmaker(prefill.bookmaker);
    if (prefill.backStake !== undefined) setBackStake(prefill.backStake);
    if (prefill.backOdds !== undefined) setBackOdds(prefill.backOdds);
    if (prefill.layOdds !== undefined) setLayOdds(prefill.layOdds);
    if (prefill.advanced !== undefined) setAdvanced(prefill.advanced);
    if (prefill.partLays) setPartLays(prefill.partLays);
    if (prefill.layStakeOverride !== undefined) setLayStakeOverride(prefill.layStakeOverride);
    if (prefill.refundAmount !== undefined) setRefundAmount(prefill.refundAmount);
    if (prefill.refundRetention !== undefined) setRefundRetention(prefill.refundRetention);

    if (prefill.exchangeId !== undefined) {
      const ex = exchanges.find((e) => e.id === prefill.exchangeId);
      if (ex) {
        setExchange(ex);
        if (prefill.commission === undefined) setCommission(ex.commissionPct);
      }
    }
    if (prefill.commission !== undefined) setCommission(prefill.commission);
    });
  }, [open, prefill, exchanges]);

  // Adjust-during-render: bonus stake ceilings mirror the back stake.
  const [prevBonusInputs, setPrevBonusInputs] = useState({ backStake, bonusKind });
  if (prevBonusInputs.backStake !== backStake || prevBonusInputs.bonusKind !== bonusKind) {
    setPrevBonusInputs({ backStake, bonusKind });
    setBonusMaxStake(backStake);
    if (bonusKind === "free_bet_on_win" || bonusKind === "free_bet_on_lose" ||
        bonusKind === "bonus_cash_on_win" || bonusKind === "bonus_cash_on_lose") {
      setBonusAmount((a) => (a === 10 || !Number.isFinite(a) ? backStake : a));
    }
  }

  const specialBonus: SpecialBonus | undefined = useMemo(() => {
    if (mode !== "qualifying" || bonusKind === "none") return undefined;
    const base: SpecialBonus = { kind: bonusKind };
    if (bonusKind === "double_winnings" || bonusKind === "double_return") {
      base.maxStake = bonusMaxStake > 0 ? bonusMaxStake : backStake;
      if (Number.isFinite(bonusMaxReturn) && bonusMaxReturn > 0) base.maxReturn = bonusMaxReturn;
    } else {
      base.amount = bonusAmount > 0 ? bonusAmount : 0;
      if (bonusKind === "free_bet_on_win" || bonusKind === "free_bet_on_lose") {
        base.freeBetRetention = bonusFbRetention / 100;
      }
    }
    return base;
  }, [mode, bonusKind, bonusAmount, bonusMaxStake, bonusMaxReturn, bonusFbRetention, backStake]);

  const planInput = useMemo(() => {
    if (!(backStake > 0 && backOdds > 1 && layOdds > 1)) return null;
    return {
      mode,
      backStake,
      backOdds,
      layOdds,
      commission: commission / 100,
      partLays: advanced ? partLays.filter((p) => p.odds > 1 && p.stake > 0) : [],
      refundAmount,
      refundRetention: refundRetention / 100,
      specialBonus,
    };
  }, [
    mode,
    backStake,
    backOdds,
    layOdds,
    commission,
    advanced,
    partLays,
    refundAmount,
    refundRetention,
    specialBonus,
  ]);

  const bounds = useMemo(() => (planInput ? layBounds(planInput) : null), [planInput]);

  const layStake = useMemo(() => {
    if (!planInput) return 0;
    const override = advanced && layStakeOverride != null ? layStakeOverride : null;
    return executableLayStake(planInput, override);
  }, [planInput, advanced, layStakeOverride]);

  const result = useMemo(
    () => (planInput ? layPlanOutcome({ ...planInput, layStake }) : null),
    [planInput, layStake]
  );

  const bonusExtras = useMemo(
    () => specialBonusExtras(backStake, backOdds, specialBonus),
    [backStake, backOdds, specialBonus]
  );

  const rows = useMemo(() => {
    if (!result) return [];
    return [
      {
        label: "If back (bookie) bet wins",
        bookie: result.ifBackWins.bookie,
        exchange: result.ifBackWins.exchange,
        accent: "back" as const,
      },
      {
        label: "If lay (exchange) bet wins",
        bookie: result.ifBackLoses.bookie,
        exchange: result.ifBackLoses.exchange,
        accent: "lay" as const,
      },
    ];
  }, [result]);

  const showBonus = mode === "qualifying";

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="rounded-xl border bg-card p-4">
        <div className={cn("grid gap-3", showBonus ? "sm:grid-cols-2" : "grid-cols-1")}>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Bet type</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as BetMode)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(modeLabels) as BetMode[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {modeLabels[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{modeHints[mode]}</p>
          </div>
          {showBonus ? (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Special bonus</Label>
              <Select
                value={bonusKind}
                onValueChange={(v) => setBonusKind(v as SpecialBonusKind)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BONUS_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {SPECIAL_BONUS_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{SPECIAL_BONUS_HINTS[bonusKind]}</p>
            </div>
          ) : null}
        </div>
        {showBonus && (bonusKind === "double_winnings" || bonusKind === "double_return") ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <PanelInput
              label="Max stake for offer"
              prefix="£"
              value={bonusMaxStake}
              onChange={setBonusMaxStake}
              min={0}
            />
            <PanelInput
              label="Max extra payout (optional)"
              prefix="£"
              value={bonusMaxReturn}
              onChange={setBonusMaxReturn}
              min={0}
            />
          </div>
        ) : null}
        {showBonus &&
        (bonusKind === "free_bet_on_win" || bonusKind === "free_bet_on_lose") ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <PanelInput
              label="Free bet value"
              prefix="£"
              value={bonusAmount}
              onChange={setBonusAmount}
              min={0}
            />
            <PanelInput
              label="FB retention"
              suffix="%"
              value={bonusFbRetention}
              onChange={setBonusFbRetention}
              min={0}
              step={5}
            />
          </div>
        ) : null}
        {showBonus &&
        (bonusKind === "bonus_cash_on_win" || bonusKind === "bonus_cash_on_lose") ? (
          <div className="mt-3">
            <PanelInput
              label="Bonus amount"
              prefix="£"
              value={bonusAmount}
              onChange={setBonusAmount}
              min={0}
            />
          </div>
        ) : null}
        {showBonus &&
        bonusKind !== "none" &&
        (bonusExtras.onWin > 0 || bonusExtras.onLose > 0) ? (
          <p className="mt-3 text-xs font-medium text-muted-foreground">
            Bonus value in calc:{" "}
            {bonusExtras.onWin > 0 && (
              <span className="text-foreground">+£{bonusExtras.onWin.toFixed(2)} on win</span>
            )}
            {bonusExtras.onWin > 0 && bonusExtras.onLose > 0 && " · "}
            {bonusExtras.onLose > 0 && (
              <span className="text-foreground">+£{bonusExtras.onLose.toFixed(2)} on lose</span>
            )}
          </p>
        ) : null}
      </div>

      <BackPanel title="Back Bet" exchange={exchange}>
        <div className="grid grid-cols-2 gap-3">
          <PanelBookieInput
            value={bookmaker}
            onChange={setBookmaker}
            className="col-span-2 sm:col-span-1"
          />
          <PanelInput label="Back stake" prefix="£" value={backStake} onChange={setBackStake} min={0} />
          <PanelInput label="Back odds (decimal)" value={backOdds} onChange={setBackOdds} min={1} />
          {mode === "risk_free" && (
            <>
              <PanelInput label="Refund amount" prefix="£" value={refundAmount} onChange={setRefundAmount} min={0} />
              <PanelInput
                label="Refund retention"
                suffix="%"
                value={refundRetention}
                onChange={setRefundRetention}
                min={0}
                step={5}
              />
            </>
          )}
        </div>
      </BackPanel>

      <LayPanel
        title="Lay Bet"
        exchange={exchange}
        chip={
          <span className="flex items-center gap-3">
            {exchange && (
              <span
                className="rounded px-2 py-0.5 text-[10px] font-bold"
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
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <ExchangeSelect
              onPanel
              exchanges={exchanges}
              value={exchange}
              onChange={(ex) => {
                setExchange(ex);
                setCommission(ex.commissionPct);
                toast.info(`${ex.name} selected`, { description: `Commission set to ${ex.commissionPct}%` });
              }}
            />
          </div>
          <PanelInput
            label="Lay odds (decimal)"
            value={layOdds}
            onChange={setLayOdds}
            min={1}
            exchangeOddsStepping
          />
          <PanelInput
            label="Lay commission"
            suffix="%"
            value={commission}
            onChange={setCommission}
            min={0}
            step={0.5}
          />
        </div>
        {advanced && bounds && (
          <AdvancedLaySection
            bounds={bounds}
            layStake={layStake}
            onLayStake={setLayStakeOverride}
            partLays={partLays}
            onPartLays={setPartLays}
            accent={exchange?.brandColor ?? "#1e293b"}
          />
        )}
        <LayStakeBanner value={layStake} liability={result?.totalLiability} fillSelection={bookmaker ? `Lay vs ${bookmaker}` : "Matched lay"} />
      </LayPanel>

      <ProfitTable
        rows={rows}
        guaranteed={result?.guaranteed ?? 0}
        exchange={exchange}
        totalLabel={mode === "qualifying" && bonusKind === "none" ? "Qualifying loss" : "Total profit"}
      />

      {(mode === "free_snr" || mode === "free_sr") && result && (
        <div className="text-center text-xs text-muted-foreground">
          Free bet retention:{" "}
          <span className="font-semibold text-foreground">
            <PercentFlow value={(result.guaranteed / backStake) * 100} digits={1} />
          </span>{" "}
          of face value.
        </div>
      )}

      <CalculatorAddBetButton
        disabled={!result}
        className="self-center px-8"
        prefill={{
          labelSuggestion: `${bookmaker ? bookmaker + " " : ""}${
            bonusKind !== "none" ? SPECIAL_BONUS_LABELS[bonusKind] : modeLabels[mode]
          } @ ${backOdds}`,
          betType: mode,
          backStake,
          backOdds,
          layOdds,
          layStake: result?.totalLayStake,
          exchangeId: exchange?.id,
          advanced,
          partLays,
          layStakeOverride,
          bookmaker: bookmaker || undefined,
          expectedProfit: result ? Number(result.guaranteed.toFixed(2)) : undefined,
        }}
      />

      <EdgePanel backOdds={backOdds} layOdds={layOdds} stake={backStake} />
    </div>
  );
}
