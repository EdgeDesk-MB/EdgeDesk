"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AdvancedLaySection } from "@/components/calc/advanced-lay";
import {
  BackBookieBalanceStrip,
  bookieCashTopUpNeeded,
  bookieFreeBetBalance,
  bookieNeedsCashFunding,
  editBetReservedCredit,
  isFreeBetBetType,
  noLayFreeBetFromStored,
  noLaySaveBetType,
  type FreeBetKind,
} from "@/components/add-bet/back-bookie-balance-strip";
import { BookmakerSelect } from "@/components/calc/bookmaker-select";
import { MoneyFlow } from "@/components/money-flow";
import { VenueBadge } from "@/components/venue-badge";
import {
  BackPanel,
  LayPanel,
  LayStakeBanner,
  PanelIconSelect,
  PanelInput,
  PanelTextInput,
  ProfitTable,
} from "@/components/calc/bet-panels";
import { ExchangeSelect } from "@/components/calc/exchange-select";
import { api } from "@/hooks/use-app-state";
import { completeEffort } from "@/lib/effort-timer";
import { useAppState } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import {
  layBounds,
  layPlanOutcome,
  executableLayStake,
  matchedBackReturns,
  offerTriggerDetectedInLabel,
  offerTriggerFromLabel,
  previewAiTriggersFromInput,
  type BetMode,
  type DutchLeg,
  type PartLay,
} from "@/lib/calc";
import { DutchOutcomesBuilder, inferMatchOddsSelection } from "@/components/calc/dutch-outcomes-builder";
import { contrastText } from "@/lib/brands/exchanges";
import {
  capitaliseSelectionLabel,
  defaultSelection,
  formatCorrectScore,
  inferSportFromBet,
  marketDef,
  MARKETS,
  parseCorrectScore,
  SPORTS,
  teamSelectionLabel,
} from "@/lib/markets";
import type { BetRow, ExchangeRow } from "@/lib/db/schema";
import {
  defaultEventDateTime,
  effectiveEventStatus,
  eventDisplayName,
  findTrackedEvent,
  formatEventDate,
  formatEventTime,
  localCalendarDate,
  parseEventStartTime,
  parseRacingCourseFromEventName,
  sortTrackedEvents,
  teamsMatch,
  type TrackedEventLike,
} from "@/lib/events";
import {
  bandNotTrackedFixtures,
  bandTrackedEvents,
  filterByOfferCourseScope,
  fixtureSelectValue,
  formatKnownFixtureOption,
  formatTrackedEventOption,
  isFixtureSelectValue,
  knownFromFootballFixtures,
  knownFromRacingFixtures,
  parseFixtureSelectValue,
  resolveRaceRunnerOptions,
  tomorrowCalendarDate,
  type KnownFixtureOption,
} from "@/lib/add-bet-event-options";
import type { Fixture, RacingFixture } from "@/components/events/types";
import {
  formatOfferScopeLabel,
  isRegionalScope,
  offerMatchesBetContext,
  parseOfferRules,
  placeRefundTriggerText,
} from "@/lib/offers/racing-offer-rules";
import {
  bookmakerFromOfferPrefs,
  stakeFromOfferPrefs,
} from "@/lib/services/settings-shared";
import { liveEventInlineLabel } from "@/components/events/live-event-status";
import { DatePicker } from "@/components/date-picker";
import { EventTimeInput } from "@/components/event-time-input";
import { SportIcon, SportLabel } from "@/components/sport-icon";
import { preventDialogDismissOnPortaledContent } from "@/lib/dialog-portal";
import { cn } from "@/lib/utils";
import { BetOfferTriggerField } from "@/components/add-bet/bet-offer-trigger-field";
import { Gift, Sparkles, Trash2, Zap } from "lucide-react";
import type { BetOcrFields, ScreenshotSource } from "@/lib/ocr/types";
import { matchOcrToEvent } from "@/lib/ocr/match-event";
import { matchOcrToRunner } from "@/lib/ocr/match-runner";

import { BetImportDialog } from "@/components/add-bet/bet-import-dialog";

export interface EventLite extends TrackedEventLike {
  status: string;
  sport?: string;
  competition?: string | null;
  startTime: number;
  externalId?: string | null;
  homeScore?: number;
  awayScore?: number;
  minute?: number;
  goals?: string | null;
}

export interface AddBetPrefill {
  label?: string;
  /** Placeholder + fallback name when the user doesn't type a label */
  labelSuggestion?: string;
  /** Calc modes, or UI-only boost (J2b) / no_lay / dutch via setBetType after open */
  betType?: BetMode | "boost";
  backStake?: number;
  backOdds?: number;
  layOdds?: number;
  layStake?: number;
  exchangeId?: number;
  advanced?: boolean;
  partLays?: PartLay[];
  layStakeOverride?: number | null;
  bookmaker?: string;
  sport?: string;
  market?: string;
  selection?: string;
  homeTeam?: string;
  awayTeam?: string;
  eventId?: number;
  /**
   * Racing: pre-select this racecard in Events (tracked id or not-yet-tracked
   * fixture). Used when placing from a race-scoped campaign.
   */
  raceExternalId?: string;
  /** Calendar day for raceExternalId / course scope when outside today/tomorrow. */
  raceEventDate?: string;
  /** Racing: limit Events to this course (course-scoped or race-scoped campaigns). */
  scopeCourse?: string;
  earlyPayout?: boolean;
  /** Dutching calculator: saved as betType dutch with legs on POST */
  dutchLegs?: Array<{
    label: string;
    market: string;
    selection: string;
    odds: number;
    stake: number;
    earlyPayout?: boolean;
    bookmaker?: string;
    freeBet?: "snr" | "sr";
  }>;
  expectedProfit?: number;
  notes?: string;
  offerId?: number;
  triggerText?: string;
  /** Mobile quick-log capture - the bet is flagged for later desktop review */
  quickLogged?: boolean;
  /** J5: pre-set the Mug bet toggle (camouflage, excluded from edge analytics) */
  mug?: boolean;
  /** Open the Paste slip import as soon as the dialog mounts */
  autoOpenImport?: boolean;
  /** J2b: link this boost diary row when the bet is saved */
  boostDiaryId?: number;
  /**
   * Leave sport / event / date / time / market empty - only apply fields
   * explicitly set on the prefill (boost Place bet: those are unknown).
   */
  omitEventDefaults?: boolean;
}

/** UI bet types: the four calc modes plus "no lay" (saved as qualifying
 * with zeroed lay - a deliberate back-only bet, e.g. mug bets), "dutch"
 * (saved as betType dutch with a legs array), and "boost" (J2b — qualifying
 * maths, stored as betType boost for Tracker/History categorisation). */
type UiBetType = BetMode | "no_lay" | "dutch" | "boost";

const betTypeLabels: Record<UiBetType, string> = {
  qualifying: "Qualifying",
  boost: "Boost",
  free_snr: "Free bet (SNR)",
  free_sr: "Free bet (SR)",
  risk_free: "Risk-free",
  no_lay: "No lay (back only)",
  dutch: "Dutch",
};

function exchangeFromNotes(notes: string | null | undefined, exchanges: ExchangeRow[]) {
  const match = notes?.match(/^Exchange: (.+)$/);
  if (!match) return null;
  return exchanges.find((e) => e.name === match[1]) ?? null;
}

/**
 * The app-wide Add bet dialog - MBB-style back/lay panels themed to the chosen
 * exchange, per-sport markets, advanced lay controls and a live outcomes table.
 *
 * Controlled (`open`/`onOpenChange`, used by the calculators with a `prefill`)
 * or uncontrolled with a `trigger` button (Profit Tracker). With
 * `highlightEmpty`, fields without an entry carry a black ring until filled.
 */
