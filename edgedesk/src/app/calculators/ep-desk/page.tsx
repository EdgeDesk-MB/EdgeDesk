"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookieChip } from "@/components/calc/bookie-chip";
import { ExchangeSelect } from "@/components/calc/exchange-select";
import { PageShell } from "@/components/page-shell";
import { DeskPageHeader } from "@/components/layout/desk-page-header";
import { pageSecondaryButtonProps } from "@/components/layout/page-header-actions";
import { api } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import {
  dutchDist,
  dutchPL,
  effectiveTriggers,
  epDecompose,
  epProbsW,
  equalizedStakes,
  fitModel,
  layPlay,
  laySidePL,
  liveResult,
  roundStake,
  scenariosW,
  scoreGrid,
  stripMargin,
  type StakeMode,
} from "@/lib/calc/ep/engine";
import { exchangeOddsStepHandlers } from "@/lib/calc/exchange-odds-step";
import type { ExchangeRow } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { Flag, Flame, X } from "lucide-react";

/* ------------------------------- formatting ------------------------------- */
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : "—");
const f3 = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : "—");
const pct = (x: number, dp = 1) => (Number.isFinite(x) ? `${(x * 100).toFixed(dp)}%` : "—");
const gbp = (x: number) =>
  `${x < 0 ? "−" : "+"}£${Math.abs(x).toFixed(2)}`;

/* ------------------------------- persisted state ------------------------------- */

interface DeskState {
  homeTeam: string;
  awayTeam: string;
  oHomeWin: number;
  oDraw: number;
  oAwayWin: number;
  oLayH: number;
  oLayA: number;
  oComm: number;
  oOver: number | "";
  oBtts: number | "";
  oH2: number;
  bkH2: string;
  oH1: number;
  bkH1: string;
  oA2: number;
  bkA2: string;
  oA1: number;
  bkA1: string;
  stakeMode: StakeMode;
  stakeAmt: number;
  rounding: number;
}

const DEFAULTS: DeskState = {
  homeTeam: "Mexico",
  awayTeam: "England",
  oHomeWin: 3.2,
  oDraw: 3.15,
  oAwayWin: 2.65,
  oLayH: 3.25,
  oLayA: 3.2,
  oComm: 0,
  oOver: 2.65,
  oBtts: 2.05,
  oH2: 3.0,
  bkH2: "PubCasino",
  oH1: 1.9,
  bkH1: "Betano",
  oA2: 2.5,
  bkA2: "BWIN",
  oA1: 1.7,
  bkA1: "Betano",
  stakeMode: "total",
  stakeAmt: 100,
  rounding: 0.01,
};

const STORAGE_KEY = "edgedesk.epdesk.v1";
const PLAYBOOK_KEY = "edgedesk.epdesk.playbook.v1";

