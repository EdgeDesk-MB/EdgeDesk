"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BackPanel,
  LayPanel,
  LayStakeBanner,
  PanelInput,
  PanelSelect,
  PanelTextInput,
  ProfitTable,
} from "@/components/calc/bet-panels";
import { BookmakerSelect } from "@/components/calc/bookmaker-select";
import { CalculatorAddBetButton } from "@/components/calc/calculator-add-bet";
import { ExchangeSelect } from "@/components/calc/exchange-select";
import type { EachWayCalculatorPrefill } from "@/components/each-way-calculator-provider";
import { PlaceZoneBar } from "@/components/racing/place-zone-bar";
import { MoneyFlow, NumFlow } from "@/components/money-flow";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useExchanges } from "@/hooks/use-exchanges";
import { serializeEwMeta, type EachWayBetMeta } from "@/lib/bets/ew-meta";
import { eachWay, extraPlace } from "@/lib/calc";
import { estimateLayPlaceOdds } from "@/lib/calc/estimate-lay-place-odds";
import { placePositions } from "@/lib/racing";
import { extraPlaceMinRunnersWarning } from "@/lib/racing/extra-place-min-runners";
import { ukPlaceTerms } from "@/lib/racing/place-terms";
import type { ExchangeRow } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export { estimateLayPlaceOdds };

const placeTerms = [
  { value: "0.25", label: "1/4 odds" },
  { value: "0.2", label: "1/5 odds" },
];

const placeCountOptions = [2, 3, 4, 5, 6, 7, 8];

export type EachWayCalcMode = "each_way" | "extra_place";