export function AddBetDialog({
  events: eventsProp,
  onSaved,
  onDeleted,
  trigger,
  open: openProp,
  onOpenChange,
  prefill,
  editBet,
  highlightEmpty,
  toastOnSave = true,
}: {
  events?: EventLite[];
  onSaved?: (betId: number) => void;
  onDeleted?: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  prefill?: AddBetPrefill;
  /** When set the dialog edits an existing bet instead of creating one. */
  editBet?: BetRow | null;
  highlightEmpty?: boolean;
  /** When false the caller shows their own save toast (e.g. calculator with View bet). */
  toastOnSave?: boolean;
}) {
  const { exchanges } = useExchanges();
  const { state: appState, refresh: refreshAppState } = useAppState(10_000);
  const appSettings = appState?.settings;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = (o: boolean) => {
    onOpenChange?.(o);
    if (openProp === undefined) setInternalOpen(o);
  };

  const [fetchedEvents, setFetchedEvents] = useState<EventLite[]>([]);
  const events = eventsProp ?? fetchedEvents;
  const [knownFixtures, setKnownFixtures] = useState<KnownFixtureOption[]>([]);
  const [pendingFixture, setPendingFixture] = useState<KnownFixtureOption | null>(null);
  /** Runners fetched for a tracked race when goals has no racecard yet. */
  const [fetchedRunners, setFetchedRunners] = useState<string[]>([]);
  const [runnersFetchDone, setRunnersFetchDone] = useState(false);

  const [label, setLabel] = useState("");
  const [bookmaker, setBookmaker] = useState("");
  const [sport, setSport] = useState("football");
  const [eventId, setEventId] = useState<string>("none");
  const dateTimeDefaults = defaultEventDateTime();
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState(dateTimeDefaults.date);
  const [eventTime, setEventTime] = useState(dateTimeDefaults.time);
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [market, setMarket] = useState("match_odds");
  const [selection, setSelection] = useState("home");
  const [betType, setBetType] = useState<UiBetType>("qualifying");
  /** The calc/settlement mode behind the UI type */
  const calcBetType: BetMode =
    betType === "no_lay" || betType === "dutch" || betType === "boost"
      ? "qualifying"
      : betType;
  const noLay = betType === "no_lay";
  const isDutch = betType === "dutch";
  const isBoost = betType === "boost";
  /** No-lay overlay: stake from free-bet balance without leaving No lay mode. */
  const [noLayFreeBet, setNoLayFreeBet] = useState<FreeBetKind | null>(null);
  const stakingFreeBet =
    isFreeBetBetType(calcBetType) || (noLay && noLayFreeBet != null);
  const [mugBet, setMugBet] = useState(false);
  const [backStake, setBackStake] = useState(NaN);
  const [backOdds, setBackOdds] = useState(NaN);
  const [layOdds, setLayOdds] = useState(NaN);
  const [exchange, setExchange] = useState<ExchangeRow | null>(null);
  const [earlyPayout, setEarlyPayout] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [partLays, setPartLays] = useState<PartLay[]>([]);
  const [layStakeOverride, setLayStakeOverride] = useState<number | null>(null);
  const [triggerText, setTriggerText] = useState("");
  const [triggerLinkedFromLabel, setTriggerLinkedFromLabel] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dutchLegs, setDutchLegs] = useState<AddBetPrefill["dutchLegs"]>(undefined);
  const [addBalance, setAddBalance] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);
  /** Prevents async re-fetches (events/exchanges) from resetting user-edited fields. */
  const hydratedKeyRef = useRef<string | null>(null);

  function resetFormState() {
    const { date, time } = defaultEventDateTime();
    setLabel("");
    setSport("football");
    setEventId("none");
    setEventName("");
    setEventDate(date);
    setEventTime(time);
    setHomeTeam("");
    setAwayTeam("");
    setMarket("match_odds");
    setSelection("home");
    setBetType(appSettings?.defaultBetType ?? "qualifying");
    setNoLayFreeBet(null);
    setBackStake(appSettings?.defaultBackStake ?? NaN);
    setBookmaker(appSettings?.defaultBookmaker ?? "");
    setBackOdds(NaN);
    setLayOdds(NaN);
    setExchange(null);
    setEarlyPayout(false);
    setAdvanced(false);
    setPartLays([]);
    setLayStakeOverride(null);
    setTriggerText("");
    setTriggerLinkedFromLabel(false);
    setManualEntry(false);
    setDutchLegs(undefined);
    setAddBalance(false);
    setSelectedOfferId(null);
    setPendingFixture(null);
    setKnownFixtures([]);
    setFetchedRunners([]);
    setRunnersFetchDone(false);
  }

  // Refresh tracked-events list, known fixtures, and default date/time when the dialog opens
  useEffect(() => {
    if (!open) {
      hydratedKeyRef.current = null;
      queueMicrotask(() => resetFormState());
      return;
    }
    api<{ events: EventLite[] }>("/api/events")
      .then((r) => setFetchedEvents(r.events))
      .catch(() => {});
    if (editBet) return;
    // Boost (and similar) prefills leave date/time blank on purpose.
    if (prefill?.omitEventDefaults || prefill?.boostDiaryId != null) return;
    const { date, time } = defaultEventDateTime();
    queueMicrotask(() => {
      if (eventId === "none") {
        setEventDate(date);
        setEventTime(time);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editBet?.id, prefill?.omitEventDefaults, prefill?.boostDiaryId]);

  // Load today + tomorrow fixtures for football / horse racing Event dropdown
  // (plus the race-scoped campaign day when prefill asks for a specific card).
  useEffect(() => {
    if (!open) return;
    if (sport !== "football" && sport !== "horse_racing") return;
    let cancelled = false;
    const today = localCalendarDate();
    const tomorrow = tomorrowCalendarDate();
    const extraDate = prefill?.raceEventDate?.trim();

    async function load() {
      try {
        if (sport === "football") {
          const [a, b] = await Promise.all([
            api<{ fixtures: Fixture[] }>(`/api/fixtures?date=${today}`),
            api<{ fixtures: Fixture[] }>(`/api/fixtures?date=${tomorrow}`),
          ]);
          if (cancelled) return;
          const byId = new Map<string, Fixture>();
          for (const f of [...(a.fixtures ?? []), ...(b.fixtures ?? [])]) {
            if (f.externalId) byId.set(f.externalId, f);
          }
          setKnownFixtures(knownFromFootballFixtures([...byId.values()]));
          return;
        }
        const dates = [...new Set([today, tomorrow, ...(extraDate ? [extraDate] : [])])];
        const batches = await Promise.all(
          dates.map((d) => api<{ racecards: RacingFixture[] }>(`/api/racing/racecards?date=${d}`))
        );
        if (cancelled) return;
        const byId = new Map<string, RacingFixture>();
        for (const batch of batches) {
          for (const r of batch.racecards ?? []) {
            if (r.externalId) byId.set(r.externalId, r);
          }
        }
        setKnownFixtures(knownFromRacingFixtures([...byId.values()]));
      } catch {
        if (!cancelled) setKnownFixtures([]);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, sport, prefill?.raceEventDate]);

  // Populate fields when editing an existing bet (once per open, when events are ready)
  useEffect(() => {
    if (!open || !editBet) return;
    const key = `edit:${editBet.id}`;
    if (hydratedKeyRef.current === key) return;

    const ev = events.find((e) => e.id === editBet.eventId);
    if (editBet.eventId && !ev && eventsProp === undefined && fetchedEvents.length === 0) {
      return;
    }

    hydratedKeyRef.current = key;
    const resolvedSport = inferSportFromBet(editBet.market, ev?.sport);

    queueMicrotask(() => {
      setSport(resolvedSport);
      setLabel(editBet.label);
      setBookmaker(editBet.bookmaker ?? "");
      const unhedgedFree = noLayFreeBetFromStored(
        editBet.betType,
        editBet.layStake,
        editBet.layOdds
      );
      setBetType(
        editBet.betType === "dutch"
          ? "dutch"
          : editBet.betType === "boost"
            ? "boost"
            : editBet.betType === "qualifying" && editBet.layStake === 0 && editBet.layOdds === 0
              ? "no_lay"
              : unhedgedFree
                ? "no_lay"
                : (editBet.betType as BetMode)
      );
      setNoLayFreeBet(unhedgedFree);
      // Bug fix: a dutch bet's legs were never restored on edit, so saving
      // silently overwrote it as a plain single bet and lost the legs.
      setDutchLegs(
        editBet.betType === "dutch" && editBet.legs
          ? (JSON.parse(editBet.legs) as AddBetPrefill["dutchLegs"])
          : undefined
      );
      setMugBet(editBet.purpose === "mug" && !unhedgedFree);
      setBackStake(editBet.backStake);
      setBackOdds(editBet.backOdds);
      setLayOdds(editBet.layOdds);
      setMarket(editBet.market);
      setSelection(editBet.selection);
      setEarlyPayout(!!editBet.earlyPayout);
      setTriggerText(editBet.triggerText ?? "");
      setTriggerLinkedFromLabel(offerTriggerDetectedInLabel(editBet.label));
      setAdvanced(false);
      setPartLays([]);
      setLayStakeOverride(editBet.layStake);
      setSelectedOfferId(editBet.offerId ?? null);
      setAddBalance(false);

      if (ev) {
        applyTrackedEvent(ev, resolvedSport);
      } else if (editBet.eventId) {
        setEventId(String(editBet.eventId));
        setManualEntry(false);
      } else {
        setEventId("none");
        setManualEntry(true);
        setHomeTeam("");
        setAwayTeam("");
        setEventName("");
        const { date, time } = defaultEventDateTime();
        setEventDate(date);
        setEventTime(time);
      }

      const ex =
        (editBet.exchangeId != null
          ? exchanges.find((e) => e.id === editBet.exchangeId)
          : undefined) ?? exchangeFromNotes(editBet.notes, exchanges);
      if (ex) setExchange(ex);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editBet?.id, events, exchanges]);

  // Apply prefill whenever the dialog opens (add flow only, once per open)
  useEffect(() => {
    if (!open || !prefill || editBet) return;
    const key = "add";
    if (hydratedKeyRef.current === key) return;
    hydratedKeyRef.current = key;

    queueMicrotask(() => {
      // Clear invented event chrome before applying known fields (boost Place bet).
      if (prefill.omitEventDefaults || prefill.boostDiaryId != null) {
        setSport("");
        setEventId("none");
        setEventName("");
        setEventDate("");
        setEventTime("");
        setHomeTeam("");
        setAwayTeam("");
        setMarket("");
        setSelection("");
        setManualEntry(false);
        setPendingFixture(null);
      }
      if (prefill.labelSuggestion && !prefill.label) setLabel(prefill.labelSuggestion);
      if (prefill.label !== undefined) setLabel(prefill.label);
      if (prefill.betType) setBetType(prefill.betType as UiBetType);
      if (prefill.mug) {
        setMugBet(true);
        setBetType("no_lay");
      }
      if (prefill.backStake !== undefined) setBackStake(prefill.backStake);
      if (prefill.backOdds !== undefined) setBackOdds(prefill.backOdds);
      if (prefill.layOdds !== undefined) setLayOdds(prefill.layOdds);
      if (prefill.advanced !== undefined) setAdvanced(prefill.advanced);
      if (prefill.partLays) setPartLays(prefill.partLays);
      if (prefill.layStakeOverride !== undefined) setLayStakeOverride(prefill.layStakeOverride);
      if (prefill.sport) setSport(prefill.sport);
      if (prefill.market) {
        setMarket(prefill.market);
        setSelection(prefill.selection ?? defaultSelection(prefill.sport ?? "football", prefill.market));
      } else if (prefill.selection) {
        setSelection(prefill.selection);
      }
      if (prefill.earlyPayout !== undefined) setEarlyPayout(prefill.earlyPayout);
      if (prefill.dutchLegs) setDutchLegs(prefill.dutchLegs);
      if (prefill.layStake !== undefined) setLayStakeOverride(prefill.layStake);
      if (prefill.homeTeam) setHomeTeam(prefill.homeTeam);
      if (prefill.awayTeam) setAwayTeam(prefill.awayTeam);
      if (prefill.bookmaker) setBookmaker(prefill.bookmaker);
      if (prefill.eventId !== undefined) setEventId(String(prefill.eventId));
      if (prefill.triggerText) {
        setTriggerText(prefill.triggerText);
        setTriggerLinkedFromLabel(true);
      }
      if (prefill.offerId != null) {
        setSelectedOfferId(prefill.offerId);
        // Apply stake/bookie prefs from the offer (same as clicking the offer chip)
        const offer = appState?.offers?.find((o) => o.id === prefill.offerId);
        if (offer && !prefill.backStake && !prefill.bookmaker) {
          const rules = parseOfferRules(offer);
          const prefs = appSettings?.offerBetPrefs ?? {};
          const stake = stakeFromOfferPrefs(
            prefs,
            offer.id,
            rules?.betStake,
            appSettings?.defaultBackStake ?? 10
          );
          const bookie = bookmakerFromOfferPrefs(
            prefs,
            offer.id,
            offer.bookmaker,
            ""
          );
          if (stake > 0) setBackStake(stake);
          if (bookie) setBookmaker(bookie);
          if (rules) {
            setTriggerText(placeRefundTriggerText(rules));
            setTriggerLinkedFromLabel(false);
          }
        }
      }
      if (prefill.exchangeId !== undefined) {
        const ex = exchanges.find((e) => e.id === prefill.exchangeId);
        if (ex) setExchange(ex);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Set exchange from edit bet once exchanges have loaded (fallback if not set during hydration)
  const exchangeHydratedRef = useRef(false);
  useEffect(() => {
    if (!open) exchangeHydratedRef.current = false;
  }, [open]);
  useEffect(() => {
    if (!open || !editBet || exchange || exchanges.length === 0) return;
    if (exchangeHydratedRef.current) return;
    const ex =
      (editBet.exchangeId != null
        ? exchanges.find((e) => e.id === editBet.exchangeId)
        : undefined) ?? exchangeFromNotes(editBet.notes, exchanges);
    if (ex) {
      exchangeHydratedRef.current = true;
      queueMicrotask(() => setExchange(ex));
    }
  }, [open, editBet, exchanges, exchange]);

  // Prefer Settings default exchange (or prefill); fall back to first listed
  useEffect(() => {
    if (exchange || exchanges.length === 0 || editBet) return;
    const preferred =
      (prefill?.exchangeId !== undefined
        ? exchanges.find((e) => e.id === prefill.exchangeId)
        : undefined) ??
      exchanges.find((e) => e.isDefault) ??
      exchanges[0];
    queueMicrotask(() => setExchange(preferred));
  }, [exchanges, exchange, prefill]);

  const commission =
    exchange?.commissionPct ?? (editBet ? editBet.commission * 100 : 2);
  const markets = MARKETS[sport] ?? MARKETS.other;
  const currentMarket = marketDef(sport, market);

  const planInput = useMemo(() => {
    if (noLay || isDutch) return null;
    if (!(backStake > 0 && backOdds > 1 && layOdds > 1)) return null;
    return {
      mode: calcBetType,
      backStake,
      backOdds,
      layOdds,
      commission: commission / 100,
      partLays: advanced ? partLays.filter((p) => p.odds > 1 && p.stake > 0) : [],
    };
  }, [betType, noLay, isDutch, calcBetType, backStake, backOdds, layOdds, commission, advanced, partLays]);

  const bounds = useMemo(() => (planInput ? layBounds(planInput) : null), [planInput]);
  const layStake = useMemo(
    () => (planInput ? executableLayStake(planInput, layStakeOverride) : 0),
    [planInput, layStakeOverride]
  );
  const preview = useMemo(
    () => (planInput ? layPlanOutcome({ ...planInput, layStake }) : null),
    [planInput, layStake]
  );

  const outcomeRows = [
    {
      label: "If back (bookie) bet wins",
      bookie: preview?.ifBackWins.bookie ?? 0,
      exchange: preview?.ifBackWins.exchange ?? 0,
      accent: "back" as const,
    },
    {
      label: "If lay (exchange) bet wins",
      bookie: preview?.ifBackLoses.bookie ?? 0,
      exchange: preview?.ifBackLoses.exchange ?? 0,
      accent: "lay" as const,
    },
  ];

  /** Course/race-scoped campaign CTA: stay on that meeting, no freehand escape. */
  const courseScopeLocked =
    !editBet &&
    !!prefill?.scopeCourse?.trim() &&
    !isRegionalScope(prefill.scopeCourse);
  const courseScopeLabel = courseScopeLocked
    ? formatOfferScopeLabel(prefill?.scopeCourse)
    : null;

  const trackedEvents = useMemo(() => {
    let base = events.filter(
      (e) => (e.sport ?? "football") === sport && e.status !== "finished"
    );
    if (sport === "horse_racing" && prefill?.scopeCourse) {
      base = filterByOfferCourseScope(base, prefill.scopeCourse);
    }
    const linkedId =
      editBet?.eventId ??
      (eventId !== "none" && !isFixtureSelectValue(eventId) ? Number(eventId) : null);
    if (linkedId && !base.some((e) => e.id === linkedId)) {
      const linked = events.find((e) => e.id === linkedId);
      if (linked && (linked.sport ?? "football") === sport) {
        // Keep a linked event visible even if it falls outside course scope
        // (edit mode / already-attached bet).
        return sortTrackedEvents([linked, ...base]);
      }
    }
    return sortTrackedEvents(base);
  }, [events, sport, editBet?.eventId, eventId, prefill?.scopeCourse]);

  const trackedExternalIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of events) {
      if (e.externalId) ids.add(e.externalId);
    }
    return ids;
  }, [events]);

  const scopedKnownFixtures = useMemo(() => {
    if (sport !== "horse_racing" || !prefill?.scopeCourse) return knownFixtures;
    return filterByOfferCourseScope(knownFixtures, prefill.scopeCourse);
  }, [sport, knownFixtures, prefill?.scopeCourse]);

  const linkedEventKeepIds = useMemo(() => {
    const linkedId =
      editBet?.eventId ??
      (eventId !== "none" && !isFixtureSelectValue(eventId) ? Number(eventId) : null);
    return linkedId != null && Number.isFinite(linkedId) ? new Set([linkedId]) : undefined;
  }, [editBet?.eventId, eventId]);

  const trackedDayBands = useMemo(
    () => bandTrackedEvents(trackedEvents, Date.now(), linkedEventKeepIds),
    [trackedEvents, linkedEventKeepIds]
  );
  const notTrackedDayBands = useMemo(() => {
    if (sport !== "football" && sport !== "horse_racing") return [];
    return bandNotTrackedFixtures(scopedKnownFixtures, trackedExternalIds);
  }, [sport, scopedKnownFixtures, trackedExternalIds]);

  const selectedEvent = events.find((e) => String(e.id) === eventId);
  const effectiveHome = homeTeam.trim() || selectedEvent?.homeTeam || "";
  const effectiveAway = awayTeam.trim() || selectedEvent?.awayTeam || "";

  const eventLinked = eventId !== "none";
  /** Odds order from the loaded racecard (pending fixture or matching known race). */
  const raceOddsOrder = useMemo(() => {
    if (pendingFixture?.runners?.length) return pendingFixture.runners;
    const ext = selectedEvent?.externalId;
    if (!ext) return null;
    return knownFixtures.find((f) => f.externalId === ext)?.runners ?? null;
  }, [pendingFixture?.runners, selectedEvent?.externalId, knownFixtures]);
  const raceRunnerOptions = useMemo(() => {
    if (sport !== "horse_racing") return [];
    return resolveRaceRunnerOptions({
      eventLinked,
      pendingRunners: pendingFixture?.runners,
      trackedGoals: selectedEvent?.goals,
      fetchedRunners,
      oddsOrder: raceOddsOrder,
      currentSelection: selection,
    });
  }, [
    sport,
    eventLinked,
    pendingFixture?.runners,
    selectedEvent?.goals,
    fetchedRunners,
    raceOddsOrder,
    selection,
  ]);
  const useRaceRunnerSelect = raceRunnerOptions.length > 0;
  /** Linked race with a known card (or still loading): Selection is a dropdown, not free text. */
  const lockRaceSelection =
    sport === "horse_racing" && eventLinked && (useRaceRunnerSelect || !runnersFetchDone);

  // Keep Selection value on the capitalised card spelling so the Select control
  // stays valid. Adjust-during-render: re-checked when the options or the typed
  // selection change (react-hooks/set-state-in-effect).
  const runnerNormKey = useRaceRunnerSelect
    ? `${raceRunnerOptions.join(" ")} ${selection}`
    : "";
  const [prevRunnerNormKey, setPrevRunnerNormKey] = useState(runnerNormKey);
  if (runnerNormKey !== prevRunnerNormKey) {
    setPrevRunnerNormKey(runnerNormKey);
    const hit = selection.trim()
      ? raceRunnerOptions.find(
          (r) => r.toLowerCase() === selection.trim().toLowerCase()
        )
      : undefined;
    if (hit && hit !== selection) setSelection(hit);
  }

  const raceCourseForOffers = useMemo(() => {
    if (sport !== "horse_racing") return "";
    return (
      parseRacingCourseFromEventName(eventName) ||
      pendingFixture?.course?.trim() ||
      pendingFixture?.competition?.trim() ||
      selectedEvent?.competition?.trim() ||
      homeTeam.trim() ||
      ""
    );
  }, [
    sport,
    eventName,
    pendingFixture?.course,
    pendingFixture?.competition,
    selectedEvent?.competition,
    homeTeam,
  ]);

  const matchingOffers = useMemo(() => {
    if (sport !== "horse_racing") return [];
    const offers = appState?.offers ?? [];
    const course = raceCourseForOffers || null;
    const raceExternalId =
      selectedEvent?.externalId ?? pendingFixture?.externalId ?? null;
    const offTime = eventTime.trim() || null;
    return offers.filter((o) =>
      offerMatchesBetContext(o, {
        date: eventDate,
        course,
        raceExternalId,
        offTime,
        bookmaker: bookmaker || null,
      })
    );
  }, [
    sport,
    appState?.offers,
    raceCourseForOffers,
    selectedEvent?.externalId,
    pendingFixture?.externalId,
    eventDate,
    eventTime,
    bookmaker,
  ]);

  const reservedCashCredit = editBetReservedCredit(editBet, bookmaker, "cash");
  const reservedFreeBetCredit = editBetReservedCredit(editBet, bookmaker, "free_bet");

  const needsAddBalance =
    !stakingFreeBet &&
    bookieNeedsCashFunding(
      appState?.balances?.accounts,
      bookmaker,
      backStake,
      reservedCashCredit
    );

  const bookieFbAvailable = bookieFreeBetBalance(
    appState?.balances?.accounts,
    bookmaker,
    reservedFreeBetCredit
  );

  // Derived: the top-up option only holds while the shortfall exists.
  const effectiveAddBalance = addBalance && needsAddBalance;

  function applySelectedOffer(offerId: number | null) {
    setSelectedOfferId(offerId);
    if (offerId == null) return;
    const offer = (appState?.offers ?? []).find((o) => o.id === offerId);
    if (!offer) return;
    const rules = parseOfferRules(offer);
    const prefs = appSettings?.offerBetPrefs ?? {};
    const stake = stakeFromOfferPrefs(
      prefs,
      offerId,
      rules?.betStake,
      appSettings?.defaultBackStake ?? 10
    );
    const bookie = bookmakerFromOfferPrefs(
      prefs,
      offerId,
      offer.bookmaker,
      bookmaker
    );
    if (stake > 0) setBackStake(stake);
    if (bookie) setBookmaker(bookie);
    if (rules) {
      setTriggerText(placeRefundTriggerText(rules));
      setTriggerLinkedFromLabel(false);
    } else if (
      offer.title.trim() &&
      /\bbet\s+£?\d+/i.test(offer.title) &&
      /\b(get|gives?)\b/i.test(offer.title)
    ) {
      // Unconditional bet&get (and similar) - copy offer title into the AI trigger
      // so settlement / early-award can see the reward without place-refund rules.
      setTriggerText(offer.title.trim());
      setTriggerLinkedFromLabel(false);
    }
    if (betType !== "qualifying" && betType !== "risk_free") {
      setBetType("qualifying");
      setNoLayFreeBet(null);
    }
  }

  const backOnlyReturns = useMemo(() => {
    if (!noLay || !(backStake > 0 && backOdds > 1)) return null;
    const mode: BetMode =
      noLayFreeBet === "sr" ? "free_sr" : noLayFreeBet === "snr" ? "free_snr" : "qualifying";
    return matchedBackReturns({ mode, backStake, backOdds });
  }, [noLay, noLayFreeBet, backStake, backOdds]);

  const csParsed = parseCorrectScore(selection);
  const aiTriggerPreview = useMemo(
    () =>
      previewAiTriggersFromInput({
        triggerText,
        homeTeam: effectiveHome,
        awayTeam: effectiveAway,
      }),
    [triggerText, effectiveHome, effectiveAway]
  );

  const labelOfferTrigger = useMemo(() => offerTriggerFromLabel(label), [label]);
  const labelHasOfferTrigger = useMemo(() => offerTriggerDetectedInLabel(label), [label]);

  // Adjust-during-render: a label that implies an offer trigger keeps the
  // trigger text linked until the user edits it by hand.
  const [prevTriggerSync, setPrevTriggerSync] = useState({
    labelOfferTrigger,
    triggerText,
    triggerLinkedFromLabel,
  });
  if (
    prevTriggerSync.labelOfferTrigger !== labelOfferTrigger ||
    prevTriggerSync.triggerText !== triggerText ||
    prevTriggerSync.triggerLinkedFromLabel !== triggerLinkedFromLabel
  ) {
    setPrevTriggerSync({ labelOfferTrigger, triggerText, triggerLinkedFromLabel });
    if (labelOfferTrigger && (!triggerText.trim() || triggerLinkedFromLabel)) {
      setTriggerText(labelOfferTrigger);
      setTriggerLinkedFromLabel(true);
    }
  }

  function handleTriggerTextChange(value: string) {
    setTriggerLinkedFromLabel(false);
    setTriggerText(value);
  }

  function applyLabelOfferTrigger() {
    if (!labelOfferTrigger) return;
    setTriggerText(labelOfferTrigger);
    setTriggerLinkedFromLabel(true);
  }

  /** Black attention ring on unfilled fields (calculator hand-off) */
  const ring = (empty: boolean) =>
    highlightEmpty && empty ? "ring-2 ring-black dark:ring-white" : "";

  function applyTrackedEvent(ev: EventLite, sportOverride?: string) {
    setPendingFixture(null);
    setFetchedRunners([]);
    setRunnersFetchDone(false);
    setManualEntry(false);
    setEventId(String(ev.id));
    setHomeTeam(ev.homeTeam);
    setAwayTeam(ev.awayTeam);
    setEventName(eventDisplayName(ev));
    if (ev.startTime) {
      setEventDate(formatEventDate(ev.startTime));
      setEventTime(formatEventTime(ev.startTime));
    }
    const nextSport = sportOverride ?? ev.sport;
    if (nextSport) setSport(nextSport);
  }

  function applyPendingFixture(fixture: KnownFixtureOption) {
    setManualEntry(false);
    setFetchedRunners([]);
    // Pending fixtures already carry racecard payload (possibly empty).
    setRunnersFetchDone(true);
    setPendingFixture(fixture);
    setEventId(fixtureSelectValue(fixture.externalId));
    if (fixture.sport === "horse_racing") {
      setHomeTeam(fixture.raceName ?? fixture.homeTeam);
      setAwayTeam(fixture.offTime ?? fixture.awayTeam);
      setEventName(
        eventDisplayName({
          sport: "horse_racing",
          homeTeam: fixture.raceName ?? fixture.homeTeam,
          awayTeam: fixture.offTime ?? fixture.awayTeam,
          competition: fixture.course ?? fixture.competition,
          startTime: fixture.startTime,
        })
      );
    } else {
      setHomeTeam(fixture.homeTeam);
      setAwayTeam(fixture.awayTeam);
      setEventName(
        eventDisplayName({
          sport: "football",
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          competition: fixture.competition,
          startTime: fixture.startTime,
        })
      );
    }
    setEventDate(formatEventDate(fixture.startTime));
    setEventTime(formatEventTime(fixture.startTime));
  }

  function changeEvent(id: string) {
    if (id === "__scope_pending__") return;
    if (id === "none") {
      if (courseScopeLocked) return;
      setEventId("none");
      setPendingFixture(null);
      setFetchedRunners([]);
      setRunnersFetchDone(false);
      setManualEntry(true);
      if (sport === "horse_racing") setSelection("");
      return;
    }
    const externalId = parseFixtureSelectValue(id);
    if (externalId) {
      const fixture =
        knownFixtures.find((f) => f.externalId === externalId) ??
        (pendingFixture?.externalId === externalId ? pendingFixture : null);
      if (fixture) {
        applyPendingFixture(fixture);
        if (fixture.sport === "horse_racing") setSelection("");
      }
      return;
    }
    setManualEntry(false);
    const ev = events.find((e) => String(e.id) === id);
    if (ev) {
      applyTrackedEvent(ev);
      if ((ev.sport ?? sport) === "horse_racing") setSelection("");
    }
  }

  function changeHomeTeam(value: string) {
    setHomeTeam(value);
    if (pendingFixture) {
      setPendingFixture(null);
      setEventId("none");
    } else if (selectedEvent && !teamsMatch(value, selectedEvent.homeTeam)) {
      setEventId("none");
    }
    if (!eventName.trim() && value.trim() && awayTeam.trim()) {
      setEventName(`${value.trim()} v ${awayTeam.trim()}`);
    }
  }

  function changeAwayTeam(value: string) {
    setAwayTeam(value);
    if (pendingFixture) {
      setPendingFixture(null);
      setEventId("none");
    } else if (selectedEvent && !teamsMatch(value, selectedEvent.awayTeam)) {
      setEventId("none");
    }
    if (!eventName.trim() && homeTeam.trim() && value.trim()) {
      setEventName(`${homeTeam.trim()} v ${value.trim()}`);
    }
  }

  // Auto-link when typed teams match an event on the track list (football / tennis only)
  useEffect(() => {
    if (sport === "horse_racing") return;
    if (pendingFixture) return;
    if (manualEntry || eventId !== "none" || !homeTeam.trim() || !awayTeam.trim()) return;
    const match = findTrackedEvent(events, homeTeam, awayTeam, sport);
    if (match) applyTrackedEvent(match as EventLite);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeTeam, awayTeam, sport, events, manualEntry, pendingFixture]);

  // When dialog opens with a pre-selected event id, apply its details once events load
  useEffect(() => {
    if (!open || eventId === "none" || isFixtureSelectValue(eventId)) return;
    const ev = events.find((e) => String(e.id) === eventId);
    if (ev && !eventName) applyTrackedEvent(ev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, events, eventId]);

  // Race-scoped campaign: select the meeting race once tracked events / racecards load.
  const racePrefillKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      racePrefillKeyRef.current = null;
      return;
    }
    if (!prefill?.raceExternalId || editBet) return;
    const ext = prefill.raceExternalId;
    if (racePrefillKeyRef.current === ext) return;

    const tracked = events.find((e) => e.externalId === ext);
    if (tracked) {
      racePrefillKeyRef.current = ext;
      queueMicrotask(() => applyTrackedEvent(tracked, "horse_racing"));
      return;
    }
    const fixture = knownFixtures.find((f) => f.externalId === ext);
    if (fixture) {
      racePrefillKeyRef.current = ext;
      queueMicrotask(() => {
        setSport("horse_racing");
        if (prefill.market) setMarket(prefill.market);
        applyPendingFixture(fixture);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill?.raceExternalId, editBet, events, knownFixtures]);

  // Fetch Racing Desk odds-order for the linked race (tracked or pending fixture)
  useEffect(() => {
    if (!open || sport !== "horse_racing") {
      queueMicrotask(() => setRunnersFetchDone(false));
      return;
    }

    const trackedId =
      eventId !== "none" && !isFixtureSelectValue(eventId) ? Number(eventId) : NaN;
    const hasTrackedId = Number.isFinite(trackedId) && trackedId > 0;
    const externalId =
      pendingFixture?.externalId ??
      (hasTrackedId ? selectedEvent?.externalId : null) ??
      (isFixtureSelectValue(eventId) ? parseFixtureSelectValue(eventId) : null);

    if (!externalId && !hasTrackedId) {
      queueMicrotask(() => {
        setFetchedRunners([]);
        setRunnersFetchDone(false);
      });
      return;
    }

    const startMs = pendingFixture?.startTime ?? selectedEvent?.startTime ?? Date.now();
    const date = localCalendarDate(new Date(startMs));
    const params = new URLSearchParams({ date });
    if (hasTrackedId) params.set("eventId", String(trackedId));
    if (externalId) params.set("externalId", externalId);

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setFetchedRunners([]);
      setRunnersFetchDone(false);
    });
    api<{ runners: string[] }>(`/api/racing/runners?${params}`)
      .then((res) => {
        if (cancelled) return;
        setFetchedRunners(res.runners ?? []);
        setRunnersFetchDone(true);
      })
      .catch(() => {
        if (cancelled) return;
        setFetchedRunners([]);
        setRunnersFetchDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    sport,
    eventId,
    pendingFixture?.externalId,
    pendingFixture?.startTime,
    selectedEvent?.externalId,
    selectedEvent?.startTime,
  ]);

  function changeSport(s: string) {
    if (editBet || courseScopeLocked) return;
    setSport(s);
    const first = (MARKETS[s] ?? MARKETS.other)[0].value;
    setMarket(first);
    setSelection(defaultSelection(s, first));
    setEventId("none");
    setPendingFixture(null);
    setEventName("");
    const { date, time } = defaultEventDateTime();
    setEventDate(date);
    setEventTime(time);
    setHomeTeam("");
    setAwayTeam("");
    setManualEntry(false);
    setEarlyPayout(false);
  }

  function changeMarket(m: string) {
    setMarket(m);
    setSelection(defaultSelection(sport, m));
    if (m !== "match_odds") setEarlyPayout(false);
  }

  /** Dutch type: the builder computes stakes, this maps them into stored legs
   * (market/selection) - same convention as the Dutching calculator. */
  function handleDutchResult(
    result: { legs: Array<{ label: string; odds: number; stake: number }> } | null,
    legs: Array<DutchLeg & { bookmaker?: string; freeBet?: "snr" | "sr" }>
  ) {
    if (!result) {
      setDutchLegs(undefined);
      return;
    }
    setDutchLegs(
      legs.map((l, i) => ({
        label: l.label,
        market: "match_odds",
        selection: inferMatchOddsSelection(l.label),
        odds: l.odds,
        stake: result.legs[i]?.stake ?? 0,
        bookmaker: l.bookmaker,
        freeBet: l.freeBet,
      }))
    );
  }

  function setCorrectScore(home: number, away: number) {
    setSelection(formatCorrectScore(home, away));
  }

  /** Options that show team names instead of home/away where relevant. */
  const usesTeamLabels =
    sport === "football" &&
    currentMarket?.options?.some((o) => o === "home" || o === "away");

  const applyOcrFields = useCallback(
    async (fields: BetOcrFields, source: ScreenshotSource) => {
      if (fields.selection?.trim()) setSelection(fields.selection.trim());
      if (fields.backStake != null && fields.backStake > 0 && source === "bookie") {
        setBackStake(fields.backStake);
      }
      if (fields.backOdds != null && fields.backOdds >= 1.01 && source === "bookie") {
        setBackOdds(fields.backOdds);
      }
      if (fields.layOdds != null && fields.layOdds >= 1.01 && source === "exchange") {
        setLayOdds(fields.layOdds);
      }
      if (fields.layStake != null && fields.layStake > 0 && source === "exchange") {
        setLayStakeOverride(fields.layStake);
        setAdvanced(true);
      }
      if (fields.bookmaker?.trim() && source === "bookie") {
        setBookmaker(fields.bookmaker.trim());
      }
      if (fields.exchangeName?.trim() && source === "exchange") {
        const name = fields.exchangeName.trim().toLowerCase();
        const ex = exchanges.find((e) => e.name.toLowerCase().includes(name) || name.includes(e.name.toLowerCase()));
        if (ex) setExchange(ex);
      }
      if (fields.marketHint === "win" || fields.marketHint === "place") {
        setMarket(fields.marketHint);
        setSport("horse_racing");
      }
      if (fields.isFreeBet && source === "bookie") {
        setBetType("free_snr");
      }

      const matched =
        appSettings?.ocrAutoMatchEvents !== false
          ? matchOcrToEvent(fields, events)
          : null;
      if (matched) {
        const ev = events.find((e) => e.id === matched.eventId);
        setEventId(String(matched.eventId));
        setManualEntry(false);
        if (ev) {
          setSport(ev.sport ?? "football");
          setHomeTeam(ev.homeTeam);
          setAwayTeam(ev.awayTeam);
          if (ev.sport === "horse_racing") {
            setMarket(fields.marketHint === "place" ? "place" : "win");
          }
        }
        toast.info(`Linked to ${matched.label}`, {
          description:
            matched.confidence === "high"
              ? "Matched from screenshot"
              : "Possible match - confirm event",
        });

        if (
          ev?.sport === "horse_racing" &&
          fields.selection?.trim() &&
          appSettings?.ocrAutoMatchEvents !== false
        ) {
          try {
            const res = await api<{ runners: string[] }>(
              `/api/racing/runners?eventId=${matched.eventId}`
            );
            const runnerMatch = matchOcrToRunner(fields.selection, res.runners ?? []);
            if (runnerMatch) {
              setSelection(runnerMatch.runner);
              toast.info(`Runner: ${runnerMatch.runner}`, {
                description:
                  runnerMatch.confidence === "high"
                    ? "Matched from racecard"
                    : "Possible runner - confirm selection",
              });
            }
          } catch {
            /* racecard unavailable */
          }
        }
      } else if (fields.eventName?.trim()) {
        setEventName(fields.eventName.trim());
        setEventId("none");
        setPendingFixture(null);
        setManualEntry(true);
      }
      if (fields.eventDate?.trim()) setEventDate(fields.eventDate.trim());
      if (fields.eventTime?.trim()) setEventTime(fields.eventTime.trim());
      if (!matched && fields.homeTeam?.trim() && fields.awayTeam?.trim()) {
        setHomeTeam(fields.homeTeam.trim());
        setAwayTeam(fields.awayTeam.trim());
        setSport("football");
      } else if (!matched && fields.eventName && parseRacingCourseFromEventName(fields.eventName)) {
        setSport("horse_racing");
        if (market === "match_odds") setMarket("win");
      }
    },
    [market, exchanges, events, appSettings?.ocrAutoMatchEvents]
  );

  async function rememberOfferBetPref(offerId: number | undefined, stake: number, bookie: string) {
    if (offerId == null || !(stake > 0)) return;
    try {
      await api("/api/settings", {
        method: "PATCH",
        json: {
          offerBetPref: {
            offerId,
            stake,
            bookmaker: bookie.trim(),
          },
        },
      });
      await refreshAppState();
    } catch {
      /* non-fatal - bet already saved */
    }
  }

  async function creditBackStakeIfNeeded(bookie: string, stake: number) {
    if (!effectiveAddBalance || !(stake > 0) || !bookie.trim()) return;
    if (stakingFreeBet) return;
    const reserved = editBetReservedCredit(editBet, bookie, "cash");
    const topUp = bookieCashTopUpNeeded(
      appState?.balances?.accounts,
      bookie,
      stake,
      reserved
    );
    if (!(topUp > 0.001)) return;
    const ensured = await api<{ account: { id: number } }>("/api/accounts/ensure", {
      method: "POST",
      json: { name: bookie.trim(), kind: "bookie" },
    });
    await api("/api/balances", {
      method: "POST",
      json: {
        entries: [
          {
            accountId: ensured.account.id,
            amount: topUp,
            category: "top_up",
            note: "Add balance from Add bet",
          },
        ],
      },
    });
    await refreshAppState();
  }

  /** Resolve / create a tracked event id for save. Pending fixtures auto-track here only. */
  async function resolveEventIdForSave(): Promise<number | undefined> {
    if (pendingFixture) {
      const f = pendingFixture;
      if (f.sport === "horse_racing") {
        const tracked = await api<{ event: { id: number }; existing?: boolean }>("/api/events", {
          method: "POST",
          json: {
            sport: "horse_racing",
            homeTeam: f.raceName ?? f.homeTeam,
            awayTeam: f.offTime ?? f.awayTeam,
            competition: f.course ?? f.competition,
            startTime: f.startTime,
            source: "api",
            externalId: f.externalId,
            status: f.status,
            runners: f.runners,
          },
        });
        return tracked.event.id;
      }
      const tracked = await api<{ event: { id: number }; existing?: boolean }>("/api/events", {
        method: "POST",
        json: {
          sport: "football",
          homeTeam: f.homeTeam,
          awayTeam: f.awayTeam,
          competition: f.competition,
          startTime: f.startTime,
          source: "api",
          externalId: f.externalId,
          status: f.status,
        },
      });
      return tracked.event.id;
    }

    if (eventId !== "none" && !isFixtureSelectValue(eventId)) {
      const id = Number(eventId);
      if (Number.isFinite(id)) return id;
    }

    let resolvedEventId = editBet?.eventId ?? undefined;

    if (!resolvedEventId && sport === "horse_racing") {
      const course =
        parseRacingCourseFromEventName(eventName) ||
        homeTeam.trim() ||
        selectedEvent?.competition?.trim() ||
        "";
      const startTime = parseEventStartTime(eventDate, eventTime);
      if (course && startTime) {
        const tracked = await api<{ event: { id: number }; mode: string }>(
          "/api/events/track-racing",
          {
            method: "POST",
            json: {
              course,
              startTime,
              raceName: homeTeam.trim() || selectedEvent?.homeTeam || undefined,
            },
          }
        );
        resolvedEventId = tracked.event.id;
        if (tracked.mode === "api") {
          toast.info("Linked to race", { description: `${course} · ${eventTime}` });
        }
      }
    }

    if (!resolvedEventId && homeTeam.trim() && awayTeam.trim()) {
      const tracked = await api<{ event: { id: number }; mode: string }>("/api/events/track", {
        method: "POST",
        json: {
          homeTeam: homeTeam.trim(),
          awayTeam: awayTeam.trim(),
          sport,
          startTime: parseEventStartTime(eventDate, eventTime),
          competition: eventName.includes("·")
            ? eventName.split("·")[0]?.trim()
            : undefined,
        },
      });
      resolvedEventId = tracked.event.id;
      if (tracked.mode === "existing") {
        toast.info("Linked to tracked event", {
          description: `${homeTeam.trim()} v ${awayTeam.trim()} is already on your track list.`,
        });
      }
    }

    return resolvedEventId;
  }

  async function save() {
    if (courseScopeLocked && eventId === "none" && !pendingFixture) {
      toast.error(`Pick a ${courseScopeLabel ?? "scoped"} race for this campaign`);
      return;
    }
    if (dutchLegs?.length) {
      setSaving(true);
      try {
        const resolvedEventId = await resolveEventIdForSave();
        const payload = {
          label:
            label ||
            prefill?.labelSuggestion ||
            `Dutch · ${dutchLegs.map((l) => l.label).join(" / ")}`,
          market: dutchLegs[0]?.market ?? "match_odds",
          selection: "",
          betType: "dutch",
          bookmaker: bookmaker || prefill?.bookmaker || undefined,
          backStake: dutchLegs.reduce((a, l) => a + l.stake, 0),
          legs: dutchLegs,
          homeTeam: sport === "football" ? effectiveHome || undefined : undefined,
          awayTeam: sport === "football" ? effectiveAway || undefined : undefined,
        };
        const { bet } = editBet
          ? await api<{ bet: { id: number } }>(`/api/bets/${editBet.id}`, {
              method: "PATCH",
              json: { ...payload, eventId: resolvedEventId ?? null },
            })
          : await api<{ bet: { id: number } }>("/api/bets", {
              method: "POST",
              json: {
                ...payload,
                eventId: resolvedEventId,
                quickLogged: prefill?.quickLogged ?? undefined,
                expectedProfit: prefill?.expectedProfit,
              },
            });
        setOpen(false);
        onSaved?.(bet.id);
        if (toastOnSave) {
          toast.success(editBet ? "Bet updated" : "Bet added", {
            description: editBet ? undefined : "It's in the Profit Tracker.",
          });
        }
      } catch (e) {
        toast.error("Could not save bet", { description: String(e) });
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!preview && !noLay) {
      toast.error("Enter back stake, back odds and lay odds first");
      return;
    }
    if (noLay && !(backStake > 0 && backOdds > 1)) {
      toast.error("Enter back stake and back odds first");
      return;
    }
    if (sport === "football" && market === "correct_score" && !parseCorrectScore(selection)) {
      toast.error("Enter a valid correct score");
      return;
    }
    setSaving(true);
    try {
      const resolvedEventId = await resolveEventIdForSave();

      const resolvedBookmaker = bookmaker || prefill?.bookmaker || "";
      const resolvedOfferId =
        selectedOfferId ?? prefill?.offerId ?? editBet?.offerId ?? undefined;

      await creditBackStakeIfNeeded(resolvedBookmaker, backStake);

      const payload = {
        label:
          label ||
          prefill?.labelSuggestion ||
          `${currentMarket?.label ?? market} ${selection}`.trim(),
        eventId: resolvedEventId ?? null,
        // Boost Place bet may leave market unset until the user picks a sport.
        market: market || "other",
        selection: selection || "",
        betType: noLay
          ? noLaySaveBetType(noLayFreeBet)
          : isBoost
            ? "boost"
            : calcBetType,
        bookmaker: resolvedBookmaker || undefined,
        // POST rejects null (optional-only); PATCH needs null to CLEAR the
        // exchange link when a laid bet is edited into a no-lay bet.
        exchangeId: noLay ? (editBet ? null : undefined) : exchange?.id ?? null,
        homeTeam: sport === "football" ? effectiveHome || undefined : undefined,
        awayTeam: sport === "football" ? effectiveAway || undefined : undefined,
        backStake,
        backOdds,
        layStake: noLay ? 0 : Number(preview!.totalLayStake.toFixed(2)),
        layOdds: noLay ? 0 : Number(preview!.effectiveLayOdds.toFixed(3)),
        commission: commission / 100,
        earlyPayout,
        triggerText: triggerText.trim() || prefill?.triggerText || undefined,
        purpose: mugBet ? "mug" : editBet?.purpose === "mug" ? null : undefined,
        expectedProfit: noLay ? undefined : Number(preview!.guaranteed.toFixed(2)),
        notes: prefill?.notes ?? (!noLay && exchange ? `Exchange: ${exchange.name}` : undefined),
        offerId: resolvedOfferId,
        quickLogged: prefill?.quickLogged ?? undefined,
        ...(editBet || prefill?.boostDiaryId == null
          ? {}
          : { boostDiaryId: prefill.boostDiaryId }),
      };

      if (editBet) {
        const { bet } = await api<{ bet: { id: number } }>(`/api/bets/${editBet.id}`, {
          method: "PATCH",
          json: payload,
        });
        await rememberOfferBetPref(resolvedOfferId, backStake, resolvedBookmaker);
        setOpen(false);
        onSaved?.(bet.id);
        if (toastOnSave) {
          toast.success("Bet updated");
        }
      } else {
        const { bet } = await api<{ bet: { id: number } }>("/api/bets", {
          method: "POST",
          json: { ...payload, eventId: resolvedEventId },
        });
        await rememberOfferBetPref(resolvedOfferId, backStake, resolvedBookmaker);
        if (resolvedOfferId != null) completeEffort(resolvedOfferId);
        setOpen(false);
        onSaved?.(bet.id);
        if (toastOnSave) {
          toast.success(isBoost ? "Boost bet added" : "Bet added", {
            description: "It's in the Profit Tracker.",
          });
        }
      }
    } catch (e) {
      toast.error("Could not save bet", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editBet) return;
    setSaving(true);
    try {
      await api(`/api/bets/${editBet.id}`, { method: "DELETE" });
      setOpen(false);
      onDeleted?.();
      toast.success("Bet deleted");
    } catch (e) {
      toast.error("Delete failed", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent
        className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[820px]"
        onFocusOutside={preventDialogDismissOnPortaledContent}
        onPointerDownOutside={preventDialogDismissOnPortaledContent}
        onInteractOutside={preventDialogDismissOnPortaledContent}
      >
        <DialogHeader className="border-b px-6 pb-4 pt-7">
          <DialogTitle className="text-[25px] font-extrabold tracking-tight">
            {editBet ? "Edit bet" : "Add bet"}
          </DialogTitle>
          <DialogDescription>
            {editBet
              ? "Update the bet details or delete it from your log."
              : "Link it to an event and the result engine settles it for you."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-y-auto sm:grid-cols-2 sm:divide-x">
          {/* Left - event & market details */}
          <div className="flex flex-col gap-3 p-6">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Label</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder={prefill?.labelSuggestion ?? "e.g. Bet365 £10 free bet"}
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className={cn(ring(!label.trim()), labelHasOfferTrigger && "pr-9")}
                  />
                  {labelHasOfferTrigger ? (
                  <button
                    type="button"
                    onClick={applyLabelOfferTrigger}
                    className={cn(
                      "absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 transition-colors",
                      triggerLinkedFromLabel && triggerText === labelOfferTrigger
                        ? "text-violet-600 dark:text-violet-400"
                        : "text-violet-500/70 hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-400"
                    )}
                    title="Offer detected in label — click to apply to Offer trigger"
                    aria-label="Apply offer trigger from label"
                  >
                    <Sparkles className="size-4" />
                  </button>
                  ) : null}
                </div>
                {!dutchLegs?.length && (
                  <BetImportDialog
                    key={String(prefill?.autoOpenImport ?? false)}
                    onApply={applyOcrFields}
                    defaultOpen={prefill?.autoOpenImport}
                  />
                )}
              </div>
              {labelHasOfferTrigger && !triggerText.trim() ? (
                <p className="text-[10px] text-violet-700 dark:text-violet-300">
                  Offer phrase detected — applying to Offer trigger.
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Sport</Label>
                <Select
                  value={sport || undefined}
                  onValueChange={changeSport}
                  disabled={!!editBet || courseScopeLocked}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select sport" />
                  </SelectTrigger>
                  <SelectContent>
                    {SPORTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <SportLabel sport={s.value} size={14} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {courseScopeLocked ? (
                  <span className="text-[10px] leading-tight text-muted-foreground">
                    Locked to horse racing for this campaign.
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Bet type
                  {bookieFbAvailable > 0.001 ? (
                    <span
                      className="inline-flex items-center gap-0.5 rounded bg-violet-600/15 px-1 py-0.5 text-[10px] font-semibold text-violet-800 dark:text-violet-200"
                      title={`£${bookieFbAvailable.toFixed(2)} free bet on ${bookmaker || "this bookie"}`}
                    >
                      <Gift className="size-3" aria-hidden />
                      £{bookieFbAvailable.toFixed(0)}
                    </span>
                  ) : null}
                </Label>
                <Select
                  value={betType}
                  onValueChange={(v) => {
                    const next = v as UiBetType;
                    setBetType(next);
                    // Leaving Dutch clears the legs so the plain back/lay
                    // panels become the save-path source of truth again.
                    if (next !== "dutch") setDutchLegs(undefined);
                    // Free-bet funding overlay only applies while No lay is selected.
                    if (next !== "no_lay") setNoLayFreeBet(null);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      <span className="flex items-center gap-1.5">
                        {isBoost ? (
                          <Zap className="size-3.5 shrink-0 text-primary" aria-hidden />
                        ) : isFreeBetBetType(calcBetType) || bookieFbAvailable > 0.001 ? (
                          <Gift
                            className={cn(
                              "size-3.5 shrink-0",
                              isFreeBetBetType(calcBetType)
                                ? "text-violet-600 dark:text-violet-400"
                                : "text-violet-600/70 dark:text-violet-400/70"
                            )}
                            aria-hidden
                          />
                        ) : null}
                        {betTypeLabels[betType]}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(betTypeLabels) as UiBetType[]).map((m) => (
                      <SelectItem key={m} value={m}>
                        <span className="flex items-center gap-1.5">
                          {m === "boost" ? (
                            <Zap className="size-3.5 shrink-0 text-primary" aria-hidden />
                          ) : null}
                          {(m === "free_snr" || m === "free_sr") &&
                          bookieFbAvailable > 0.001 ? (
                            <Gift
                              className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400"
                              aria-hidden
                            />
                          ) : null}
                          {betTypeLabels[m]}
                          {(m === "free_snr" || m === "free_sr") &&
                          bookieFbAvailable > 0.001 ? (
                            <span className="text-[10px] font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                              £{bookieFbAvailable.toFixed(2)}
                            </span>
                          ) : null}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                {courseScopeLocked ? `Events · ${courseScopeLabel}` : "Events"}
              </Label>
              <Select
                value={courseScopeLocked && eventId === "none" ? "__scope_pending__" : eventId}
                onValueChange={changeEvent}
              >
                <SelectTrigger
                  className={cn(
                    "w-full",
                    ring(!!highlightEmpty && courseScopeLocked && eventId === "none" && !pendingFixture)
                  )}
                >
                  <SelectValue
                    placeholder={
                      courseScopeLocked
                        ? `Select a ${courseScopeLabel} race`
                        : "Select an event"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {courseScopeLocked ? (
                    <SelectItem value="__scope_pending__" disabled>
                      Select a {courseScopeLabel} race
                    </SelectItem>
                  ) : (
                    <SelectItem value="none">Manual entry</SelectItem>
                  )}
                  {trackedDayBands.length > 0 && (
                    <>
                      {!courseScopeLocked ? <SelectSeparator /> : null}
                      <SelectGroup className="p-0">
                        <SelectLabel className="text-foreground">Tracked</SelectLabel>
                        {trackedDayBands.map((band, bandIdx) => (
                          <Fragment key={`tracked-${band.key}`}>
                            {bandIdx > 0 ? <SelectSeparator /> : null}
                            <SelectLabel>{band.label}</SelectLabel>
                            {band.items.map((e) => (
                              <SelectItem key={e.id} value={String(e.id)}>
                                <span className="flex items-center gap-2">
                                  <SportIcon
                                    sport={e.sport}
                                    size={14}
                                    className="text-muted-foreground"
                                  />
                                  {formatTrackedEventOption(e)}
                                </span>
                              </SelectItem>
                            ))}
                          </Fragment>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                  {notTrackedDayBands.length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup className="p-0">
                        <SelectLabel className="text-foreground">Not tracked</SelectLabel>
                        {notTrackedDayBands.map((band, bandIdx) => (
                          <Fragment key={`not-tracked-${band.key}`}>
                            {bandIdx > 0 ? <SelectSeparator /> : null}
                            <SelectLabel>{band.label}</SelectLabel>
                            {band.items.map((f) => (
                              <SelectItem
                                key={f.externalId}
                                value={fixtureSelectValue(f.externalId)}
                              >
                                <span className="flex items-center gap-2">
                                  <SportIcon
                                    sport={f.sport}
                                    size={14}
                                    className="text-muted-foreground"
                                  />
                                  {formatKnownFixtureOption(f)}
                                </span>
                              </SelectItem>
                            ))}
                          </Fragment>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
              {courseScopeLocked ? (
                <span className="text-[10px] leading-tight text-muted-foreground">
                  Limited to {courseScopeLabel} races for this campaign.
                </span>
              ) : null}
              {trackedDayBands.length === 0 && notTrackedDayBands.length === 0 && (
                <span className="text-[10px] leading-tight text-muted-foreground">
                  {courseScopeLocked
                    ? `No ${courseScopeLabel} races loaded yet for this day.`
                    : "No events loaded. Track one on Tracked Events, or enter details below."}
                </span>
              )}
              {selectedEvent && effectiveEventStatus(selectedEvent) === "live" && (
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-500">
                  {liveEventInlineLabel(selectedEvent)}
                </span>
              )}
            </div>
            {!courseScopeLocked || eventLinked ? (
              <>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Event name</Label>
              <Input
                placeholder={
                  sport === "horse_racing"
                    ? "e.g. Galway · 14:30 Handicap"
                    : sport === "football"
                      ? "e.g. Premier League · Arsenal v Liverpool"
                      : "e.g. Event name"
                }
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                readOnly={courseScopeLocked}
                className={ring(!!highlightEmpty && !eventName.trim() && eventId === "none")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Date</Label>
                <DatePicker
                  value={eventDate}
                  onChange={(date) => {
                    if (courseScopeLocked) return;
                    setEventDate(date);
                    if (eventId !== "none") {
                      setEventId("none");
                      setPendingFixture(null);
                    }
                  }}
                  disabled={courseScopeLocked}
                  className={ring(!!highlightEmpty && !eventDate && eventId === "none")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Time</Label>
                <EventTimeInput
                  value={eventTime}
                  onChange={(time) => {
                    if (courseScopeLocked) return;
                    setEventTime(time);
                    if (eventId !== "none") {
                      setEventId("none");
                      setPendingFixture(null);
                    }
                  }}
                  disabled={courseScopeLocked}
                  placeholder="Pick a time"
                  className={ring(!!highlightEmpty && !eventTime && eventId === "none")}
                />
              </div>
            </div>
              </>
            ) : null}
            {sport === "horse_racing" &&
              matchingOffers.length > 0 &&
              !stakingFreeBet && (
              <div className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5 dark:bg-input/25">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Gift className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <Label className="text-xs font-semibold text-foreground">
                    Qualifying offer
                    {matchingOffers.length > 1 ? "s" : ""}
                  </Label>
                </div>
                <p className="mb-2 text-[10px] leading-snug text-muted-foreground">
                  Race matches {matchingOffers.length === 1 ? "an offer" : "offers"}
                  {bookmaker.trim() ? ` for ${bookmaker}` : ""} - select to set stake & trigger.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {matchingOffers.map((offer) => {
                    const rules = parseOfferRules(offer);
                    const selected = selectedOfferId === offer.id;
                    return (
                      <button
                        key={offer.id}
                        type="button"
                        onClick={() =>
                          applySelectedOffer(selected ? null : offer.id)
                        }
                        className={cn(
                          "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-left text-[11px] font-semibold transition-colors",
                          selected
                            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200"
                            : "border-border/80 bg-card text-foreground hover:border-foreground/25"
                        )}
                      >
                        {offer.bookmaker ? (
                          <VenueBadge name={offer.bookmaker} className="scale-90" />
                        ) : null}
                        <span className="min-w-0 truncate">{offer.title}</span>
                        {rules?.betStake != null ? (
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            £{rules.betStake}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {sport === "football" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Home team</Label>
                  <Input
                    placeholder="e.g. Arsenal"
                    value={homeTeam}
                    onChange={(e) => changeHomeTeam(e.target.value)}
                    className={ring(!!highlightEmpty && !homeTeam.trim())}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">Away team</Label>
                  <Input
                    placeholder="e.g. Liverpool"
                    value={awayTeam}
                    onChange={(e) => changeAwayTeam(e.target.value)}
                    className={ring(!!highlightEmpty && !awayTeam.trim())}
                  />
                </div>
              </div>
            )}
            {isDutch ? (
              <p className="text-[10px] leading-tight text-muted-foreground">
                {sport === "football"
                  ? "Home/away teams link this match so it can be tracked and auto-settled - they don't relabel the outcomes on the right, which settle by whichever label says home, draw or away."
                  : "Each outcome settles automatically from the score (home/draw/away, by label) - link the event above for that to work."}
              </p>
            ) : (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Market</Label>
              <Select
                value={market || undefined}
                onValueChange={changeMarket}
                disabled={!sport}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={sport ? "Select market" : "Select sport first"} />
                </SelectTrigger>
                <SelectContent>
                  {markets.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-[10px] leading-tight text-muted-foreground">
                {!sport
                  ? "Pick a sport to choose the market"
                  : currentMarket?.auto
                    ? "Settles automatically from the score"
                    : "Manual settle, or use a win trigger below"}
              </span>
            </div>
            )}
          </div>

          {/* Right - back/lay & triggers */}
          <div className="flex flex-col gap-3 p-6">
            {isDutch ? (
              <DutchOutcomesBuilder
                key={editBet?.id ?? "new"}
                title="Outcomes"
                initialLegs={dutchLegs?.map((l) => ({
                  label: l.label,
                  odds: l.odds,
                  stake: l.stake,
                  bookmaker: l.bookmaker,
                  freeBet: l.freeBet,
                }))}
                onResult={handleDutchResult}
              />
            ) : (
              <>
            <BackPanel
              title="Back Bet"
              exchange={exchange}
              venue={bookmaker}
              chip={
                <BookmakerSelect
                  value={bookmaker}
                  onChange={setBookmaker}
                  className="[--pi:var(--panel)] [--pi-dark:var(--panel-dark)]"
                />
              }
            >
              {market === "correct_score" && sport === "football" ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-black/60 dark:text-white/70">
                    Selection
                  </span>
                  <div className="flex h-11 items-center gap-2 rounded-md bg-[var(--pi)] px-3 dark:bg-[var(--pi-dark)]">
                    <span
                      className="min-w-0 flex-1 truncate text-sm font-bold text-black/85 dark:text-white/95"
                      title={effectiveHome || "Home"}
                    >
                      {effectiveHome || "Home"}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={csParsed ? csParsed.home : ""}
                      placeholder="0"
                      onChange={(e) =>
                        setCorrectScore(Number(e.target.value) || 0, csParsed?.away ?? 0)
                      }
                      className={cn(
                        "h-8 w-12 shrink-0 rounded border-0 bg-black/10 px-1 text-center text-base font-bold tabular-nums text-black/85 outline-none focus:ring-2 focus:ring-primary/40 dark:bg-white/10 dark:text-white/95",
                        ring(!csParsed)
                      )}
                    />
                    <span className="shrink-0 font-bold text-black/50 dark:text-white/50">–</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={csParsed ? csParsed.away : ""}
                      placeholder="0"
                      onChange={(e) =>
                        setCorrectScore(csParsed?.home ?? 0, Number(e.target.value) || 0)
                      }
                      className={cn(
                        "h-8 w-12 shrink-0 rounded border-0 bg-black/10 px-1 text-center text-base font-bold tabular-nums text-black/85 outline-none focus:ring-2 focus:ring-primary/40 dark:bg-white/10 dark:text-white/95",
                        ring(!csParsed)
                      )}
                    />
                    <span
                      className="min-w-0 flex-1 truncate text-right text-sm font-bold text-black/85 dark:text-white/95"
                      title={effectiveAway || "Away"}
                    >
                      {effectiveAway || "Away"}
                    </span>
                  </div>
                </div>
              ) : lockRaceSelection ? (
                <PanelIconSelect
                  label="Selection"
                  value={selection}
                  onChange={setSelection}
                  sport={sport}
                  placeholder={useRaceRunnerSelect ? "Select runner" : "Loading runners…"}
                  selectClassName={ring(!selection.trim())}
                  options={raceRunnerOptions.map((runner) => ({
                    value: runner,
                    label: capitaliseSelectionLabel(runner),
                  }))}
                />
              ) : currentMarket?.options ? (
                <PanelIconSelect
                  label="Selection"
                  value={selection}
                  onChange={setSelection}
                  sport={sport}
                  selectClassName={ring(!selection.trim())}
                  options={currentMarket.options.map((option) => ({
                    value: option,
                    label: usesTeamLabels
                      ? teamSelectionLabel(option, effectiveHome, effectiveAway)
                      : capitaliseSelectionLabel(option),
                  }))}
                />
              ) : (
                <PanelTextInput
                  label="Selection"
                  value={selection}
                  onChange={setSelection}
                  placeholder={
                    sport === "horse_racing" ? "e.g. Constitution Hill" : "e.g. Harry Kane"
                  }
                  inputClassName={ring(!selection.trim())}
                />
              )}
              <BackBookieBalanceStrip
                bookmaker={bookmaker}
                betType={calcBetType}
                backStake={backStake}
                accounts={appState?.balances?.accounts}
                reservedCredit={
                  stakingFreeBet ? reservedFreeBetCredit : reservedCashCredit
                }
                usingFreeBet={noLay && noLayFreeBet != null}
                addBalance={effectiveAddBalance}
                onAddBalanceChange={needsAddBalance ? setAddBalance : undefined}
                onUseFreeBet={(amount) => {
                  if (noLay) {
                    // Stay in No lay; stake from free-bet balance (SNR default).
                    setNoLayFreeBet((prev) => prev ?? "snr");
                    setMugBet(false);
                  } else if (!isFreeBetBetType(calcBetType)) {
                    // Qualifying / risk-free cannot stake FB - switch into SNR mode.
                    setBetType("free_snr");
                  }
                  setBackStake(amount);
                  setAddBalance(false);
                }}
                onUseCash={
                  noLay && noLayFreeBet != null
                    ? () => {
                        setNoLayFreeBet(null);
                      }
                    : undefined
                }
              />
              {stakingFreeBet && bookieFbAvailable > 0.001 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBackStake(bookieFbAvailable)}
                    className="rounded-full border border-violet-500/35 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-900 dark:text-violet-200"
                  >
                    Use £{bookieFbAvailable.toFixed(2)} available
                  </button>
                  {noLay && noLayFreeBet != null ? (
                    <div className="flex h-7 overflow-hidden rounded-full text-[11px] font-semibold">
                      {(["snr", "sr"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNoLayFreeBet(t)}
                          className={cn(
                            "h-full px-2.5 uppercase",
                            noLayFreeBet === t
                              ? "bg-violet-600/25 text-violet-950 dark:bg-violet-500/30 dark:text-violet-100"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <PanelInput
                  label={stakingFreeBet ? "Free bet stake" : "Back stake"}
                  prefix="£"
                  value={backStake}
                  onChange={setBackStake}
                  min={0}
                  placeholder="10.00"
                  inputClassName={cn(
                    ring(!(backStake > 0)),
                    stakingFreeBet &&
                      "bg-violet-500/10 ring-violet-500/30 focus:ring-violet-500/45 dark:bg-violet-500/15"
                  )}
                />
                <PanelInput
                  label="Back odds (decimal)"
                  value={backOdds}
                  onChange={setBackOdds}
                  min={1}
                  placeholder="3.00"
                  inputClassName={ring(!(backOdds > 1))}
                />
              </div>
            </BackPanel>

            {!noLay && (
            <LayPanel
              title="Lay Bet"
              exchange={exchange}
              chip={
                <span className="flex items-center gap-2.5">
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
              <div className="grid grid-cols-2 gap-3">
                <ExchangeSelect
                  onPanel
                  exchanges={exchanges}
                  value={exchange}
                  onChange={setExchange}
                  showCommission
                />
                <PanelInput
                  label="Lay odds (decimal)"
                  value={layOdds}
                  onChange={setLayOdds}
                  min={1}
                  placeholder="3.10"
                  inputClassName={ring(!(layOdds > 1))}
                  exchangeOddsStepping
                />
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
                    Enter back stake, back odds and lay odds to unlock part lays and the
                    underlay/overlay slider.
                  </p>
                ))}
              <LayStakeBanner
                value={layStake}
                fillSelection={selection || label}
                onChange={(v) =>
                  setLayStakeOverride(Number.isFinite(v) && v >= 0 ? v : null)
                }
              />
            </LayPanel>
            )}

            {(betType === "qualifying" || (betType === "no_lay" && !noLayFreeBet)) && (
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Mug bet (camouflage)</div>
                  <div className="text-xs text-muted-foreground">
                    Real money, but excluded from every edge metric - keeps the account
                    looking human
                  </div>
                </div>
                <Switch checked={mugBet} onCheckedChange={setMugBet} />
              </div>
            )}

            {market === "match_odds" && (
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <div className="text-sm font-medium">2UP early payout</div>
                  <div className="text-xs text-muted-foreground">
                    Bookie pays out when the selection goes 2 goals ahead
                  </div>
                </div>
                <Switch checked={earlyPayout} onCheckedChange={setEarlyPayout} />
              </div>
            )}

            {!isBoost ? (
              <BetOfferTriggerField
                value={triggerText}
                onChange={handleTriggerTextChange}
                preview={aiTriggerPreview}
                needsEventLink={
                  aiTriggerPreview.recognised &&
                  aiTriggerPreview.lines.some((l) => l.includes("if selection finishes")) &&
                  eventId === "none" &&
                  !selection.trim()
                }
                needsTeamNames={
                  aiTriggerPreview.lines.some((l) => l.includes("settles the bet")) &&
                  eventId === "none" &&
                  !effectiveHome
                }
              />
            ) : null}
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t">
          {!isDutch && (
          <div className="px-6 pt-4 pb-2">
            {noLay ? (
              <div className="overflow-hidden rounded-lg border text-sm">
                <div className="flex items-center justify-between border-b px-4 py-2.5">
                  <span className="text-muted-foreground">If the bet wins</span>
                  <MoneyFlow
                    value={backOnlyReturns?.win ?? 0}
                    signColor
                    signDisplay
                    className="text-[15px] font-semibold"
                  />
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">If it loses</span>
                  <MoneyFlow
                    value={backOnlyReturns?.lose ?? 0}
                    signColor
                    signDisplay
                    className="text-[15px] font-semibold"
                  />
                </div>
              </div>
            ) : (
            <ProfitTable
              rows={outcomeRows}
              guaranteed={preview?.guaranteed ?? 0}
              exchange={exchange}
              venue={bookmaker}
              totalLabel={
                betType === "qualifying"
                  ? advanced
                    ? "Worst case"
                    : "Qualifying loss"
                  : advanced
                    ? "Worst case"
                    : "Total profit"
              }
            />
            )}
          </div>
          )}
          <div className="flex justify-end gap-2 px-6 pb-4 pt-2">
          {editBet && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={remove}
              disabled={saving}
              aria-label="Delete bet"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button onClick={save} disabled={saving || (!dutchLegs?.length && !preview && !(noLay && backStake > 0 && backOdds > 1))} className={cn("min-w-36", !dutchLegs?.length && !noLay && ring(!preview))}>
            {editBet ? "Save changes" : "Save bet"}
          </Button>
          </div>
        </div>
        <div
          data-dialog-overlay-portal
          className="pointer-events-none absolute inset-0 z-[200] overflow-visible"
          aria-hidden
        />
      </DialogContent>
    </Dialog>
  );
}