function loadState(): DeskState {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

/* ------------------------------- playbook (§10) ------------------------------- */

const PLAYBOOK = [
  {
    section: "P1 · Go/No-Go",
    items: [
      "EP odds ≥ the desk's fair figure (offered ≥ fair = +EV)",
      "EP price ≈ the straight/exchange win price (a promo, not a priced-down market)",
      "Book runs a genuine early-payout promotion",
    ],
  },
  {
    section: "P2 · Match profile — the amplifier",
    items: [
      "Over 2.5 Yes ≤ 1.50 (ideal ≤ 1.40) — high scoring, leads get built",
      "BTTS Yes ≤ 1.55 (ideal ≤ 1.45) — both score, leads get surrendered",
      "Total xG ≥ 3.5 (desk readout)",
      "Favourite priced 1.70–2.30 (sweet ~2.0)",
    ],
  },
  {
    section: "P3 · Refinements",
    items: [
      "2UP over 1UP",
      "Moderate favourite, not a blowout",
      "Goal-friendly league (Bundesliga, Eredivisie, open cups/internationals)",
      "Exchange lay liquidity OK",
    ],
  },
  {
    section: "Red flags (skip)",
    items: [
      "Backed team < 1.50 (blowout, no bonus)",
      "Backed team > 2.60 (won't reach a 2-goal lead)",
      "Over 2.5 > 1.80 or BTTS > 1.80 (low scoring, ~1% bonus)",
      "EP shorter than the straight price (shortened market)",
    ],
  },
];

/* ================================= page ================================= */

export default function EpDeskPage() {
  const { exchanges, defaultExchange } = useExchanges();
  const [exchange, setExchange] = useState<ExchangeRow | null>(null);
  const [s, setS] = useState<DeskState>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const [playbookOpen, setPlaybookOpen] = useState(false);

  // Live tab state (not persisted)
  const [hg, setHg] = useState(0);
  const [ag, setAg] = useState(0);
  const [mH1, setMH1] = useState(false);
  const [mH2, setMH2] = useState(false);
  const [mA1, setMA1] = useState(false);
  const [mA2, setMA2] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setS(loadState());
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }, [s, hydrated]);

  useEffect(() => {
    if (!exchange && defaultExchange) {
      queueMicrotask(() => {
        setExchange(defaultExchange);
        setS((prev) => ({ ...prev, oComm: defaultExchange.commissionPct }));
      });
    }
  }, [defaultExchange, exchange]);

  const set = <K extends keyof DeskState>(key: K, value: DeskState[K]) =>
    setS((prev) => ({ ...prev, [key]: value }));

  // Heavy model fit — deferred so typing stays snappy
  const deferred = useDeferredValue(s);
  const R = useMemo(() => compute(deferred), [deferred]);

  const trig = effectiveTriggers(hg, ag, mH1, mH2, mA1, mA2);
  const result = liveResult(hg, ag);

  async function trackDutch(threshold: 2 | 1) {
    if (!R) return;
    const d = threshold === 2 ? R.dutch2 : R.dutch1;
    const oH = threshold === 2 ? s.oH2 : s.oH1;
    const oA = threshold === 2 ? s.oA2 : s.oA1;
    const bkH = threshold === 2 ? s.bkH2 : s.bkH1;
    const bkA = threshold === 2 ? s.bkA2 : s.bkA1;
    try {
      // Find-or-create the match event so the bet is live-tracked from the start
      const tracked = await api<{ event: { id: number }; mode: "existing" | "api" | "manual" }>(
        "/api/events/track",
        { method: "POST", json: { homeTeam: s.homeTeam, awayTeam: s.awayTeam } }
      );
      await api("/api/bets", {
        method: "POST",
        json: {
          eventId: tracked.event.id,
          label: `${threshold}UP dutch: ${s.homeTeam} / ${s.awayTeam}`,
          market: "match_odds",
          betType: "dutch",
          backStake: d.stakes.SH + d.stakes.SA + d.stakes.SD,
          legs: [
            { label: `${s.homeTeam} ${threshold}UP @ ${bkH}`, market: "match_odds", selection: "home", odds: oH, stake: d.stakes.SH, earlyPayout: true },
            { label: `${s.awayTeam} ${threshold}UP @ ${bkA}`, market: "match_odds", selection: "away", odds: oA, stake: d.stakes.SA, earlyPayout: true },
            { label: `Draw @ ${exchange?.name ?? "exchange"}`, market: "match_odds", selection: "draw", odds: s.oDraw, stake: d.stakes.SD },
          ],
          expectedProfit: Number(d.dist.EV.toFixed(2)),
          notes: `EP Desk ${threshold}UP dutch · EV ${gbp(d.dist.EV)}`,
        },
      });
      const modeMessage = {
        existing: "linked to the event you're already tracking",
        api: "match imported from API-Football — live scores will settle it automatically",
        manual: "manual event created — update the score on Tracked Events (or add an API key for live tracking)",
      }[tracked.mode];
      toast.success(`${threshold}UP dutch added & tracking ${s.homeTeam} v ${s.awayTeam}`, {
        description: modeMessage,
      });
    } catch (e) {
      toast.error("Could not save bet", { description: String(e) });
    }
  }

  return (
    <PageShell>
      <DeskPageHeader
        bordered={false}
        title={`${s.homeTeam || "Home"} v ${s.awayTeam || "Away"}`}
        description="EP Desk — Dixon-Coles model, trigger probabilities and live settlement."
        action={
          <Button variant="outline" {...pageSecondaryButtonProps} onClick={() => setPlaybookOpen(true)}>
            <Flag className="size-4" /> Scouting Playbook
          </Button>
        }
      />

      {R && <VerdictBanner R={R} s={s} />}

      <InputMatrix s={s} set={set} exchanges={exchanges} exchange={exchange} onExchange={(ex) => {
        setExchange(ex);
        set("oComm", ex.commissionPct);
      }} />

      {R && <ModelReadout R={R} s={s} />}

      {R && (
        <Tabs defaultValue="offers">
          <TabsList>
            <TabsTrigger value="offers">① Offers</TabsTrigger>
            <TabsTrigger value="dutch">② Dutch</TabsTrigger>
            <TabsTrigger value="lay">③ Lay sides</TabsTrigger>
            <TabsTrigger value="live">④ Live</TabsTrigger>
          </TabsList>

          <TabsContent value="offers" className="pt-3">
            <OffersTab R={R} s={s} />
          </TabsContent>
          <TabsContent value="dutch" className="pt-3">
            <DutchTab R={R} s={s} onTrack={trackDutch} exchangeName={exchange?.name} />
          </TabsContent>
          <TabsContent value="lay" className="pt-3">
            <LayTab R={R} s={s} exchangeName={exchange?.name} />
          </TabsContent>
          <TabsContent value="live" className="pt-3">
            <LiveTab
              R={R}
              s={s}
              hg={hg}
              ag={ag}
              setHg={setHg}
              setAg={setAg}
              trig={trig}
              result={result}
              manual={{ mH1, mH2, mA1, mA2, setMH1, setMH2, setMA1, setMA2 }}
            />
          </TabsContent>
        </Tabs>
      )}

      <p className="pb-4 text-[11px] leading-relaxed text-muted-foreground">
        Dixon-Coles model (win market + Over 2.5 + BTTS). Chips are brand-coloured monograms, not
        official logos. Edge = offered × P(true) − 1; structure sets variance, not EV. Not betting
        advice — your model, your bankroll.
      </p>

      <PlaybookOverlay open={playbookOpen} onClose={() => setPlaybookOpen(false)} />
    </PageShell>
  );
}

/* ------------------------------- compute ------------------------------- */

interface Offer {
  key: string;
  label: string;
  book: string;
  odds: number;
  pEP: number;
  tW: number;
  decomp: ReturnType<typeof epDecompose>;
  layHedged: number; // evPer1 of the lay-hedged structure
}

