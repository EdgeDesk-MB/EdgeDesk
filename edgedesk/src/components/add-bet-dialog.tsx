"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AdvancedLaySection } from "@/components/calc/advanced-lay";
import { BackBookieBalanceStrip, bookieFreeBetBalance, bookieNeedsCashFunding, isFreeBetBetType } from "@/components/add-bet/back-bookie-balance-strip";
import { BookmakerSelect } from "@/components/calc/bookmaker-select";
import { VenueBadge } from "@/components/venue-badge";
import {
  BackPanel,
  LayPanel,
  LayStakeBanner,
  PanelInput,
  PanelSelect,
  PanelTextInput,
  ProfitTable,
} from "@/components/calc/bet-panels";
import { ExchangeSelect } from "@/components/calc/exchange-select";
import { api } from "@/hooks/use-app-state";
import { useAppState } from "@/hooks/use-app-state";
import { useExchanges } from "@/hooks/use-exchanges";
import {
  layBounds,
  layPlanOutcome,
  executableLayStake,
  offerTriggerDetectedInLabel,
  offerTriggerFromLabel,
  previewAiTriggersFromInput,
  type BetMode,
  type PartLay,
} from "@/lib/calc";
import { contrastText } from "@/lib/brands/exchanges";
import { defaultSelection, formatCorrectScore, inferSportFromBet, marketDef, MARKETS, parseCorrectScore, SPORTS, teamSelectionLabel } from "@/lib/markets";
import type { BetRow, ExchangeRow } from "@/lib/db/schema";
import {
  defaultEventDateTime,
  effectiveEventStatus,
  eventDisplayName,
  findTrackedEvent,
  formatEventDate,
  formatEventTime,
  formatTrackedEventOption,
  parseEventStartTime,
  parseRacingCourseFromEventName,
  sortTrackedEvents,
  teamsMatch,
  type TrackedEventLike,
} from "@/lib/events";
import {
  offerMatchesBetContext,
  parseOfferRules,
  placeRefundTriggerText,
} from "@/lib/offers/racing-offer-rules";
import {
  bookmakerFromOfferPrefs,
  stakeFromOfferPrefs,
} from "@/lib/services/settings-shared";
import { liveEventInlineLabel } from "@/components/events/live-event-status";
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
  betType?: BetMode;
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
  earlyPayout?: boolean;
  /** Dutching calculator: saved as betType dutch with legs on POST */
  dutchLegs?: Array<{
    label: string;
    market: string;
    selection: string;
    odds: number;
    stake: number;
    earlyPayout?: boolean;
  }>;
  expectedProfit?: number;
  notes?: string;
  offerId?: number;
  triggerText?: string;
}