export function EachWayCalculatorForm({
  prefill,
  open = true,
  embedded = false,
  onSaved,
}: {
  prefill?: EachWayCalculatorPrefill;
  open?: boolean;
  embedded?: boolean;
  onSaved?: (betId: number) => void;
}) {
  const { exchanges, defaultExchange } = useExchanges();
  const [exchange, setExchange] = useState<ExchangeRow | null>(null);
  const [mode, setMode] = useState<EachWayCalcMode>("each_way");
  const [bookmaker, setBookmaker] = useState("");
  const [selection, setSelection] = useState("");
  const [stake, setStake] = useState(10);
  const [winOdds, setWinOdds] = useState(9);
  const [placeFraction, setPlaceFraction] = useState("0.2");
  const [layWinOdds, setLayWinOdds] = useState(9.6);
  const [layPlaceOdds, setLayPlaceOdds] = useState(2.8);
  const [layWinStakeOverride, setLayWinStakeOverride] = useState<number | null>(null);
  const [layPlaceStakeOverride, setLayPlaceStakeOverride] = useState<number | null>(null);
  const [fieldSize, setFieldSize] = useState(12);
  const [exchangePlaces, setExchangePlaces] = useState(3);
  const [bookiePlaces, setBookiePlaces] = useState(4);
  const [raceLink, setRaceLink] = useState<{
    eventId?: number;
    raceExternalId?: string;
    raceEventDate?: string;
    homeTeam?: string;
    awayTeam?: string;
    labelSuggestion?: string;
    offerId?: number;
  }>({});

  useEffect(() => {
    if (!exchange && defaultExchange) {
      queueMicrotask(() => {
        setExchange(defaultExchange);
      });
    }
  }, [defaultExchange, exchange]);

  const commissionPct = exchange?.commissionPct ?? 2;

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      const nextMode: EachWayCalcMode =
        prefill?.mode === "extra_place" ? "extra_place" : "each_way";
      const nextWin =
        prefill?.winOdds != null && prefill.winOdds > 1 ? prefill.winOdds : undefined;
      const nextFraction =
        prefill?.placeFraction === 0.25 || prefill?.placeFraction === 0.2
          ? prefill.placeFraction
          : undefined;
      const nextField =
        prefill?.fieldSize != null && prefill.fieldSize >= 2 ? prefill.fieldSize : undefined;

      if (prefill?.mode) setMode(nextMode);
      if (prefill?.bookmaker != null) setBookmaker(prefill.bookmaker);
      if (prefill?.selection != null) setSelection(prefill.selection);
      if (prefill?.stakePerPart != null && prefill.stakePerPart > 0) {
        setStake(prefill.stakePerPart);
      }
      if (nextWin != null) setWinOdds(nextWin);
      if (nextFraction != null) setPlaceFraction(String(nextFraction));
      if (prefill?.layWinOdds != null && prefill.layWinOdds > 1) {
        setLayWinOdds(prefill.layWinOdds);
      } else if (nextWin != null) {
        setLayWinOdds(Math.round(nextWin * 1.03 * 100) / 100);
      }
      const frac = nextFraction ?? (parseFloat(placeFraction) || 0.2);
      if (prefill?.layPlaceOdds != null && prefill.layPlaceOdds > 1) {
        setLayPlaceOdds(prefill.layPlaceOdds);
      } else if (nextWin != null) {
        setLayPlaceOdds(estimateLayPlaceOdds(nextWin, frac));
      }
      if (nextField != null) setFieldSize(nextField);

      const terms = ukPlaceTerms(nextField ?? fieldSize);
      const exPlaces =
        prefill?.exchangePlaces != null && prefill.exchangePlaces >= 1
          ? prefill.exchangePlaces
          : terms.places || placePositions(nextField ?? fieldSize);
      setExchangePlaces(exPlaces);
      if (
        prefill?.placeFraction == null &&
        terms.placeFraction != null &&
        nextFraction == null
      ) {
        setPlaceFraction(String(terms.placeFraction));
      }
      if (prefill?.bookiePlaces != null && prefill.bookiePlaces > exPlaces) {
        setBookiePlaces(prefill.bookiePlaces);
      } else if (nextMode === "extra_place") {
        setBookiePlaces(exPlaces + 1);
      } else {
        setBookiePlaces(exPlaces);
      }

      setRaceLink({
        eventId: prefill?.eventId,
        raceExternalId: prefill?.raceExternalId,
        raceEventDate: prefill?.raceEventDate,
        homeTeam: prefill?.homeTeam,
        awayTeam: prefill?.awayTeam,
        labelSuggestion: prefill?.labelSuggestion,
        offerId: prefill?.offerId,
      });

      if (prefill?.exchangeId !== undefined) {
        const ex = exchanges.find((e) => e.id === prefill.exchangeId);
        if (ex) setExchange(ex);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill, exchanges]);

  useEffect(() => {
    if (!open || prefill) return;
    const terms = ukPlaceTerms(fieldSize);
    queueMicrotask(() => {
      setExchangePlaces(terms.places);
      if (terms.placeFraction != null) setPlaceFraction(String(terms.placeFraction));
      if (mode === "extra_place") {
        setBookiePlaces((prev) =>
          prev <= terms.places ? terms.places + 1 : prev
        );
      }
    });
  }, [fieldSize, mode, open, prefill]);

  const minRunnersWarning =
    mode === "extra_place"
      ? extraPlaceMinRunnersWarning(fieldSize, bookiePlaces, bookmaker)
      : null;

  const fraction = parseFloat(placeFraction);
  const c = commissionPct / 100;

  useEffect(() => {
    queueMicrotask(() => {
      setLayWinStakeOverride(null);
      setLayPlaceStakeOverride(null);
    });
  }, [stake, winOdds, fraction, layWinOdds, layPlaceOdds, c]);

  const standardResult = useMemo(() => {
    if (!(stake > 0 && winOdds > 1 && layWinOdds > 1 && layPlaceOdds > 1)) return null;
    return eachWay({
      stake,
      winOdds,
      placeFraction: fraction,
      layWinOdds,
      layPlaceOdds,
      commission: c,
      layWinStakeOverride: layWinStakeOverride ?? undefined,
      layPlaceStakeOverride: layPlaceStakeOverride ?? undefined,
    });
  }, [stake, winOdds, fraction, layWinOdds, layPlaceOdds, c, layWinStakeOverride, layPlaceStakeOverride]);

  const extraResult = useMemo(() => {
    if (!(stake > 0 && winOdds > 1 && layWinOdds > 1 && layPlaceOdds > 1)) return null;
    if (bookiePlaces <= exchangePlaces) return null;
    return extraPlace({
      stakePerPart: stake,
      winOdds,
      placeFraction: fraction,
      layWinOdds,
      layPlaceOdds,
      commission: c,
      bookiePlaces,
      exchangePlaces,
      layWinStakeOverride: layWinStakeOverride ?? undefined,
      layPlaceStakeOverride: layPlaceStakeOverride ?? undefined,
    });
  }, [
    stake,
    winOdds,
    fraction,
    layWinOdds,
    layPlaceOdds,
    c,
    bookiePlaces,
    exchangePlaces,
    layWinStakeOverride,
    layPlaceStakeOverride,
  ]);

  const active = mode === "extra_place" ? extraResult : standardResult;
  const layWinStake = active?.layWinStake ?? 0;
  const layPlaceStake = active?.layPlaceStake ?? 0;
  const totalLayStake = layWinStake + layPlaceStake;
  const totalLiability =
    (active?.layWinLiability ?? 0) + (active?.layPlaceLiability ?? 0);

  const rows = useMemo(() => {
    if (mode === "extra_place" && extraResult) {
      return extraResult.outcomes.map((o) => ({
        label: o.label,
        bookie: o.bookie,
        exchange: o.exchange,
        accent: o.highlight
          ? ("back" as const)
          : o.key === "unplaced"
            ? ("lay" as const)
            : ("back" as const),
      }));
    }
    if (!standardResult) return [];
    const layWinWinnings = standardResult.layWinStake * (1 - c);
    const layPlaceWinnings = standardResult.layPlaceStake * (1 - c);
    return [
      {
        label: "Horse wins",
        bookie: stake * (winOdds - 1) + stake * (standardResult.placeOdds - 1),
        exchange: -standardResult.layWinLiability - standardResult.layPlaceLiability,
        accent: "back" as const,
      },
      {
        label: "Places only",
        bookie: -stake + stake * (standardResult.placeOdds - 1),
        exchange: layWinWinnings - standardResult.layPlaceLiability,
        accent: "back" as const,
      },
      {
        label: "Unplaced",
        bookie: -2 * stake,
        exchange: layWinWinnings + layPlaceWinnings,
        accent: "lay" as const,
      },
    ];
  }, [mode, extraResult, standardResult, stake, winOdds, c]);

  const guaranteed = active?.worstCase ?? 0;

  function buildEwMeta(): EachWayBetMeta | null {
    if (!active) return null;
    return {
      stakePerPart: stake,
      placeFraction: fraction,
      layWin: { stake: layWinStake, odds: layWinOdds },
      layPlace: { stake: layPlaceStake, odds: layPlaceOdds },
      bookiePlaces: mode === "extra_place" ? bookiePlaces : exchangePlaces,
      exchangePlaces,
      mode,
    };
  }

  const ewMeta = buildEwMeta();
  const placeLabel = placeFraction === "0.25" ? "4" : "5";
  const defaultLabel =
    mode === "extra_place"
      ? `${bookmaker ? bookmaker + " " : ""}${selection ? selection + " · " : ""}Extra place ${bookiePlaces}p @ ${winOdds} (ex ${exchangePlaces}p)`
      : `${bookmaker ? bookmaker + " " : ""}${selection ? selection + " · " : ""}Each way @ ${winOdds} (1/${placeLabel} place)`;

  return (
    <div className={cn("flex flex-col gap-4", embedded && "gap-3")}>
      <Tabs value={mode} onValueChange={(v) => setMode(v as EachWayCalcMode)}>
        <TabsList>
          <TabsTrigger value="each_way">Each way</TabsTrigger>
          <TabsTrigger value="extra_place">Extra place</TabsTrigger>
        </TabsList>
      </Tabs>

      {(selection || raceLink.homeTeam) && (
        <p className="text-xs text-muted-foreground">
          {[raceLink.homeTeam, raceLink.awayTeam, selection].filter(Boolean).join(" · ")}
          {raceLink.raceEventDate ? ` · ${raceLink.raceEventDate}` : ""}
        </p>
      )}

      <BackPanel
        title="Back Bet"
        exchange={exchange}
        venue={bookmaker}
        chip={
          <BookmakerSelect
            tagTrigger
            value={bookmaker}
            onChange={setBookmaker}
            className="[--pi:var(--panel)] [--pi-dark:var(--panel-dark)]"
          />
        }
      >
        {embedded && (
          <PanelTextInput
            label="Selection"
            value={selection}
            onChange={setSelection}
            placeholder="Horse name"
          />
        )}
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <PanelInput label="Win odds" value={winOdds} onChange={setWinOdds} min={1} />
          <PanelInput label="EW stake (per part)" prefix="£" value={stake} onChange={setStake} min={0} />
          <PanelSelect label="Place terms" value={placeFraction} onChange={setPlaceFraction}>
            {placeTerms.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </PanelSelect>
          {(mode === "extra_place" || embedded) && (
            <>
              <PanelInput
                label="Runners (field size)"
                value={fieldSize}
                onChange={setFieldSize}
                min={2}
              />
              <PanelSelect
                label="Exchange pays (places)"
                value={String(exchangePlaces)}
                onChange={(v) => setExchangePlaces(parseInt(v, 10))}
              >
                {placeCountOptions.map((n) => (
                  <option key={n} value={n}>
                    {n} places
                  </option>
                ))}
              </PanelSelect>
              {mode === "extra_place" && (
                <PanelSelect
                  label="Bookie pays (places)"
                  value={String(bookiePlaces)}
                  onChange={(v) => setBookiePlaces(parseInt(v, 10))}
                >
                  {placeCountOptions
                    .filter((n) => n > exchangePlaces)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n} places
                      </option>
                    ))}
                </PanelSelect>
              )}
            </>
          )}
        </div>
        <div className="text-xs text-black/60 dark:text-white/60">
          £{Number.isFinite(stake) ? stake : 0} EW costs{" "}
          <MoneyFlow value={(Number.isFinite(stake) ? stake : 0) * 2} className="font-semibold" />{" "}
          total · derived place odds{" "}
          <span className="font-semibold">
            <NumFlow value={active?.placeOdds ?? 0} />
          </span>
        </div>
        {mode === "extra_place" && (
          <PlaceZoneBar
            exchangePlaces={exchangePlaces}
            bookiePlaces={bookiePlaces}
            className="mt-1"
          />
        )}
        {minRunnersWarning && (
          <p className="text-xs text-amber-700 dark:text-amber-300">{minRunnersWarning}</p>
        )}
        {mode === "extra_place" && extraResult && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">
              Qualifying loss{" "}
              <MoneyFlow value={extraResult.qualifyingLoss} className="font-semibold" />
            </Badge>
            {extraResult.impliedExtraPlaceOdds != null && (
              <Badge variant="outline">
                Implied extra-place odds{" "}
                <NumFlow
                  value={extraResult.impliedExtraPlaceOdds}
                  digits={1}
                  className="font-semibold"
                />
              </Badge>
            )}
            <span className="text-muted-foreground">
              Profit if extra place{" "}
              <MoneyFlow
                value={extraResult.profitIfExtraPlace}
                className="font-semibold text-profit"
              />
            </span>
          </div>
        )}
      </BackPanel>

      <LayPanel
        title="Lay Bet"
        exchange={exchange}
        chip={
          <ExchangeSelect
            compact
            tagTrigger
            exchanges={exchanges}
            value={exchange}
            onChange={setExchange}
          />
        }
      >
        <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          <PanelInput
            label="Lay WIN odds"
            value={layWinOdds}
            onChange={setLayWinOdds}
            min={1}
            exchangeOddsStepping
          />
          <LayStakeBanner
            label="Lay WIN stake"
            value={layWinStake}
            liability={active?.layWinLiability}
            pending={!active}
            onChange={(v) =>
              setLayWinStakeOverride(Number.isFinite(v) && v >= 0 ? v : null)
            }
          />
          <PanelInput
            label="Lay PLACE odds"
            value={layPlaceOdds}
            onChange={setLayPlaceOdds}
            min={1}
            exchangeOddsStepping
          />
          <LayStakeBanner
            label="Lay PLACE stake"
            value={layPlaceStake}
            liability={active?.layPlaceLiability}
            pending={!active}
            onChange={(v) =>
              setLayPlaceStakeOverride(Number.isFinite(v) && v >= 0 ? v : null)
            }
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Place lay is manual until the desk has live PLACE prices. Confirm against the exchange
          before filling the slip.
        </p>
      </LayPanel>

      <ProfitTable
        rows={rows}
        guaranteed={guaranteed}
        exchange={exchange}
        venue={bookmaker}
        totalLabel="Worst case"
      />

      <CalculatorAddBetButton
        disabled={!active || !ewMeta}
        className="self-center px-8"
        onSaved={onSaved}
        prefill={{
          labelSuggestion: raceLink.labelSuggestion ?? defaultLabel,
          betType: "qualifying",
          backStake: stake * 2,
          backOdds: winOdds,
          layOdds: layWinOdds,
          layStake: totalLayStake,
          exchangeId: exchange?.id,
          bookmaker: bookmaker || undefined,
          sport: "horse_racing",
          market: mode === "extra_place" ? "extra_place" : "each_way",
          selection: selection || undefined,
          homeTeam: raceLink.homeTeam,
          awayTeam: raceLink.awayTeam,
          eventId: raceLink.eventId,
          raceExternalId: raceLink.raceExternalId,
          raceEventDate: raceLink.raceEventDate,
          offerId: raceLink.offerId,
          expectedProfit: Number(guaranteed.toFixed(2)),
          notes: ewMeta ? serializeEwMeta(ewMeta) : undefined,
        }}
      />
      <p className="text-center text-xs text-muted-foreground">
        Win + place lays (£{totalLayStake.toFixed(2)}, liability £{totalLiability.toFixed(2)}) saved
        to the tracker for auto-settlement when the race result is recorded.
      </p>
    </div>
  );
}