function compute(s: DeskState) {
  if (!(s.oHomeWin > 1 && s.oDraw > 1 && s.oAwayWin > 1)) return null;
  const { probs, overround } = stripMargin([s.oHomeWin, s.oDraw, s.oAwayWin]);
  const [tH, tD, tA] = probs;
  const tOV = s.oOver !== "" && s.oOver > 1 ? 1 / s.oOver : null;
  const tBT = s.oBtts !== "" && s.oBtts > 1 ? 1 / s.oBtts : null;
  const fit = fitModel(tH, tD, tA, tOV, tBT);
  const grid = scoreGrid(fit.lh, fit.la, fit.rho, 12);
  const wfn = (nh: number, na: number) => grid[nh]?.[na] ?? 0;
  const ep = epProbsW(wfn);
  const scen = scenariosW(wfn);
  const model = { H: 0, D: 0, A: 0, OV: 0, BT: 0 };
  {
    const M = grid.length - 1;
    for (let i = 0; i <= M; i++)
      for (let j = 0; j <= M; j++) {
        const p = grid[i][j];
        if (i > j) model.H += p;
        else if (i === j) model.D += p;
        else model.A += p;
        if (i + j >= 3) model.OV += p;
        if (i >= 1 && j >= 1) model.BT += p;
      }
  }

  const c = s.oComm / 100;
  const Xh = s.oLayH > 1 ? s.oLayH : s.oHomeWin;
  const Xa = s.oLayA > 1 ? s.oLayA : s.oAwayWin;

  const mkOffer = (key: string, label: string, book: string, odds: number, pEP: number, tW: number, X: number): Offer => ({
    key,
    label,
    book,
    odds,
    pEP,
    tW,
    decomp: epDecompose(odds, pEP, tW),
    layHedged: odds > 1 && X > 1 ? layPlay(1, odds, X, c, pEP, tW).evPer1 : NaN,
  });

  const offers: Offer[] = [
    mkOffer("H2", "Home · 2UP", s.bkH2, s.oH2, ep.pH2, ep.pWinH, Xh),
    mkOffer("H1", "Home · 1UP", s.bkH1, s.oH1, ep.pH1, ep.pWinH, Xh),
    mkOffer("A2", "Away · 2UP", s.bkA2, s.oA2, ep.pA2, ep.pWinA, Xa),
    mkOffer("A1", "Away · 1UP", s.bkA1, s.oA1, ep.pA1, ep.pWinA, Xa),
  ].filter((o) => o.odds > 1);

  const best = offers.reduce<Offer | null>(
    (acc, o) => (acc == null || o.decomp.total > acc.decomp.total ? o : acc),
    null
  );

  const mkDutch = (oH: number, oA: number, threshold: 2 | 1) => {
    const raw = equalizedStakes(oH, oA, s.oDraw, s.stakeMode, s.stakeAmt);
    const stakes = {
      SH: roundStake(raw.SH, s.rounding),
      SA: roundStake(raw.SA, s.rounding),
      SD: roundStake(raw.SD, s.rounding),
    };
    const dist = dutchDist(scen, oH, oA, s.oDraw, stakes.SH, stakes.SA, stakes.SD, threshold);
    return { stakes, dist, oH, oA };
  };
  const dutch2 = mkDutch(s.oH2, s.oA2, 2);
  const dutch1 = mkDutch(s.oH1, s.oA1, 1);

  // Per-side lay plays at the dutch home stake scale (per £ of the offer's back)
  const layH2 = layPlay(dutch2.stakes.SH, s.oH2, Xh, c, ep.pH2, ep.pWinH);
  const layA2 = layPlay(dutch2.stakes.SA, s.oA2, Xa, c, ep.pA2, ep.pWinA);
  const layH1 = layPlay(dutch1.stakes.SH, s.oH1, Xh, c, ep.pH1, ep.pWinH);
  const layA1 = layPlay(dutch1.stakes.SA, s.oA1, Xa, c, ep.pA1, ep.pWinA);

  return {
    true: { tH, tD, tA, tOV, tBT },
    overround,
    fit,
    model,
    ep,
    grid,
    offers,
    best,
    dutch2,
    dutch1,
    layH2,
    layA2,
    layH1,
    layA1,
    Xh,
    Xa,
    c,
  };
}

type Computed = NonNullable<ReturnType<typeof compute>>;

/* ------------------------------- verdict ------------------------------- */