const betTypeLabels: Record<BetMode, string> = {
  qualifying: "Qualifying",
  free_snr: "Free bet (SNR)",
  free_sr: "Free bet (SR)",
  risk_free: "Risk-free",
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
  const [betType, setBetType] = useState<BetMode>("qualifying");
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
  }

  // Refresh tracked-events list and default date/time when the dialog opens
  useEffect(() => {
    if (!open) {
      hydratedKeyRef.current = null;
      resetFormState();
      return;
    }
    api<{ events: EventLite[] }>("/api/events")
      .then((r) => setFetchedEvents(r.events))
      .catch(() => {});
    if (editBet) return;
    const { date, time } = defaultEventDateTime();
    queueMicrotask(() => {
      if (eventId === "none") {
        setEventDate(date);
        setEventTime(time);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editBet?.id]);

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
      setBetType(editBet.betType as BetMode);
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
      if (prefill.labelSuggestion && !prefill.label) setLabel(prefill.labelSuggestion);
      if (prefill.label !== undefined) setLabel(prefill.label);
      if (prefill.betType) setBetType(prefill.betType);
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
      setExchange(ex);
      exchangeHydratedRef.current = true;
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
    if (!(backStake > 0 && backOdds > 1 && layOdds > 1)) return null;
    return {
      mode: betType,
      backStake,
      backOdds,
      layOdds,
      commission: commission / 100,
      partLays: advanced ? partLays.filter((p) => p.odds > 1 && p.stake > 0) : [],
    };
  }, [betType, backStake, backOdds, layOdds, commission, advanced, partLays]);

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

  const trackedEvents = useMemo(() => {
    const base = events.filter(
      (e) => (e.sport ?? "football") === sport && e.status !== "finished"
    );
    const linkedId = editBet?.eventId ?? (eventId !== "none" ? Number(eventId) : null);
    if (linkedId && !base.some((e) => e.id === linkedId)) {
      const linked = events.find((e) => e.id === linkedId);
      if (linked && (linked.sport ?? "football") === sport) {
        return sortTrackedEvents([linked, ...base]);
      }
    }
    return sortTrackedEvents(base);
  }, [events, sport, editBet?.eventId, eventId]);
  const selectedEvent = events.find((e) => String(e.id) === eventId);
  const effectiveHome = homeTeam.trim() || selectedEvent?.homeTeam || "";
  const effectiveAway = awayTeam.trim() || selectedEvent?.awayTeam || "";

  const raceCourseForOffers = useMemo(() => {
    if (sport !== "horse_racing") return "";
    return (
      parseRacingCourseFromEventName(eventName) ||
      selectedEvent?.competition?.trim() ||
      homeTeam.trim() ||
      ""
    );
  }, [sport, eventName, selectedEvent?.competition, homeTeam]);

  const matchingOffers = useMemo(() => {
    if (sport !== "horse_racing") return [];
    const offers = appState?.offers ?? [];
    const course = raceCourseForOffers || null;
    const raceExternalId = selectedEvent?.externalId ?? null;
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
    eventDate,
    eventTime,
    bookmaker,
  ]);

  const needsAddBalance =
    !isFreeBetBetType(betType) &&
    bookieNeedsCashFunding(appState?.balances?.accounts, bookmaker, backStake);

  const bookieFbAvailable = bookieFreeBetBalance(
    appState?.balances?.accounts,
    bookmaker
  );

  useEffect(() => {
    if (!needsAddBalance && addBalance) setAddBalance(false);
  }, [needsAddBalance, addBalance]);

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
    }
    if (betType !== "qualifying" && betType !== "risk_free") setBetType("qualifying");
  }

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

  useEffect(() => {
    if (!labelOfferTrigger) return;
    if (!triggerText.trim() || triggerLinkedFromLabel) {
      setTriggerText(labelOfferTrigger);
      setTriggerLinkedFromLabel(true);
    }
  }, [labelOfferTrigger, triggerText, triggerLinkedFromLabel]);

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

  function changeEvent(id: string) {
    if (id === "none") {
      setEventId("none");
      setManualEntry(true);
      return;
    }
    setManualEntry(false);
    const ev = events.find((e) => String(e.id) === id);
    if (ev) applyTrackedEvent(ev);
  }

  function changeHomeTeam(value: string) {
    setHomeTeam(value);
    if (selectedEvent && !teamsMatch(value, selectedEvent.homeTeam)) setEventId("none");
    if (!eventName.trim() && value.trim() && awayTeam.trim()) {
      setEventName(`${value.trim()} v ${awayTeam.trim()}`);
    }
  }

  function changeAwayTeam(value: string) {
    setAwayTeam(value);
    if (selectedEvent && !teamsMatch(value, selectedEvent.awayTeam)) setEventId("none");
    if (!eventName.trim() && homeTeam.trim() && value.trim()) {
      setEventName(`${homeTeam.trim()} v ${value.trim()}`);
    }
  }

  // Auto-link when typed teams match an event on the track list (football / tennis only)
  useEffect(() => {
    if (sport === "horse_racing") return;
    if (manualEntry || eventId !== "none" || !homeTeam.trim() || !awayTeam.trim()) return;
    const match = findTrackedEvent(events, homeTeam, awayTeam, sport);
    if (match) applyTrackedEvent(match as EventLite);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeTeam, awayTeam, sport, events, manualEntry]);

  // When dialog opens with a pre-selected event id, apply its details once events load
  useEffect(() => {
    if (!open || eventId === "none") return;
    const ev = events.find((e) => String(e.id) === eventId);
    if (ev && !eventName) applyTrackedEvent(ev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, events, eventId]);

  function changeSport(s: string) {
    if (editBet) return;
    setSport(s);
    const first = (MARKETS[s] ?? MARKETS.other)[0].value;
    setMarket(first);
    setSelection(defaultSelection(s, first));
    setEventId("none");
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
    if (!addBalance || !(stake > 0) || !bookie.trim()) return;
    if (isFreeBetBetType(betType)) return;
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
            amount: stake,
            category: "top_up",
            note: "Add balance from Add bet",
          },
        ],
      },
    });
    await refreshAppState();
  }

  async function save() {
    if (dutchLegs?.length) {
      setSaving(true);
      try {
        const totalStake = dutchLegs.reduce((a, l) => a + l.stake, 0);
        let resolvedEventId = eventId !== "none" ? Number(eventId) : undefined;
        if (!resolvedEventId && homeTeam.trim() && awayTeam.trim()) {
          const tracked = await api<{ event: { id: number } }>("/api/events/track", {
            method: "POST",
            json: {
              homeTeam: homeTeam.trim(),
              awayTeam: awayTeam.trim(),
              sport,
              startTime: parseEventStartTime(eventDate, eventTime),
            },
          });
          resolvedEventId = tracked.event.id;
        }
        const { bet } = await api<{ bet: { id: number } }>("/api/bets", {
          method: "POST",
          json: {
            label:
              label ||
              prefill?.labelSuggestion ||
              `Dutch · ${dutchLegs.map((l) => l.label).join(" / ")}`,
            eventId: resolvedEventId,
            market: dutchLegs[0]?.market ?? "match_odds",
            selection: "",
            betType: "dutch",
            bookmaker: bookmaker || prefill?.bookmaker || undefined,
            backStake: totalStake,
            legs: dutchLegs,
            expectedProfit: prefill?.expectedProfit,
            homeTeam: sport === "football" ? effectiveHome || undefined : undefined,
            awayTeam: sport === "football" ? effectiveAway || undefined : undefined,
          },
        });
        setOpen(false);
        onSaved?.(bet.id);
        if (toastOnSave) {
          toast.success("Bet added", { description: "It's in the Profit Tracker." });
        }
      } catch (e) {
        toast.error("Could not save bet", { description: String(e) });
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!preview) {
      toast.error("Enter back stake, back odds and lay odds first");
      return;
    }
    if (sport === "football" && market === "correct_score" && !parseCorrectScore(selection)) {
      toast.error("Enter a valid correct score");
      return;
    }
    setSaving(true);
    try {
      let resolvedEventId =
        eventId !== "none" ? Number(eventId) : editBet?.eventId ?? undefined;
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
        market,
        selection,
        betType,
        bookmaker: resolvedBookmaker || undefined,
        exchangeId: exchange?.id ?? null,
        homeTeam: sport === "football" ? effectiveHome || undefined : undefined,
        awayTeam: sport === "football" ? effectiveAway || undefined : undefined,
        backStake,
        backOdds,
        layStake: Number(preview.totalLayStake.toFixed(2)),
        layOdds: Number(preview.effectiveLayOdds.toFixed(3)),
        commission: commission / 100,
        earlyPayout,
        triggerText: triggerText.trim() || prefill?.triggerText || undefined,
        expectedProfit: Number(preview.guaranteed.toFixed(2)),
        notes: prefill?.notes ?? (exchange ? `Exchange: ${exchange.name}` : undefined),
        offerId: resolvedOfferId,
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
        setOpen(false);
        onSaved?.(bet.id);
        if (toastOnSave) {
          toast.success("Bet added", { description: "It's in the Profit Tracker." });
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
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground">Label</Label>
                {!dutchLegs?.length && <BetImportDialog onApply={applyOcrFields} />}
              </div>
              <div className="relative">
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
              {labelHasOfferTrigger && !triggerText.trim() ? (
                <p className="text-[10px] text-violet-700 dark:text-violet-300">
                  Offer phrase detected — applying to Offer trigger.
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Sport</Label>
                <Select value={sport} onValueChange={changeSport} disabled={!!editBet}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPORTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <SportLabel sport={s.value} size={14} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Select value={betType} onValueChange={(v) => setBetType(v as BetMode)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      <span className="flex items-center gap-1.5">
                        {isFreeBetBetType(betType) || bookieFbAvailable > 0.001 ? (
                          <Gift
                            className={cn(
                              "size-3.5 shrink-0",
                              isFreeBetBetType(betType)
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
                    {(Object.keys(betTypeLabels) as BetMode[]).map((m) => (
                      <SelectItem key={m} value={m}>
                        <span className="flex items-center gap-1.5">
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
              <Label className="text-xs text-muted-foreground">Events</Label>
              <Select value={eventId} onValueChange={changeEvent}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a tracked event" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Manual entry</SelectItem>
                  {trackedEvents.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      <span className="flex items-center gap-2">
                        <SportIcon sport={e.sport} size={14} className="text-muted-foreground" />
                        {formatTrackedEventOption(e)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {trackedEvents.length === 0 && (
                <span className="text-[10px] leading-tight text-muted-foreground">
                  No tracked events - track one on Tracked Events, or enter details below.
                </span>
              )}
              {selectedEvent && effectiveEventStatus(selectedEvent) === "live" && (
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-500">
                  {liveEventInlineLabel(selectedEvent)}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Event name</Label>
              <Input
                placeholder={sport === "football" ? "e.g. World Cup" : "e.g. Premier League · Arsenal v Liverpool"}
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className={ring(!!highlightEmpty && !eventName.trim() && eventId === "none")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Date</Label>
                <Input
                  type="date"
                  value={eventDate}
                  onChange={(e) => {
                    setEventDate(e.target.value);
                    if (eventId !== "none") setEventId("none");
                  }}
                  className={ring(!!highlightEmpty && !eventDate && eventId === "none")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Time</Label>
                <EventTimeInput
                  value={eventTime}
                  onChange={(time) => {
                    setEventTime(time);
                    if (eventId !== "none") setEventId("none");
                  }}
                  className={ring(!!highlightEmpty && !eventTime && eventId === "none")}
                />
              </div>
            </div>
            {sport === "horse_racing" && matchingOffers.length > 0 && (
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
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Market</Label>
              <Select value={market} onValueChange={changeMarket}>
                <SelectTrigger className="w-full">
                  <SelectValue />
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
                {currentMarket?.auto
                  ? "Settles automatically from the score"
                  : "Manual settle, or use a win trigger below"}
              </span>
            </div>
          </div>

          {/* Right - back/lay & triggers */}
          <div className="flex flex-col gap-3 p-6">
            <BackPanel
              title="Back Bet"
              exchange={exchange}
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
              ) : currentMarket?.options ? (
                <PanelSelect
                  label="Selection"
                  value={selection}
                  onChange={setSelection}
                  selectClassName={ring(!selection.trim())}
                >
                  {currentMarket.options.map((option) => (
                    <option key={option} value={option}>
                      {usesTeamLabels
                        ? teamSelectionLabel(option, effectiveHome, effectiveAway)
                        : option}
                    </option>
                  ))}
                </PanelSelect>
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
                betType={betType}
                backStake={backStake}
                accounts={appState?.balances?.accounts}
                addBalance={addBalance}
                onAddBalanceChange={needsAddBalance ? setAddBalance : undefined}
                onUseFreeBet={(amount) => {
                  setBetType("free_snr");
                  setBackStake(amount);
                  setAddBalance(false);
                }}
              />
              {isFreeBetBetType(betType) && bookieFbAvailable > 0.001 ? (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBackStake(bookieFbAvailable)}
                    className="rounded-full border border-violet-500/35 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-900 dark:text-violet-200"
                  >
                    Use £{bookieFbAvailable.toFixed(2)} available
                  </button>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <PanelInput
                  label={isFreeBetBetType(betType) ? "Free bet stake" : "Back stake"}
                  prefix="£"
                  value={backStake}
                  onChange={setBackStake}
                  min={0}
                  placeholder="10.00"
                  inputClassName={cn(
                    ring(!(backStake > 0)),
                    isFreeBetBetType(betType) &&
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
                onChange={(v) =>
                  setLayStakeOverride(Number.isFinite(v) && v >= 0 ? v : null)
                }
              />
            </LayPanel>

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
          </div>
        </div>

        <div className="shrink-0 border-t">
          <div className="px-6 pt-4 pb-2">
            <ProfitTable
              rows={outcomeRows}
              guaranteed={preview?.guaranteed ?? 0}
              exchange={exchange}
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
          </div>
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
          <Button onClick={save} disabled={saving || (!dutchLegs?.length && !preview)} className={cn("min-w-36", !dutchLegs?.length && ring(!preview))}>
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