function VerdictBanner({ R, s }: { R: Computed; s: DeskState }) {
  const best = R.best;
  const anyFire = best != null && best.decomp.total > 0;
  const bestDutch = R.dutch2.dist.EV >= R.dutch1.dist.EV ? R.dutch2.dist.EV : R.dutch1.dist.EV;
  return (
    <Card className={cn("border-2", anyFire ? "border-emerald-400/60" : "border-red-300/50 dark:border-red-900/60")}>
      <CardContent className="flex flex-col gap-3 pt-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Best way forward
          </div>
          <div
            className={cn(
              "font-serif text-2xl",
              anyFire ? "text-emerald-600 dark:text-emerald-400" : "text-negative"
            )}
          >
            {anyFire ? (
              <span className="flex items-center gap-2">
                <Flame className="size-5" /> Value found — {best!.label} is +EV
              </span>
            ) : (
              "No edge — pass this match"
            )}
          </div>
          <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
            {best ? (
              <>
                Best is <span className="font-medium text-foreground">{best.label}</span> at{" "}
                <span className="font-mono">{f3(best.odds)}</span> vs fair{" "}
                <span className="font-mono">{f3(best.decomp.fair)}</span> (
                <span className={best.decomp.total >= 0 ? "text-emerald-600" : "text-negative"}>
                  {pct(best.decomp.total)}
                </span>
                ). {anyFire
                  ? "Check lay liquidity before you pull the trigger — see the Lay sides tab."
                  : "See the Offers tab — the EP bonus is real but the bookie's margin is bigger."}
              </>
            ) : (
              "Enter at least one EP offer to score this match."
            )}
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-2">
          <Stat label="Best offer edge" value={best ? pct(best.decomp.total) : "—"} sign={best?.decomp.total} />
          <Stat label="Best dutch (2UP/1UP)" value={gbp(bestDutch)} sign={bestDutch} />
          <Stat label="Nearest to fair" value={best ? f3(best.decomp.fair) : "—"} />
        </div>
      </CardContent>
      {s.stakeAmt <= 0 && (
        <CardContent className="pt-0 text-xs text-red-500">Set a stake amount to size the structures.</CardContent>
      )}
    </Card>
  );
}

function Stat({ label, value, sign }: { label: string; value: string; sign?: number | null }) {
  return (
    <div className="rounded-lg border bg-muted/40 px-3 py-2 text-right">
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "font-mono text-sm font-semibold",
          sign != null && (sign > 0 ? "text-emerald-600" : sign < 0 ? "text-negative" : "")
        )}
      >
        {value}
      </div>
    </div>
  );
}

/* ------------------------------- input matrix (§7.1) ------------------------------- */

function InputMatrix({
  s,
  set,
  exchanges,
  exchange,
  onExchange,
}: {
  s: DeskState;
  set: <K extends keyof DeskState>(key: K, value: DeskState[K]) => void;
  exchanges: ExchangeRow[];
  exchange: ExchangeRow | null;
  onExchange: (ex: ExchangeRow) => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-5">
        {/* Match bar */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Field label="Home team">
            <Input value={s.homeTeam} onChange={(e) => set("homeTeam", e.target.value)} className="h-9" />
          </Field>
          <Field label="Away team">
            <Input value={s.awayTeam} onChange={(e) => set("awayTeam", e.target.value)} className="h-9" />
          </Field>
          <div className="lg:col-span-2">
            <ExchangeSelect exchanges={exchanges} value={exchange} onChange={onExchange} label="Exchange (sets commission)" />
          </div>
          <Field label="Commission %" accent>
            <Num value={s.oComm} onChange={(v) => set("oComm", v)} step={0.5} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Over 2.5">
              <Num value={s.oOver === "" ? NaN : s.oOver} onChange={(v) => set("oOver", Number.isFinite(v) ? v : "")} />
            </Field>
            <Field label="BTTS Yes">
              <Num value={s.oBtts === "" ? NaN : s.oBtts} onChange={(v) => set("oBtts", Number.isFinite(v) ? v : "")} />
            </Field>
          </div>
        </div>

        {/* H/D/A matrix */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="w-24 pb-1 text-left font-medium" />
                <th className="pb-1 text-left font-semibold text-amber-600 dark:text-amber-400">
                  {s.homeTeam || "Home"}
                </th>
                <th className="pb-1 text-left font-semibold text-violet-600 dark:text-violet-400">Draw</th>
                <th className="pb-1 text-left font-semibold text-blue-600 dark:text-blue-400">
                  {s.awayTeam || "Away"}
                </th>
              </tr>
            </thead>
            <tbody className="[&_td]:py-1 [&_td]:pr-2">
              <tr>
                <td className="text-[10px] uppercase tracking-wide text-muted-foreground">Exch back</td>
                <td><Num value={s.oHomeWin} onChange={(v) => set("oHomeWin", v)} /></td>
                <td><Num value={s.oDraw} onChange={(v) => set("oDraw", v)} /></td>
                <td><Num value={s.oAwayWin} onChange={(v) => set("oAwayWin", v)} /></td>
              </tr>
              <tr>
                <td className="text-[10px] uppercase tracking-wide text-muted-foreground">Exch lay</td>
                <td><Num value={s.oLayH} onChange={(v) => set("oLayH", v)} exchangeOddsStepping /></td>
                <td className="text-center text-muted-foreground">—</td>
                <td><Num value={s.oLayA} onChange={(v) => set("oLayA", v)} exchangeOddsStepping /></td>
              </tr>
              <tr>
                <td className="text-[10px] uppercase tracking-wide text-muted-foreground">EP 2UP</td>
                <td><BookOdds book={s.bkH2} odds={s.oH2} onBook={(v) => set("bkH2", v)} onOdds={(v) => set("oH2", v)} /></td>
                <td className="text-center text-muted-foreground">—</td>
                <td><BookOdds book={s.bkA2} odds={s.oA2} onBook={(v) => set("bkA2", v)} onOdds={(v) => set("oA2", v)} /></td>
              </tr>
              <tr>
                <td className="text-[10px] uppercase tracking-wide text-muted-foreground">EP 1UP</td>
                <td><BookOdds book={s.bkH1} odds={s.oH1} onBook={(v) => set("bkH1", v)} onOdds={(v) => set("oH1", v)} /></td>
                <td className="text-center text-muted-foreground">—</td>
                <td><BookOdds book={s.bkA1} odds={s.oA1} onBook={(v) => set("bkA1", v)} onOdds={(v) => set("oA1", v)} /></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Staking bar */}
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Stake basis">
            <Select value={s.stakeMode} onValueChange={(v) => set("stakeMode", v as StakeMode)}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total">Total outlay</SelectItem>
                <SelectItem value="home">Fix home stake</SelectItem>
                <SelectItem value="draw">Fix draw stake</SelectItem>
                <SelectItem value="away">Fix away stake</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Amount £">
            <Num value={s.stakeAmt} onChange={(v) => set("stakeAmt", v)} step={5} wide />
          </Field>
          <Field label="Round to">
            <Select value={String(s.rounding)} onValueChange={(v) => set("rounding", parseFloat(v))}>
              <SelectTrigger className="h-9 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0.01, 0.5, 1, 2, 2.5, 5].map((r) => (
                  <SelectItem key={r} value={String(r)}>
                    £{r.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children, accent }: { label: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.12em]",
          accent ? "text-primary" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Num({
  value,
  onChange,
  step = 0.01,
  wide,
  exchangeOddsStepping,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  wide?: boolean;
  exchangeOddsStepping?: boolean;
}) {
  const exchangeStep = exchangeOddsStepping
    ? exchangeOddsStepHandlers(value, onChange)
    : null;

  return (
    <Input
      type="number"
      inputMode="decimal"
      step={step}
      value={Number.isFinite(value) ? value : ""}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      onKeyDown={exchangeStep?.onKeyDown}
      onWheel={exchangeStep?.onWheel}
      className={cn("h-9 font-mono tabular-nums", wide ? "w-28" : "w-full")}
    />
  );
}

function BookOdds({
  book,
  odds,
  onBook,
  onOdds,
}: {
  book: string;
  odds: number;
  onBook: (v: string) => void;
  onOdds: (v: number) => void;
}) {
  return (
    <div className="flex gap-1.5">
      <Input value={book} onChange={(e) => onBook(e.target.value)} placeholder="Book" className="h-9 min-w-20" />
      <Input
        type="number"
        inputMode="decimal"
        step={0.01}
        value={Number.isFinite(odds) ? odds : ""}
        onChange={(e) => onOdds(parseFloat(e.target.value))}
        className="h-9 w-20 font-mono tabular-nums"
      />
    </div>
  );
}

/* ------------------------------- model readout ------------------------------- */

function Tick({ input, model, tol = 0.005 }: { input: number; model: number; tol?: number }) {
  const ok = Math.abs(input - model) <= tol;
  return (
    <span className={ok ? "text-emerald-500" : "text-amber-500"} title={ok ? "Model matches input" : "Markets disagree — edges on these legs are softer"}>
      {ok ? "✓" : "≈"}
    </span>
  );
}

function ModelReadout({ R, s }: { R: Computed; s: DeskState }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/30 px-4 py-2 font-mono text-[11px] text-muted-foreground">
      <span>
        xG {f2(R.fit.lh)}–{f2(R.fit.la)}
      </span>
      <span>ρ {R.fit.rho.toFixed(2)}</span>
      <span>OR {pct(R.overround, 1)}</span>
      <span>
        H {pct(R.true.tH)} → {pct(R.model.H)} <Tick input={R.true.tH} model={R.model.H} />
      </span>
      <span>
        D {pct(R.true.tD)} → {pct(R.model.D)} <Tick input={R.true.tD} model={R.model.D} />
      </span>
      <span>
        A {pct(R.true.tA)} → {pct(R.model.A)} <Tick input={R.true.tA} model={R.model.A} />
      </span>
      {R.true.tOV != null && (
        <span>
          O2.5 {pct(R.true.tOV)} → {pct(R.model.OV)} <Tick input={R.true.tOV} model={R.model.OV} tol={0.02} />
        </span>
      )}
      {R.true.tBT != null && (
        <span>
          BTTS {pct(R.true.tBT)} → {pct(R.model.BT)} <Tick input={R.true.tBT} model={R.model.BT} tol={0.02} />
        </span>
      )}
      <span className="ml-auto">
        total xG {f2(R.fit.lh + R.fit.la)} · P(2-2) {pct(R.grid[2]?.[2] ?? 0)}
      </span>
      <span className="sr-only">{s.homeTeam}</span>
    </div>
  );
}

/* ------------------------------- tab ① offers ------------------------------- */

function OffersTab({ R, s }: { R: Computed; s: DeskState }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="pt-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="pb-2 text-left font-medium">Offer</th>
                <th className="pb-2 text-left font-medium">Book</th>
                <th className="pb-2 text-right font-medium">Odds</th>
                <th className="pb-2 text-right font-medium">Fair</th>
                <th className="pb-2 text-right font-medium">Raw edge</th>
                <th className="pb-2 text-right font-medium">Lay-hedged</th>
                <th className="pb-2 text-right font-medium">Call</th>
              </tr>
            </thead>
            <tbody>
              {R.offers.map((o) => {
                const fire = o.decomp.total > 0;
                const isBest = R.best?.key === o.key;
                return (
                  <tr key={o.key} className="border-t">
                    <td className="py-2.5 font-medium">
                      {o.label}
                      {isBest && (
                        <Badge variant="secondary" className="ml-2 text-[9px]">
                          BEST
                        </Badge>
                      )}
                    </td>
                    <td className="py-2.5">
                      <BookieChip name={o.book} />
                    </td>
                    <td className="py-2.5 text-right font-mono">{f3(o.odds)}</td>
                    <td className="py-2.5 text-right font-mono">{f3(o.decomp.fair)}</td>
                    <td className={cn("py-2.5 text-right font-mono", o.decomp.total >= 0 ? "text-emerald-600" : "text-negative")}>
                      {pct(o.decomp.total)}
                    </td>
                    <td className={cn("py-2.5 text-right font-mono", o.layHedged >= 0 ? "text-emerald-600" : "text-negative")}>
                      {Number.isFinite(o.layHedged) ? pct(o.layHedged) : "—"}
                    </td>
                    <td className="py-2.5 text-right">
                      <Badge variant={fire ? "default" : "outline"} className={cn(fire && "bg-emerald-600")}>
                        {fire ? "FIRE" : "PASS"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardContent className="pt-5">
          <div className="pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
            Why the early payout {R.best && R.best.decomp.total > 0 ? "works here" : "doesn't (quite) rescue it"}
          </div>
          <p className="pb-3 text-xs leading-relaxed text-muted-foreground">
            Each EP price = a straight-win bet (usually negative — the odds are short){" "}
            <span className="font-medium text-foreground">plus</span> the early-payout bonus (positive — the value of
            getting paid when the team leads then fails to win). The bonus is real and fully in the model; it just has
            to <em>beat</em> the margin baked into the short odds.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="pb-2 text-left font-medium">Leg</th>
                <th className="pb-2 text-right font-medium">P(win FT)</th>
                <th className="pb-2 text-right font-medium">P(EP)</th>
                <th className="pb-2 text-right font-medium">Straight</th>
                <th className="pb-2 text-right font-medium">+ EP bonus</th>
                <th className="pb-2 text-right font-medium">= Net</th>
                <th className="pb-2 text-right font-medium">Bonus event*</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {R.offers.map((o) => (
                <tr key={o.key} className="border-t">
                  <td className="py-2 font-sans font-medium">{o.label}</td>
                  <td className="py-2 text-right">{pct(o.tW)}</td>
                  <td className="py-2 text-right">{pct(o.pEP)}</td>
                  <td className="py-2 text-right text-negative">{pct(o.decomp.straight)}</td>
                  <td className="py-2 text-right text-emerald-600">+{pct(o.decomp.bonus)}</td>
                  <td className={cn("py-2 text-right font-semibold", o.decomp.total >= 0 ? "text-emerald-600" : "text-negative")}>
                    {pct(o.decomp.total)}
                  </td>
                  <td className="py-2 text-right">{pct(o.decomp.G)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pt-3 text-[10px] leading-relaxed text-muted-foreground">
            *Bonus event = P(team leads by the threshold, then fails to win) — the &quot;went ahead then got pegged
            back&quot; scenario. Total xG here is {f2(R.fit.lh + R.fit.la)} ({R.fit.lh + R.fit.la < 2.8 ? "low" : "goal-friendly"}
            -scoring): few goals → few leads surrendered → small bonus for 2UP; 1UP beats 2UP only if sourced near fair
            ({f3(1 / R.ep.pH1)} home / {f3(1 / R.ep.pA1)} away).
          </p>
        </CardContent>
      </Card>
      <span className="sr-only">{s.homeTeam}</span>
    </div>
  );
}

/* ------------------------------- tab ② dutch ------------------------------- */

function DutchTab({
  R,
  s,
  onTrack,
  exchangeName,
}: {
  R: Computed;
  s: DeskState;
  onTrack: (threshold: 2 | 1) => void;
  exchangeName?: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {([2, 1] as const).map((threshold) => {
        const d = threshold === 2 ? R.dutch2 : R.dutch1;
        const bkH = threshold === 2 ? s.bkH2 : s.bkH1;
        const bkA = threshold === 2 ? s.bkA2 : s.bkA1;
        const legs = [
          { n: 1, label: `${s.homeTeam} ${threshold}UP`, venue: bkH, odds: d.oH, stake: d.stakes.SH, edge: (threshold === 2 ? R.ep.pH2 : R.ep.pH1) * d.oH - 1 },
          { n: 2, label: `${s.awayTeam} ${threshold}UP`, venue: bkA, odds: d.oA, stake: d.stakes.SA, edge: (threshold === 2 ? R.ep.pA2 : R.ep.pA1) * d.oA - 1 },
          { n: 3, label: "Draw (exchange back)", venue: exchangeName ?? "Exchange", odds: s.oDraw, stake: d.stakes.SD, edge: R.ep.pD * s.oDraw - 1 },
        ];
        const evFromLegs = legs.reduce((a, l) => a + l.stake * l.edge, 0);
        return (
          <Card key={threshold}>
            <CardContent className="flex flex-col gap-3 pt-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{threshold}UP dutch</div>
                <div className={cn("font-mono text-sm font-semibold", d.dist.EV >= 0 ? "text-emerald-600" : "text-negative")}>
                  EV {gbp(d.dist.EV)}
                </div>
              </div>

              {/* Bet slip — placement order: bookies first, exchange last */}
              <div className="overflow-hidden rounded-lg border">
                {legs.map((leg) => (
                  <div key={leg.n} className="flex items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-[10px]">
                      {leg.n}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{leg.label}</div>
                      <div className="text-[11px] text-muted-foreground">
                        <BookieChip name={leg.venue} className="[&>span:last-child]:text-[11px]" />
                      </div>
                    </div>
                    <div className="text-right font-mono text-xs">
                      <div>@{f3(leg.odds)}</div>
                      <div className="font-semibold">£{f2(leg.stake)}</div>
                    </div>
                    <div className={cn("w-14 text-right font-mono text-[11px]", leg.edge >= 0 ? "text-emerald-600" : "text-negative")}>
                      {pct(leg.edge)}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between bg-muted/50 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">
                    Total outlay £{f2(d.dist.total)} · Σ legs = EV {gbp(evFromLegs)} (linearity — overlap ≠ edge)
                  </span>
                </div>
              </div>

              {/* Distribution */}
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Outcome ladder · P(profit) {pct(d.dist.pProfit)} · σ £{f2(d.dist.sd)}
                </div>
                <div className="flex flex-col gap-1">
                  {d.dist.ladder.slice(0, 6).map((rung) => (
                    <div key={rung.label + rung.pl} className="flex items-center gap-2 text-[11px]">
                      <span className="w-32 truncate">{rung.label}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded bg-muted">
                        <div
                          className={cn("h-full", rung.pl >= 0 ? "bg-emerald-500" : "bg-red-400")}
                          style={{ width: `${Math.min(100, rung.p * 250)}%` }}
                        />
                      </div>
                      <span className="w-12 text-right font-mono text-muted-foreground">{pct(rung.p)}</span>
                      <span className={cn("w-16 text-right font-mono font-medium", rung.pl >= 0 ? "text-emerald-600" : "text-negative")}>
                        {gbp(rung.pl)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Button variant="outline" size="sm" onClick={() => onTrack(threshold)}>
                Add {threshold}UP dutch to profit tracker
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ------------------------------- tab ③ lay sides ------------------------------- */

function LayTab({ R, s, exchangeName }: { R: Computed; s: DeskState; exchangeName?: string }) {
  const sides = [
    { key: "H2", label: `${s.homeTeam} 2UP`, lay: R.layH2, X: R.Xh, book: s.bkH2 },
    { key: "A2", label: `${s.awayTeam} 2UP`, lay: R.layA2, X: R.Xa, book: s.bkA2 },
    { key: "H1", label: `${s.homeTeam} 1UP`, lay: R.layH1, X: R.Xh, book: s.bkH1 },
    { key: "A1", label: `${s.awayTeam} 1UP`, lay: R.layA1, X: R.Xa, book: s.bkA1 },
  ].filter((x) => Number.isFinite(x.lay.EV));
  const combined2 = R.layH2.EV + R.layA2.EV;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {sides.map((side) => (
          <Card key={side.key}>
            <CardContent className="flex flex-col gap-2 pt-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{side.label}</div>
                <div className={cn("font-mono text-sm font-semibold", side.lay.EV >= 0 ? "text-emerald-600" : "text-negative")}>
                  EV {gbp(side.lay.EV)} ({pct(side.lay.evPer1)}/£)
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Back £{f2(side.lay.b)} @ {f3(side.lay.B)} at <BookieChip name={side.book} className="[&>span:last-child]:text-xs" />
                </span>
                <span>
                  Lay £{f2(side.lay.L)} @ {f3(side.X)} at {exchangeName ?? "exchange"} · liability £{f2(side.lay.liability)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {(
                  [
                    ["W · team wins", side.lay.RW, side.lay.pW],
                    ["G · led, didn't win (BOTH pay)", side.lay.RG, side.lay.pG],
                    ["N · never led", side.lay.RN, side.lay.pN],
                  ] as const
                ).map(([label, pl, p]) => (
                  <div key={label} className={cn("rounded-md border p-2", pl > 0 && "border-emerald-300 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30")}>
                    <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
                    <div className={cn("font-mono text-sm font-semibold", pl >= 0 ? "text-emerald-600" : "text-negative")}>{gbp(pl)}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{pct(p)}</div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground">σ £{f2(side.lay.sd)}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-primary/20">
        <CardContent className="flex items-center justify-between pt-5 text-sm">
          <span className="text-muted-foreground">
            Combined both-sides 2UP EV (exact by linearity — home &amp; away lays can&apos;t both lose, so max
            liability is the larger single one)
          </span>
          <span className={cn("font-mono text-lg font-semibold", combined2 >= 0 ? "text-emerald-600" : "text-negative")}>
            {gbp(combined2)}
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------- tab ④ live ------------------------------- */

function LiveTab({
  R,
  s,
  hg,
  ag,
  setHg,
  setAg,
  trig,
  result,
  manual,
}: {
  R: Computed;
  s: DeskState;
  hg: number;
  ag: number;
  setHg: (v: number) => void;
  setAg: (v: number) => void;
  trig: ReturnType<typeof effectiveTriggers>;
  result: "H" | "D" | "A";
  manual: {
    mH1: boolean;
    mH2: boolean;
    mA1: boolean;
    mA2: boolean;
    setMH1: (v: boolean) => void;
    setMH2: (v: boolean) => void;
    setMA1: (v: boolean) => void;
    setMA2: (v: boolean) => void;
  };
}) {
  const lead = hg - ag;
  const dutch2PL = dutchPL(R.dutch2.stakes, s.oH2, s.oA2, s.oDraw, result, trig.eH2, trig.eA2);
  const dutch1PL = dutchPL(R.dutch1.stakes, s.oH1, s.oA1, s.oDraw, result, trig.eH1, trig.eA1);
  const lay2PL =
    laySidePL(R.layH2, "H", result, trig.eH2, R.Xh, R.c) + laySidePL(R.layA2, "A", result, trig.eA2, R.Xa, R.c);
  const lay1PL =
    laySidePL(R.layH1, "H", result, trig.eH1, R.Xh, R.c) + laySidePL(R.layA1, "A", result, trig.eA1, R.Xa, R.c);

  const toggles: { label: string; on: boolean; locked: boolean; set: (v: boolean) => void }[] = [
    { label: "H 1UP", on: trig.eH1, locked: lead >= 1 || trig.eH2, set: manual.setMH1 },
    { label: "H 2UP", on: trig.eH2, locked: lead >= 2, set: manual.setMH2 },
    { label: "A 1UP", on: trig.eA1, locked: -lead >= 1 || trig.eA2, set: manual.setMA1 },
    { label: "A 2UP", on: trig.eA2, locked: -lead >= 2, set: manual.setMA2 },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 pt-5">
          <div className="flex items-center gap-4">
            <span className="w-32 text-right text-lg font-semibold">{s.homeTeam}</span>
            <Input
              type="number"
              min={0}
              value={hg}
              onChange={(e) => setHg(Math.max(0, parseInt(e.target.value) || 0))}
              className="h-14 w-16 text-center font-mono !text-2xl font-bold"
            />
            <span className="text-2xl text-muted-foreground">–</span>
            <Input
              type="number"
              min={0}
              value={ag}
              onChange={(e) => setAg(Math.max(0, parseInt(e.target.value) || 0))}
              className="h-14 w-16 text-center font-mono !text-2xl font-bold"
            />
            <span className="w-32 text-lg font-semibold">{s.awayTeam}</span>
          </div>
          <Badge variant="secondary">
            {result === "H" ? `${s.homeTeam} win` : result === "A" ? `${s.awayTeam} win` : "Draw"}
          </Badge>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              EP triggers
            </span>
            {toggles.map((t) => (
              <button
                key={t.label}
                type="button"
                disabled={t.locked}
                onClick={() => t.set(!t.on)}
                className={cn(
                  "rounded-full border px-3 py-1 font-mono text-xs transition-colors",
                  t.on
                    ? "border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground hover:bg-muted",
                  t.locked && "cursor-not-allowed opacity-90"
                )}
                title={t.locked ? "Locked by the current score" : "Toggle: led earlier then got pegged back"}
              >
                {t.label} {t.on ? "●" : "○"}
              </button>
            ))}
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            Triggers auto-lock when the score forces them; toggle manually for &quot;led earlier, got pegged
            back&quot;. 2UP implies 1UP.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["Dutch 2UP", dutch2PL],
            ["Dutch 1UP", dutch1PL],
            ["Lay 2UP (both)", lay2PL],
            ["Lay 1UP (both)", lay1PL],
          ] as const
        ).map(([label, pl]) => (
          <Card key={label}>
            <CardContent className="pt-4 text-center">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {label}
              </div>
              <div className={cn("pt-1 font-mono text-xl font-bold", pl >= 0 ? "text-emerald-600" : "text-negative")}>
                {gbp(pl)}
              </div>
              <div className="text-[10px] text-muted-foreground">settles at this score</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- playbook overlay ------------------------------- */

function PlaybookOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [ticks, setTicks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(PLAYBOOK_KEY);
        if (raw) setTicks(JSON.parse(raw));
      } catch {
        /* fresh start */
      }
    });
  }, []);

  useEffect(() => {
    localStorage.setItem(PLAYBOOK_KEY, JSON.stringify(ticks));
  }, [ticks]);

  const allItems = PLAYBOOK.flatMap((sec) => sec.items);
  const done = allItems.filter((i) => ticks[i]).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span className="flex items-center gap-2">
              <Flag className="size-4 text-primary" /> Scouting Playbook
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {done}/{allItems.length}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed">
          <span className="font-semibold text-primary">The one rule:</span> the edge is in the{" "}
          <em>offer</em>, not the match. A good setup = an early-payout <strong>promo on near-fair odds</strong>.
          If the EP price is shorter than the straight win price, value&apos;s gone → pass.
          <div className="pt-2 font-mono text-[10px] text-muted-foreground">
            Ideal: fav @ 1.70–2.30 · O2.5 ≤ 1.50 · BTTS ≤ 1.55 · total xG ≥ 3.5 · use 2UP
          </div>
        </div>
        {PLAYBOOK.map((section) => (
          <div key={section.section}>
            <div className="pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {section.section}
            </div>
            <div className="flex flex-col gap-1">
              {section.items.map((item) => (
                <label key={item} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={!!ticks[item]}
                    onChange={(e) => setTicks((prev) => ({ ...prev, [item]: e.target.checked }))}
                    className="mt-0.5 accent-[var(--primary)]"
                  />
                  <span className={ticks[item] ? "text-muted-foreground line-through" : ""}>{item}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setTicks({})}>
            <X className="size-3.5" /> Reset checklist
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
