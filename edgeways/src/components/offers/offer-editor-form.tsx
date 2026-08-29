"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { DatePicker } from "@/components/date-picker";
import { EventTimeInput } from "@/components/event-time-input";
import { Button } from "@/components/ui/button";
import { DialogSaveButton } from "@/components/ui/dialog-save-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogExplainer,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemRow,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  InlinePasteStrip,
  InlinePasteTrigger,
} from "@/components/offers/inline-paste-strip";
import {
  PasteFieldLabel,
  pasteDescribedBy,
  pasteFieldClass,
} from "@/components/offers/paste-field-chrome";
import { OfferUrlField } from "@/components/offers/offer-url-field";
import { OfferCategoryIcon } from "@/components/offers/offer-category-icon";
import { RegionFlag } from "@/components/region-flag";
import { VenueSelect, inferVenueKind } from "@/components/venue-select";
import { api, useAppState } from "@/hooks/use-app-state";
import { useNow } from "@/hooks/use-now";
import { useVenueAccounts } from "@/hooks/use-venue-accounts";
import type { OfferRecurrenceRule, OfferSummary } from "@/lib/services/offers.types";
import type { RacingRacecard } from "@/lib/services/theracingapi";
import {
  encodeScopeCourses,
  formatBetGetFreePlaceSummary,
  formatOfferScopeLabel,
  isRegionalScope,
  normalizeCourseName,
  parseOfferRules,
  parseScopeCourses,
} from "@/lib/offers/racing-offer-rules";
import { syncBetGetTitleWithPlaces } from "@/lib/offers/bet-get-title-places";
import {
  OFFER_CATEGORIES,
  normalizeOfferCategoryId,
  offerCategoryById,
  offerCategoryFromSport,
  type OfferCategoryId,
} from "@/lib/offers/offer-categories";
import {
  emptyImportantTerms,
  formatImportantTermsSummary,
  formatOfferExpiry,
  fromDatetimeLocalValue,
  betScopeLabel,
  readImportantTerms,
  scopesNeedMinSelections,
  toDatetimeLocalValue,
  toggleScope,
  type OfferImportantTerms,
  type BetScope,
  BET_SCOPES,
} from "@/lib/offers/offer-terms";
import { buildRulesJsonWithPlaybook } from "@/lib/offers/offer-rules-payload";
import { normalizeOfferDetailsText } from "@/lib/offers/offer-odds-text";
import { missedOfferLabelForCategory } from "@/lib/offers/offer-expiry";
import { formatRecurrenceLabel, localYmd, parseYmd } from "@/lib/offers/offer-recurrence-shared";
import { isInvalidOfferUrlInput, normalizeOfferUrl } from "@/lib/offers/offer-url";
import {
  countPasteFields,
  markOfferFieldUser,
  mergeOfferPasteDraft,
  type OfferPasteFieldKey,
  type OfferPasteFormSlice,
  type OfferPasteProvenance,
} from "@/lib/offers/merge-paste-draft";
import { computeOfferFormReadiness } from "@/lib/offers/offer-form-readiness";
import { parseOfferFromText } from "@/lib/offers/parse-offer-text";
import { formatApiError } from "@/lib/api-errors";
import { FilterPill } from "@/components/ui/filter-pill";
import { fieldControl } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronDown, Plus, Save } from "lucide-react";

export type OfferEditorPrefill = {
  category?: OfferCategoryId;
  eventDate?: string;
  editOffer?: OfferSummary;
};

type OfferStatus = "planned" | "active" | "completed" | "expired";
type ScopeMode = "uk_ire" | "course" | "race";
type RepeatFreq = "daily" | "weekly" | "monthly";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseSelectionsField(raw: string, scopes: BetScope[]): number | null {
  if (!scopesNeedMinSelections(scopes)) return null;
  const n = raw.trim() ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 2 && n <= 12 ? n : null;
}

function formImportantFromState(input: {
  minOdds: string;
  minStake: string;
  maxStake: string;
  importantNotes: string;
  qualifierScopes: BetScope[];
  rewardScopes: BetScope[];
  minSelections: string;
  rewardMinSelections: string;
  promoCode: string;
  minDeposit: string;
  depositRequired: boolean;
  rewardEventLabel: string;
  rewardEventDate: string;
  winningsWageringX: string;
  maxConversion: string;
  paymentExclusions: string[];
}): OfferImportantTerms {
  const odds = input.minOdds.trim() ? parseFloat(input.minOdds) : NaN;
  const minS = input.minStake.trim() ? parseFloat(input.minStake) : NaN;
  const maxS = input.maxStake.trim() ? parseFloat(input.maxStake) : NaN;
  const minDep = input.minDeposit.trim() ? parseFloat(input.minDeposit) : NaN;
  const wr = input.winningsWageringX.trim() ? parseFloat(input.winningsWageringX) : NaN;
  const maxConv = input.maxConversion.trim() ? parseFloat(input.maxConversion) : NaN;
  const code = input.promoCode.trim().toUpperCase();
  return {
    minOdds: Number.isFinite(odds) && odds > 1 ? odds : null,
    minStake: Number.isFinite(minS) && minS > 0 ? minS : null,
    maxStake: Number.isFinite(maxS) && maxS > 0 ? maxS : null,
    importantNotes: input.importantNotes.trim(),
    qualifierScopes: input.qualifierScopes,
    rewardScopes: input.rewardScopes,
    minSelections: parseSelectionsField(input.minSelections, input.qualifierScopes),
    rewardMinSelections: parseSelectionsField(
      input.rewardMinSelections,
      input.rewardScopes
    ),
    promoCode: code || null,
    minDeposit: Number.isFinite(minDep) && minDep > 0 ? minDep : null,
    depositRequired:
      input.depositRequired ||
      Boolean(code) ||
      (Number.isFinite(minDep) && minDep > 0),
    rewardEventLabel: input.rewardEventLabel.trim() || null,
    rewardEventDate: input.rewardEventDate.trim() || null,
    winningsWageringX: Number.isFinite(wr) && wr > 0 ? wr : null,
    maxConversion: Number.isFinite(maxConv) && maxConv > 0 ? maxConv : null,
    paymentExclusions: input.paymentExclusions,
  };
}

function raceLabel(card: Pick<RacingRacecard, "offTime" | "raceName">): string {
  const name = card.raceName?.trim();
  return name ? `${card.offTime} · ${name}` : card.offTime;
}

/** Split datetime-local `YYYY-MM-DDTHH:mm` into upgraded DatePicker + TimePicker values. */
function splitDatetimeLocal(value: string): { date: string; time: string } {
  if (!value.trim()) return { date: "", time: "" };
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

/** Combine upgraded date/time pickers into epoch ms (date-only → 23:59). */
function expiresAtFromParts(date: string, time: string): number | null {
  if (!date.trim()) return null;
  const hhmm = time.trim() || "23:59";
  return fromDatetimeLocalValue(`${date.trim()}T${hhmm}`);
}

function normalizeOffTime(raw: string): string {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return raw.trim();
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function FormSection({
  title,
  summary,
  open,
  onOpenChange,
  children,
  accent,
}: {
  title: string;
  summary?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  accent?: boolean;
}) {
  const headerClass = cn(
    "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
    accent
      ? "rounded-t-lg bg-amber-500/15 hover:bg-amber-500/20 dark:bg-amber-500/15 dark:hover:bg-amber-500/25"
      : "rounded-t-lg bg-muted/50 hover:bg-muted/70 dark:bg-input/30 dark:hover:bg-input/45",
    !open && "rounded-b-lg"
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border",
        accent
          ? "border-amber-500/35 bg-amber-500/5"
          : "border-border/70 bg-muted/20 dark:bg-input/20"
      )}
    >
      <button type="button" onClick={() => onOpenChange(!open)} className={headerClass}>
        <span
          className={cn(
            "flex-1 text-xs font-semibold tracking-wide",
            accent ? "text-amber-800 dark:text-amber-300" : "text-foreground"
          )}
        >
          {accent ? (
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" />
              {title}
            </span>
          ) : (
            title
          )}
        </span>
        {!open && summary ? (
          <span className="max-w-[55%] truncate text-xs text-muted-foreground">
            {summary}
          </span>
        ) : null}
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open ? (
        <div className="flex flex-col gap-2 border-t border-border/50 px-3 py-2.5">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function initialFromPrefill(prefill?: OfferEditorPrefill) {
  const offer = prefill?.editOffer;
  if (offer) {
    const important = readImportantTerms(offer);
    const racing = offer.sport === "horse_racing";
    const rules = racing ? parseOfferRules(offer) : null;
    const raceScoped = racing && Boolean(offer.scopeRaceId?.trim());
    const courseScoped =
      racing && !raceScoped && offer.scopeCourse && !isRegionalScope(offer.scopeCourse);
    const scopeMode: ScopeMode = raceScoped ? "race" : courseScoped ? "course" : "uk_ire";
    const expiryParts = splitDatetimeLocal(
      offer.expiresAt ? toDatetimeLocalValue(offer.expiresAt) : ""
    );
    return {
      editingId: offer.id as number | null,
      title: offer.title,
      bookmaker: offer.bookmaker ?? "",
      offerUrl: offer.offerUrl ?? "",
      expected: offer.expectedProfit != null ? String(offer.expectedProfit) : "",
      expiresDate: expiryParts.date,
      expiresTime: expiryParts.time,
      offerStatus: offer.status as OfferStatus,
      category: offerCategoryFromSport(offer.sport),
      betStake: rules ? String(rules.betStake) : "50",
      freeBetAmount: rules ? String(rules.freeBetAmount) : "50",
      minRunners: rules ? String(rules.minRunners) : "8",
      qualifyingPlaces: (rules?.qualifyingPlaces ?? []) as number[],
      winnerMustBeSpFavourite: rules?.winnerMustBeSpFavourite === true,
      minFavouriteSpOdds:
        rules?.minFavouriteSpOdds != null && rules.minFavouriteSpOdds > 1
          ? String(rules.minFavouriteSpOdds)
          : "",
      resultConditional:
        (rules?.qualifyingPlaces?.length ?? 0) > 0 ||
        rules?.winnerMustBeSpFavourite === true,
      repeatSameDay: rules?.repeatSameDay === true,
      scopeMode,
      scopeCourse: raceScoped || courseScoped ? (offer.scopeCourse ?? "") : "",
      scopeRaceId: offer.scopeRaceId ?? "",
      scopeRaceLabel: offer.scopeRaceLabel ?? "",
      preferredOffTime: null as string | null,
      scopeRegions: (rules?.regions?.length ? rules.regions : ["GB", "IRE"]) as Array<"GB" | "IRE">,
      eventDate: offer.eventDate ?? new Date().toISOString().slice(0, 10),
      minOdds: important.minOdds != null ? String(important.minOdds) : "",
      minStake: important.minStake != null ? String(important.minStake) : "",
      maxStake: important.maxStake != null ? String(important.maxStake) : "",
      importantNotes: important.importantNotes,
      qualifierScopes: important.qualifierScopes,
      rewardScopes: important.rewardScopes,
      minSelections:
        important.minSelections != null ? String(important.minSelections) : "",
      rewardMinSelections:
        important.rewardMinSelections != null
          ? String(important.rewardMinSelections)
          : "",
      promoCode: important.promoCode ?? "",
      minDeposit: important.minDeposit != null ? String(important.minDeposit) : "",
      depositRequired: important.depositRequired,
      rewardEventLabel: important.rewardEventLabel ?? "",
      rewardEventDate: important.rewardEventDate ?? "",
      winningsWageringX:
        important.winningsWageringX != null ? String(important.winningsWageringX) : "",
      maxConversion:
        important.maxConversion != null ? String(important.maxConversion) : "",
      paymentExclusions: [...important.paymentExclusions],
      startsOn: offer.startsOn ?? "",
      repeatsEnabled: false,
      repeatFreq: "daily" as RepeatFreq,
      repeatInterval: "1",
      repeatWeekdays: [new Date().getDay()] as number[],
      repeatMonthday: String(new Date().getDate()),
      stopRecurrence: false,
      seriesRecurrence: offer.recurrence ?? null,
    };
  }

  const empty = emptyImportantTerms();
  return {
    editingId: null as number | null,
    title: "",
    bookmaker: "",
    offerUrl: "",
    expected: "",
    expiresDate: "",
    expiresTime: "",
    offerStatus: "active" as OfferStatus,
    category: (prefill?.category ?? "general") as OfferCategoryId,
    betStake: "50",
    freeBetAmount: "50",
    minRunners: "8",
    qualifyingPlaces: [] as number[],
    winnerMustBeSpFavourite: false,
    minFavouriteSpOdds: "",
    /** Off = straight bet&get; on = place/trigger refund (drives Offer Edge). */
    resultConditional: false,
    /** Opt-in: spawn a fresh desk twin after each play today. */
    repeatSameDay: false,
    scopeMode: "uk_ire" as ScopeMode,
    scopeCourse: "",
    scopeRaceId: "",
    scopeRaceLabel: "",
    preferredOffTime: null as string | null,
    scopeRegions: ["GB", "IRE"] as Array<"GB" | "IRE">,
    eventDate: prefill?.eventDate ?? new Date().toISOString().slice(0, 10),
    minOdds: empty.minOdds != null ? String(empty.minOdds) : "",
    minStake: empty.minStake != null ? String(empty.minStake) : "",
    maxStake: empty.maxStake != null ? String(empty.maxStake) : "",
    importantNotes: empty.importantNotes,
    qualifierScopes: [...empty.qualifierScopes] as BetScope[],
    rewardScopes: [...empty.rewardScopes] as BetScope[],
    minSelections: "",
    rewardMinSelections: "",
    promoCode: "",
    minDeposit: "",
    depositRequired: false,
    rewardEventLabel: "",
    rewardEventDate: "",
    winningsWageringX: "",
    maxConversion: "",
    paymentExclusions: [] as string[],
    startsOn: "",
    repeatsEnabled: false,
    repeatFreq: "daily" as RepeatFreq,
    repeatInterval: "1",
    repeatWeekdays: [new Date().getDay()] as number[],
    repeatMonthday: String(new Date().getDate()),
    stopRecurrence: false,
    seriesRecurrence: null as import("@/lib/services/offers.types").OfferRecurrenceMeta | null,
  };
}

type Boot = ReturnType<typeof initialFromPrefill>;

export function OfferEditorForm({
  prefill,
  open = true,
  onSaved,
  onBlockingOverlayChange,
}: {
  prefill?: OfferEditorPrefill;
  open?: boolean;
  onSaved: () => void;
  /** True while a nested confirm is open or a save is in flight (block parent dismiss). */
  onBlockingOverlayChange?: (blocking: boolean) => void;
}) {
  const boot = initialFromPrefill(prefill);
  const { state } = useAppState();
  const [title, setTitle] = useState(boot.title);
  const [bookmaker, setBookmaker] = useState(boot.bookmaker);
  const [offerUrl, setOfferUrl] = useState(boot.offerUrl);
  const [expected, setExpected] = useState(boot.expected);
  const [expiresDate, setExpiresDate] = useState(boot.expiresDate);
  const [expiresTime, setExpiresTime] = useState(boot.expiresTime);
  const [offerStatus, setOfferStatus] = useState<OfferStatus>(boot.offerStatus);
  const [category, setCategory] = useState<OfferCategoryId>(boot.category);
  const [betStake, setBetStake] = useState(boot.betStake);
  const [freeBetAmount, setFreeBetAmount] = useState(boot.freeBetAmount);
  const [minRunners, setMinRunners] = useState(boot.minRunners);
  const [qualifyingPlaces, setQualifyingPlaces] = useState<number[]>(boot.qualifyingPlaces);
  const [winnerMustBeSpFavourite, setWinnerMustBeSpFavourite] = useState(
    boot.winnerMustBeSpFavourite
  );
  const [minFavouriteSpOdds, setMinFavouriteSpOdds] = useState(boot.minFavouriteSpOdds);
  const [resultConditional, setResultConditional] = useState(boot.resultConditional);
  const [repeatSameDay, setRepeatSameDay] = useState(boot.repeatSameDay);
  const [scopeMode, setScopeMode] = useState<ScopeMode>(boot.scopeMode);
  const [scopeCourse, setScopeCourse] = useState(boot.scopeCourse);
  const [scopeRaceId, setScopeRaceId] = useState(boot.scopeRaceId);
  const [scopeRaceLabel, setScopeRaceLabel] = useState(boot.scopeRaceLabel);
  const [preferredOffTime, setPreferredOffTime] = useState<string | null>(boot.preferredOffTime);
  const [scopeRegions, setScopeRegions] = useState<Array<"GB" | "IRE">>(boot.scopeRegions);
  const [eventDate, setEventDate] = useState(boot.eventDate);
  const [minOdds, setMinOdds] = useState(boot.minOdds);
  const [minStake, setMinStake] = useState(boot.minStake);
  const [maxStake, setMaxStake] = useState(boot.maxStake);
  const [importantNotes, setImportantNotes] = useState(boot.importantNotes);
  const [qualifierScopes, setQualifierScopes] = useState<BetScope[]>(boot.qualifierScopes);
  const [rewardScopes, setRewardScopes] = useState<BetScope[]>(boot.rewardScopes);
  const [minSelections, setMinSelections] = useState(boot.minSelections);
  const [rewardMinSelections, setRewardMinSelections] = useState(boot.rewardMinSelections);
  const [promoCode, setPromoCode] = useState(boot.promoCode);
  const [minDeposit, setMinDeposit] = useState(boot.minDeposit);
  const [depositRequired, setDepositRequired] = useState(boot.depositRequired);
  const [rewardEventLabel, setRewardEventLabel] = useState(boot.rewardEventLabel);
  const [rewardEventDate, setRewardEventDate] = useState(boot.rewardEventDate);
  const [winningsWageringX, setWinningsWageringX] = useState(boot.winningsWageringX);
  const [maxConversion, setMaxConversion] = useState(boot.maxConversion);
  const [paymentExclusions, setPaymentExclusions] = useState<string[]>(
    boot.paymentExclusions
  );
  const [startsOn, setStartsOn] = useState(boot.startsOn);
  const [repeatsEnabled, setRepeatsEnabled] = useState(boot.repeatsEnabled);
  const [repeatFreq, setRepeatFreq] = useState<RepeatFreq>(boot.repeatFreq);
  const [repeatInterval, setRepeatInterval] = useState(boot.repeatInterval);
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>(boot.repeatWeekdays);
  const [repeatMonthday, setRepeatMonthday] = useState(boot.repeatMonthday);
  const [stopRecurrence, setStopRecurrence] = useState(boot.stopRecurrence);
  const [seriesRecurrence, setSeriesRecurrence] = useState(boot.seriesRecurrence);
  const [saving, setSaving] = useState(false);
  const [seriesConfirmOpen, setSeriesConfirmOpen] = useState(false);
  const [seriesUpdateScope, setSeriesUpdateScope] = useState<"instance" | "series">("series");
  const [editingId, setEditingId] = useState<number | null>(boot.editingId);

  useEffect(() => {
    onBlockingOverlayChange?.(seriesConfirmOpen);
    return () => onBlockingOverlayChange?.(false);
  }, [seriesConfirmOpen, onBlockingOverlayChange]);
  const [racecards, setRacecards] = useState<RacingRacecard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [sectionRacing, setSectionRacing] = useState(true);
  const [sectionScope, setSectionScope] = useState(false);
  const [sectionDetails, setSectionDetails] = useState(true);
  const [sectionImportant, setSectionImportant] = useState(true);
  const [autoAddAccount, setAutoAddAccount] = useState(true);
  // Tracks which venue name autoAddAccount's value belongs to, so it can be
  // reset to opted-in during render (not an effect) whenever a genuinely
  // different new venue is picked, while still respecting an explicit
  // uncheck for the venue currently shown.
  const [autoAddAccountFor, setAutoAddAccountFor] = useState(bookmaker.trim());
  const [pasteText, setPasteText] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const pastePanelId = useId();
  const [pasteProvenance, setPasteProvenance] = useState<OfferPasteProvenance>({});
  const [pasteConfidence, setPasteConfidence] = useState<
    "high" | "medium" | "low" | null
  >(null);
  const [pastePlaybookHint, setPastePlaybookHint] = useState<string | null>(null);

  const now = useNow(60_000);
  // A pasted promo often carries yesterday's deadline. Saving it works, but the
  // server files it straight under Expired, which reads as "nothing saved".
  const expiryMs = expiresAtFromParts(expiresDate, expiresTime);
  const expiryAlreadyPassed = expiryMs != null && now > 0 && expiryMs < now;

  const { bookieWallets, exchangeWallets, exchangeDirectory, ensureVenue } = useVenueAccounts();
  const bookmakerTrimmed = bookmaker.trim();
  const bookmakerIsKnownAccount = useMemo(() => {
    const key = bookmakerTrimmed.toLowerCase();
    return (
      bookieWallets.some((w) => w.name.toLowerCase() === key) ||
      exchangeWallets.some((w) => w.name.toLowerCase() === key)
    );
  }, [bookmakerTrimmed, bookieWallets, exchangeWallets]);
  const showAutoAddAccount = bookmakerTrimmed !== "" && !bookmakerIsKnownAccount;
  const autoAddKind = useMemo(
    () => inferVenueKind(bookmakerTrimmed, exchangeDirectory, exchangeWallets),
    [bookmakerTrimmed, exchangeDirectory, exchangeWallets]
  );

  if (bookmakerTrimmed !== autoAddAccountFor) {
    setAutoAddAccountFor(bookmakerTrimmed);
    setAutoAddAccount(true);
  }

  function applyBoot(next: Boot) {
    setTitle(next.title);
    setBookmaker(next.bookmaker);
    setOfferUrl(next.offerUrl);
    setExpected(next.expected);
    setExpiresDate(next.expiresDate);
    setExpiresTime(next.expiresTime);
    setOfferStatus(next.offerStatus);
    setCategory(next.category);
    setBetStake(next.betStake);
    setFreeBetAmount(next.freeBetAmount);
    setMinRunners(next.minRunners);
    setQualifyingPlaces(next.qualifyingPlaces);
    setWinnerMustBeSpFavourite(next.winnerMustBeSpFavourite);
    setMinFavouriteSpOdds(next.minFavouriteSpOdds);
    setResultConditional(next.resultConditional);
    setRepeatSameDay(next.repeatSameDay);
    setScopeMode(next.scopeMode);
    setScopeCourse(next.scopeCourse);
    setScopeRaceId(next.scopeRaceId);
    setScopeRaceLabel(next.scopeRaceLabel);
    setPreferredOffTime(next.preferredOffTime);
    setScopeRegions(next.scopeRegions);
    setEventDate(next.eventDate);
    setMinOdds(next.minOdds);
    setMinStake(next.minStake);
    setMaxStake(next.maxStake);
    setImportantNotes(next.importantNotes);
    setQualifierScopes(next.qualifierScopes);
    setRewardScopes(next.rewardScopes);
    setMinSelections(next.minSelections);
    setRewardMinSelections(next.rewardMinSelections);
    setPromoCode(next.promoCode);
    setMinDeposit(next.minDeposit);
    setDepositRequired(next.depositRequired);
    setRewardEventLabel(next.rewardEventLabel);
    setRewardEventDate(next.rewardEventDate);
    setWinningsWageringX(next.winningsWageringX);
    setMaxConversion(next.maxConversion);
    setPaymentExclusions(next.paymentExclusions);
    setStartsOn(next.startsOn);
    setRepeatsEnabled(next.repeatsEnabled);
    setRepeatFreq(next.repeatFreq);
    setRepeatInterval(next.repeatInterval);
    setRepeatWeekdays(next.repeatWeekdays);
    setRepeatMonthday(next.repeatMonthday);
    setStopRecurrence(next.stopRecurrence);
    setSeriesRecurrence(next.seriesRecurrence);
    setEditingId(next.editingId);
    setSectionRacing(true);
    setSectionScope(false);
    setSectionDetails(true);
    setSectionImportant(true);
  }

  useEffect(() => {
    if (!open) return;
    // ~20 field resets - deferred a microtask to avoid the sync render cascade.
    queueMicrotask(() => applyBoot(initialFromPrefill(prefill)));
  }, [open, prefill]);

  const isRacingCategory = offerCategoryById(category).isRacing;
  const titleRequired = !isRacingCategory;
  const formReadiness = computeOfferFormReadiness({
    isRacing: isRacingCategory,
    title,
    bookmaker,
    expiresAtMs: expiryMs,
    minOdds,
    minStake,
    betStake,
    freeBetAmount,
  });
  /** Meeting/race pin — not used for straight bet&get (desk follows Starts→Expires). */
  const needsRacingDay = resultConditional || scopeMode === "race";
  const cardsDate = needsRacingDay
    ? eventDate.trim()
    : startsOn.trim() || localYmd(new Date());

  // Load Racing Desk racecards for course / race pickers
  useEffect(() => {
    if (!open || !isRacingCategory || !cardsDate) {
      queueMicrotask(() => setRacecards([]));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setCardsLoading(true);
    });
    api<{ racecards: RacingRacecard[] }>(`/api/racing/racecards?date=${encodeURIComponent(cardsDate)}`)
      .then((res) => {
        if (!cancelled) setRacecards(res.racecards ?? []);
      })
      .catch(() => {
        if (!cancelled) setRacecards([]);
      })
      .finally(() => {
        if (!cancelled) setCardsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isRacingCategory, cardsDate]);

  const selectedCourses = useMemo(() => parseScopeCourses(scopeCourse), [scopeCourse]);
  /** Race mode needs a single course for the race-time picker. */
  const primaryCourse = selectedCourses[0] ?? "";

  const courses = useMemo(() => {
    const byName = new Map<string, string | undefined>();
    for (const c of racecards) {
      const name = c.course?.trim();
      if (!name) continue;
      if (!byName.has(name)) byName.set(name, c.region);
    }
    for (const name of selectedCourses) {
      const hit = [...byName.keys()].find(
        (c) => normalizeCourseName(c) === normalizeCourseName(name)
      );
      if (!hit) byName.set(name, undefined);
    }
    return [...byName.entries()]
      .map(([name, region]) => ({ name, region }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [racecards, selectedCourses]);

  const racesAtCourse = useMemo(() => {
    if (!primaryCourse) return [];
    const key = normalizeCourseName(primaryCourse);
    return racecards
      .filter((c) => normalizeCourseName(c.course) === key)
      .slice()
      .sort((a, b) => a.offTime.localeCompare(b.offTime));
  }, [racecards, primaryCourse]);

  // Resolve preferred off-time (from paste) → race id once cards load
  useEffect(() => {
    if (scopeMode !== "race" || !preferredOffTime || !primaryCourse) return;
    if (scopeRaceId) return;
    const want = normalizeOffTime(preferredOffTime);
    const hit =
      racesAtCourse.find((r) => normalizeOffTime(r.offTime) === want) ??
      racesAtCourse.find((r) => normalizeOffTime(r.offTime).startsWith(want.slice(0, 2)));
    if (hit) {
      queueMicrotask(() => {
        setScopeRaceId(hit.externalId);
        setScopeRaceLabel(raceLabel(hit));
        setPreferredOffTime(null);
      });
    }
  }, [scopeMode, preferredOffTime, primaryCourse, scopeRaceId, racesAtCourse]);

  function setImportantFromTerms(terms: OfferImportantTerms) {
    setMinOdds(terms.minOdds != null ? String(terms.minOdds) : "");
    setMinStake(terms.minStake != null ? String(terms.minStake) : "");
    setMaxStake(terms.maxStake != null ? String(terms.maxStake) : "");
    setImportantNotes(terms.importantNotes);
    setQualifierScopes(terms.qualifierScopes);
    setRewardScopes(terms.rewardScopes);
    setMinSelections(terms.minSelections != null ? String(terms.minSelections) : "");
    setRewardMinSelections(
      terms.rewardMinSelections != null ? String(terms.rewardMinSelections) : ""
    );
    setPromoCode(terms.promoCode ?? "");
    setMinDeposit(terms.minDeposit != null ? String(terms.minDeposit) : "");
    setDepositRequired(terms.depositRequired);
    setRewardEventLabel(terms.rewardEventLabel ?? "");
    setRewardEventDate(terms.rewardEventDate ?? "");
    setWinningsWageringX(
      terms.winningsWageringX != null ? String(terms.winningsWageringX) : ""
    );
    setMaxConversion(terms.maxConversion != null ? String(terms.maxConversion) : "");
    setPaymentExclusions([...terms.paymentExclusions]);
  }

  function importantFromForm(): OfferImportantTerms {
    return formImportantFromState({
      minOdds,
      minStake,
      maxStake,
      importantNotes,
      qualifierScopes,
      rewardScopes,
      minSelections,
      rewardMinSelections,
      promoCode,
      minDeposit,
      depositRequired,
      rewardEventLabel,
      rewardEventDate,
      winningsWageringX,
      maxConversion,
      paymentExclusions,
    });
  }

  function changeScopeMode(next: ScopeMode) {
    setScopeMode(next);
    if (next === "uk_ire") {
      setScopeCourse("");
      setScopeRaceId("");
      setScopeRaceLabel("");
      setPreferredOffTime(null);
    } else if (next === "course") {
      setScopeRaceId("");
      setScopeRaceLabel("");
      setPreferredOffTime(null);
    } else if (next === "race") {
      // Race lock is one meeting - keep the first selected course only.
      const first = parseScopeCourses(scopeCourse)[0];
      if (first) setScopeCourse(first);
      else setScopeCourse("");
      if (!eventDate.trim()) setEventDate(startsOn.trim() || localYmd(new Date()));
    }
  }

  function toggleScopeCourse(name: string) {
    const key = normalizeCourseName(name);
    const current = parseScopeCourses(scopeCourse);
    const exists = current.some((c) => normalizeCourseName(c) === key);
    const next = exists
      ? current.filter((c) => normalizeCourseName(c) !== key)
      : [...current, name];
    setScopeCourse(encodeScopeCourses(next));
    setScopeRaceId("");
    setScopeRaceLabel("");
    setPreferredOffTime(null);
  }

  function buildOfferPayload() {
    const isRacing = isRacingCategory;
    const cat = offerCategoryById(category);
    const important = importantFromForm();
    const normalizedImportant = {
      ...important,
      importantNotes: normalizeOfferDetailsText(important.importantNotes),
    };
    const stake = parseFloat(betStake) || 50;
    const free = parseFloat(freeBetAmount) || stake;
    const places = resultConditional
      ? qualifyingPlaces.length > 0
        ? qualifyingPlaces
        : winnerMustBeSpFavourite
          ? ([2] as number[])
          : ([] as number[])
      : ([] as number[]);
    const regions =
      scopeMode === "uk_ire"
        ? scopeRegions.length > 0
          ? scopeRegions
          : (["GB", "IRE"] as ("GB" | "IRE")[])
        : (["GB", "IRE"] as ("GB" | "IRE")[]);

    const minFavSp = parseFloat(minFavouriteSpOdds);
    const racingRules = isRacing
      ? {
          type: "bet_get_free_place" as const,
          minRunners: parseInt(minRunners, 10) || 8,
          regions,
          qualifyingPlaces: places,
          betStake: stake,
          freeBetAmount: free,
          ...(resultConditional && winnerMustBeSpFavourite
            ? { winnerMustBeSpFavourite: true as const }
            : {}),
          ...(resultConditional &&
          winnerMustBeSpFavourite &&
          Number.isFinite(minFavSp) &&
          minFavSp > 1
            ? { minFavouriteSpOdds: minFavSp }
            : {}),
          // Series = once per day; race-scoped never twins. Opt-in multi-use only.
          ...(resultConditional &&
          scopeMode !== "race" &&
          !seriesRecurrence?.enabled &&
          repeatSameDay
            ? { repeatSameDay: true as const }
            : {}),
        }
      : null;

    // Keep the title place clause in sync with the form. Leaving an OCR/paste
    // title like "(4th, 6th)" while saving places=[2] lets background repair
    // (and the racing desk) treat the stale title as truth.
    const racingTitle = isRacing
      ? syncBetGetTitleWithPlaces(
          title.trim() || `Bet £${stake} get £${free} free bet`,
          places,
          {
            winnerMustBeSpFavourite:
              resultConditional && winnerMustBeSpFavourite === true,
          }
        )
      : title.trim();

    const previousRulesJson =
      editingId != null
        ? (state?.offers ?? []).find((o) => o.id === editingId)?.rules ?? null
        : null;
    const rulesPayload = buildRulesJsonWithPlaybook({
      important: normalizedImportant,
      racingRules,
      betStake: isRacing ? stake : normalizedImportant.minStake,
      freeBetAmount: isRacing ? free : null,
      bookmaker: bookmaker.trim() || null,
      previousRulesJson,
    });

    const importantSummary = formatImportantTermsSummary(normalizedImportant);
    const description = normalizeOfferDetailsText(
      isRacing
        ? [formatBetGetFreePlaceSummary(racingRules!), importantSummary].filter(Boolean).join(" · ")
        : importantSummary ?? ""
    );

    const courseValue =
      scopeMode === "uk_ire"
        ? "uk_ire"
        : encodeScopeCourses(parseScopeCourses(scopeCourse)) || "uk_ire";

    const startsOnTrimmed = startsOn.trim();
    // The offset an occurrence expires after its own date, derived from the gap
    // between "Starts on" (or today, if blank) and the "Expires" date picked for
    // the FIRST occurrence - e.g. starts Wed, expires next Tue → every future
    // occurrence also runs for that same span from its own start date.
    const expiryOffsetDays = (() => {
      const expiresMs = expiresAtFromParts(expiresDate, expiresTime);
      if (expiresMs == null) return undefined;
      const anchor = startsOnTrimmed || localYmd(new Date());
      const expiresYmd = localYmd(new Date(expiresMs));
      const diffDays = Math.round(
        (parseYmd(expiresYmd).getTime() - parseYmd(anchor).getTime()) / 86_400_000
      );
      return diffDays > 0 ? diffDays : undefined;
    })();
    const repeatRule: OfferRecurrenceRule | null =
      editingId == null && repeatsEnabled
        ? {
            freq: repeatFreq,
            interval: Math.max(1, parseInt(repeatInterval, 10) || 1),
            ...(repeatFreq === "weekly"
              ? { byWeekday: repeatWeekdays.length > 0 ? repeatWeekdays : [new Date().getDay()] }
              : {}),
            ...(repeatFreq === "monthly"
              ? { byMonthday: Math.min(31, Math.max(1, parseInt(repeatMonthday, 10) || 1)) }
              : {}),
            ...(expiryOffsetDays != null ? { expiryOffsetDays } : {}),
          }
        : null;

    return {
      title: racingTitle,
      bookmaker: bookmaker.trim() || undefined,
      offerUrl: normalizeOfferUrl(offerUrl),
      expectedProfit: expected.trim() ? parseFloat(expected) : undefined,
      status: offerStatus,
      expiresAt: expiresAtFromParts(expiresDate, expiresTime),
      startsOn: startsOnTrimmed || null,
      sport: cat.sport,
      description: description ?? "",
      ...(repeatRule ? { recurrence: repeatRule } : {}),
      ...(editingId != null && stopRecurrence && seriesRecurrence?.enabled
        ? { stopRecurrence: true }
        : {}),
      ...(isRacing
        ? {
            offerType: "bet_get_free_place",
            scopeCourse: courseValue,
            // Place-refund / race-scoped pin a meeting day. Straight bet&get
            // stays on the desk from Starts on through Expires instead.
            eventDate:
              (resultConditional || scopeMode === "race") && eventDate.trim()
                ? eventDate.trim()
                : null,
            scopeRaceId: scopeMode === "race" && scopeRaceId.trim() ? scopeRaceId.trim() : null,
            scopeRaceLabel:
              scopeMode === "race" && scopeRaceLabel.trim() ? scopeRaceLabel.trim() : null,
            rules: rulesPayload,
          }
        : {
            offerType: rulesPayload ? "promo_terms" : null,
            scopeCourse: null,
            scopeRaceId: null,
            scopeRaceLabel: null,
            eventDate: null,
            rules: rulesPayload,
          }),
    };
  }

  function validateBeforeSave(): string | null {
    if (!isRacingCategory && !title.trim() && editingId == null) {
      return "Add a title for this offer.";
    }
    if (isInvalidOfferUrlInput(offerUrl)) {
      setSectionDetails(true);
      return "Enter a valid http(s) link, or clear Link to offer.";
    }
    if (isRacingCategory) {
      const stake = parseFloat(betStake);
      const free = parseFloat(freeBetAmount);
      if (!Number.isFinite(stake) || stake <= 0) {
        setSectionRacing(true);
        return "Enter a bet stake greater than 0.";
      }
      if (!Number.isFinite(free) || free <= 0) {
        setSectionRacing(true);
        return "Enter a free bet amount greater than 0.";
      }
      if (resultConditional && qualifyingPlaces.length === 0 && !winnerMustBeSpFavourite) {
        setSectionRacing(true);
        return "Pick at least one qualifying place, or turn off result-dependent reward.";
      }
      if (resultConditional && winnerMustBeSpFavourite && minFavouriteSpOdds.trim()) {
        const n = parseFloat(minFavouriteSpOdds);
        if (!Number.isFinite(n) || n <= 1) {
          setSectionRacing(true);
          return "Min favourite SP must be greater than 1, or leave it blank.";
        }
      }
      if ((resultConditional || scopeMode === "race") && !eventDate.trim()) {
        setSectionScope(true);
        return "Pick a racing day.";
      }
      if (
        (scopeMode === "course" || scopeMode === "race") &&
        parseScopeCourses(scopeCourse).length === 0
      ) {
        setSectionScope(true);
        return scopeMode === "course"
          ? "Pick at least one course from the Racing Desk list."
          : "Pick a course from the Racing Desk list.";
      }
      if (scopeMode === "race" && !scopeRaceId.trim()) {
        setSectionScope(true);
        return "Pick a specific race.";
      }
    }
    if (expiresDate.trim() && expiresAtFromParts(expiresDate, expiresTime) == null) {
      setSectionDetails(true);
      return "Expiry date looks invalid - clear it or pick a valid date.";
    }
    if (expected.trim()) {
      const n = parseFloat(expected);
      if (!Number.isFinite(n)) {
        setSectionDetails(true);
        return "Expected profit must be a number.";
      }
    }
    if (minOdds.trim()) {
      const n = parseFloat(minOdds);
      if (!Number.isFinite(n) || n <= 1) {
        setSectionImportant(true);
        return "Min odds must be greater than 1.";
      }
    }
    if (minStake.trim()) {
      const n = parseFloat(minStake);
      if (!Number.isFinite(n) || n < 0) {
        setSectionImportant(true);
        return "Min stake must be a valid amount.";
      }
    }
    if (maxStake.trim()) {
      const n = parseFloat(maxStake);
      if (!Number.isFinite(n) || n < 0) {
        setSectionImportant(true);
        return "Max stake must be a valid amount.";
      }
    }
    return null;
  }

  function touchPasteUser(key: OfferPasteFieldKey) {
    setPasteProvenance((prev) => markOfferFieldUser(prev, key));
  }

  function currentPasteSlice(): OfferPasteFormSlice {
    return {
      category,
      title,
      bookmaker,
      expected,
      expiresAtMs: expiresAtFromParts(expiresDate, expiresTime),
      startsOn,
      minOdds,
      minStake,
      maxStake,
      importantNotes,
      promoCode,
      minDeposit,
      depositRequired,
      rewardEventLabel,
      rewardEventDate,
      winningsWageringX,
      maxConversion,
      paymentExclusions,
      qualifierScopes,
      rewardScopes,
      minSelections,
      rewardMinSelections,
      betStake,
      freeBetAmount,
      minRunners,
      qualifyingPlaces,
      winnerMustBeSpFavourite,
      minFavouriteSpOdds,
      resultConditional,
      repeatSameDay,
      scopeMode,
      scopeCourse,
      preferredOffTime,
      scopeRegions,
      eventDate,
    };
  }

  function applyMergedPasteForm(merged: OfferPasteFormSlice) {
    setEditingId(null);
    setCategory(merged.category);
    setTitle(merged.title);
    setBookmaker(merged.bookmaker);
    setExpected(merged.expected);
    if (merged.expiresAtMs != null) {
      const parts = splitDatetimeLocal(toDatetimeLocalValue(merged.expiresAtMs));
      setExpiresDate(parts.date);
      setExpiresTime(parts.time);
    }
    setOfferStatus((s) => (s === "completed" || s === "expired" ? s : "active"));
    setStartsOn(merged.startsOn);
    setMinOdds(merged.minOdds);
    setMinStake(merged.minStake);
    setMaxStake(merged.maxStake);
    setImportantNotes(merged.importantNotes);
    setPromoCode(merged.promoCode);
    setMinDeposit(merged.minDeposit);
    setDepositRequired(merged.depositRequired);
    setRewardEventLabel(merged.rewardEventLabel);
    setRewardEventDate(merged.rewardEventDate);
    setWinningsWageringX(merged.winningsWageringX);
    setMaxConversion(merged.maxConversion);
    setPaymentExclusions(merged.paymentExclusions);
    setQualifierScopes(merged.qualifierScopes);
    setRewardScopes(merged.rewardScopes);
    setMinSelections(merged.minSelections);
    setRewardMinSelections(merged.rewardMinSelections);
    setSectionDetails(true);
    setSectionImportant(true);
    if (offerCategoryById(merged.category).isRacing) {
      setBetStake(merged.betStake);
      setFreeBetAmount(merged.freeBetAmount);
      setMinRunners(merged.minRunners || "8");
      setQualifyingPlaces(merged.qualifyingPlaces);
      setWinnerMustBeSpFavourite(merged.winnerMustBeSpFavourite);
      setMinFavouriteSpOdds(merged.minFavouriteSpOdds);
      setResultConditional(merged.resultConditional);
      setRepeatSameDay(merged.repeatSameDay);
      setScopeMode(merged.scopeMode);
      setScopeCourse(merged.scopeCourse);
      setScopeRaceId("");
      setScopeRaceLabel(
        merged.preferredOffTime ? `${merged.preferredOffTime} · resolving…` : ""
      );
      setPreferredOffTime(merged.preferredOffTime);
      setScopeRegions(merged.scopeRegions);
      setEventDate(merged.eventDate || localYmd(new Date()));
      setSectionRacing(true);
      setSectionScope(merged.scopeMode !== "uk_ire");
    }
  }

  function handlePasteTextChange(next: string) {
    setPasteText(next);
    if (!next.trim()) {
      setPasteConfidence(null);
      setPastePlaybookHint(null);
      return;
    }
    const draft = parseOfferFromText(next);
    const { form, provenance } = mergeOfferPasteDraft(
      currentPasteSlice(),
      draft,
      pasteProvenance
    );
    applyMergedPasteForm(form);
    setPasteProvenance(provenance);
    setPasteConfidence(draft.confidence);
    const step0 = draft.playbook?.steps[0];
    setPastePlaybookHint(
      step0?.kind === "deposit" ? step0.title : step0?.kind === "qualify" ? step0.title : null
    );
  }

  const repeatingEdit =
    editingId != null && Boolean(seriesRecurrence?.enabled) && !stopRecurrence;
  const otherOccurrenceCount =
    seriesRecurrence?.seriesId != null
      ? (state?.offers ?? []).filter(
          (o) => o.seriesId === seriesRecurrence.seriesId && o.id !== editingId
        ).length
      : 0;

  async function persistOffer(updateSeries: boolean) {
    setSaving(true);
    try {
      const payload = {
        ...buildOfferPayload(),
        ...(updateSeries ? { updateSeries: true } : {}),
      };
      const expiredOnArrival = expiryAlreadyPassed
        ? { description: "The expiry has already passed, so it's under the Expired filter." }
        : undefined;
      if (editingId != null) {
        await api(`/api/offers/${editingId}`, { method: "PATCH", json: payload });
        toast.success(
          updateSeries ? "Offer and repeat occurrences updated" : "Offer updated",
          expiredOnArrival
        );
      } else {
        await api("/api/offers", { method: "POST", json: payload });
        toast.success("Offer added", expiredOnArrival);
      }
      if (showAutoAddAccount && autoAddAccount) {
        try {
          const res = await ensureVenue(bookmakerTrimmed, autoAddKind);
          if (res?.created) {
            toast.success(
              autoAddKind === "exchange"
                ? `Added exchange “${bookmakerTrimmed}”`
                : `Added bookie “${bookmakerTrimmed}”`
            );
          }
        } catch (err) {
          toast.error("Offer saved, but could not add the account", {
            description: formatApiError(err),
          });
        }
      }
      setSeriesConfirmOpen(false);
      onSaved();
    } catch (err) {
      toast.error(editingId != null ? "Could not update offer" : "Could not create offer", {
        description: formatApiError(err),
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveOffer(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateBeforeSave();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (repeatingEdit && otherOccurrenceCount > 0) {
      setSeriesUpdateScope("series");
      setSeriesConfirmOpen(true);
      return;
    }
    // Series with no siblings materialised yet: still refresh the template so
    // future occurrences pick up the edited terms (no confirm needed).
    await persistOffer(repeatingEdit);
  }

  const scopeWindowLabel = needsRacingDay
    ? eventDate || "pick day"
    : expiresDate.trim()
      ? `until ${expiresDate}`
      : "until Expires";
  const scopeSummary =
    scopeMode === "uk_ire"
      ? `UK & IRE · ${scopeWindowLabel}`
      : scopeMode === "race"
        ? `${primaryCourse || "Course"} · ${scopeRaceLabel || "pick race"} · ${eventDate || "pick day"}`
        : `${formatOfferScopeLabel(scopeCourse) || "Courses"} · ${scopeWindowLabel}`;

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={saveOffer}>
      <div className="flex-1 space-y-2.5 overflow-y-auto px-6 py-5">
      <div className="flex items-end gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 max-sm:grid-cols-1">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(normalizeOfferCategoryId(v))}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {OFFER_CATEGORIES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <OfferCategoryIcon
                        category={c.id}
                        size={14}
                        className="text-muted-foreground"
                      />
                      {c.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={offerStatus}
              onValueChange={(v) => setOfferStatus(v as OfferStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="expired">
                  {missedOfferLabelForCategory(category) === "Expired"
                    ? "Expired"
                    : `${missedOfferLabelForCategory(category)} (expired)`}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {editingId == null ? (
          <InlinePasteTrigger
            open={pasteOpen}
            onOpenChange={setPasteOpen}
            filledCount={countPasteFields(pasteProvenance)}
            panelId={pastePanelId}
          />
        ) : null}
      </div>

      {editingId == null ? (
        <InlinePasteStrip
          text={pasteText}
          onTextChange={handlePasteTextChange}
          filledCount={countPasteFields(pasteProvenance)}
          confidence={pasteConfidence}
          playbookHint={pastePlaybookHint}
          readyCompleted={formReadiness.completed}
          readyTotal={formReadiness.total}
          open={pasteOpen}
          onOpenChange={setPasteOpen}
          panelId={pastePanelId}
          hideTrigger
          placeholder={`Dynobet
UEFA Super Cup Bet & Get
Deposit £30 with code UEFA · bet £20 · get £10 free bet
Expires 12 Aug 2026, 23:59`}
        />
      ) : null}

      {isRacingCategory && (
        <FormSection
          title="Racing terms"
          open={sectionRacing}
          onOpenChange={setSectionRacing}
          summary={`£${betStake || "-"} → £${freeBetAmount || "-"}${
            resultConditional
              ? ` · min ${minRunners || "-"}${
                  winnerMustBeSpFavourite
                    ? minFavouriteSpOdds.trim()
                      ? ` · SP favourite · min fav SP ${minFavouriteSpOdds.trim()}`
                      : " · SP favourite"
                    : qualifyingPlaces.length > 0
                      ? ` · places ${qualifyingPlaces.join(",")}`
                      : " · result trigger"
                }`
              : " · straight reward"
          }`}
        >
          {/* Money first — stake/free always; min runners only for desk place-refunds. */}
          <div className={resultConditional ? "grid grid-cols-3 gap-2 max-sm:grid-cols-1" : "grid grid-cols-2 gap-2 max-sm:grid-cols-1"}>
            <div className="flex flex-col gap-1">
              <Label htmlFor="offer-stake" className="text-xs text-muted-foreground">
                Bet stake (£)
              </Label>
              <Input
                id="offer-stake"
                type="number"
                min={1}
                value={betStake}
                onChange={(e) => setBetStake(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="offer-free" className="text-xs text-muted-foreground">
                Free bet (£)
              </Label>
              <Input
                id="offer-free"
                type="number"
                min={1}
                value={freeBetAmount}
                onChange={(e) => setFreeBetAmount(e.target.value)}
              />
            </div>
            {resultConditional ? (
              <div className="flex flex-col gap-1">
                <Label htmlFor="offer-min-runners" className="text-xs text-muted-foreground">
                  Min runners
                </Label>
                <Input
                  id="offer-min-runners"
                  type="number"
                  min={1}
                  value={minRunners}
                  onChange={(e) => setMinRunners(e.target.value)}
                />
              </div>
            ) : null}
          </div>

          {/* When it pays — one toggle, then places / favourite nest underneath. */}
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-dashed px-3 py-2.5 text-xs">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={resultConditional}
              onChange={(e) => {
                const on = e.target.checked;
                setResultConditional(on);
                if (on) {
                  if (qualifyingPlaces.length === 0) setQualifyingPlaces([2, 3, 4]);
                  if (!eventDate.trim()) setEventDate(localYmd(new Date()));
                  setSectionScope(true);
                } else {
                  setQualifyingPlaces([]);
                  setWinnerMustBeSpFavourite(false);
                  setMinFavouriteSpOdds("");
                  setRepeatSameDay(false);
                }
              }}
            />
            <span>
              <span className="font-medium text-foreground">Reward depends on result</span>
              <span className="mt-0.5 block text-muted-foreground">
                Place refunds and similar. Off = straight bet & get. How often it can be played
                is set below when this is on.
              </span>
            </span>
          </label>

          {resultConditional ? (
            <div className="flex flex-col gap-3 border-l-2 border-border/70 pl-3">
              {scopeMode !== "race" ? (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs text-muted-foreground">How often today</Label>
                  {seriesRecurrence?.enabled ? (
                    <p className="text-xs text-muted-foreground">
                      Recurring series: one play per day (tomorrow is a new instance).
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        <FilterPill
                          active={!repeatSameDay}
                          onClick={() => {
                            setRepeatSameDay(false);
                            touchPasteUser("repeatSameDay");
                          }}
                        >
                          One-time today
                        </FilterPill>
                        <FilterPill
                          active={repeatSameDay}
                          onClick={() => {
                            setRepeatSameDay(true);
                            touchPasteUser("repeatSameDay");
                          }}
                        >
                          Multiple times today
                        </FilterPill>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {repeatSameDay
                          ? "After each play, a fresh card stays on Racing Desk for another race."
                          : "After you log a qualifying bet, this offer leaves Racing Desk."}
                      </p>
                    </>
                  )}
                </div>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Qualifying places</Label>
                <div className="flex flex-wrap gap-1.5">
                  {([2, 3, 4, 5, 6] as const).map((place) => {
                    const on = qualifyingPlaces.includes(place);
                    return (
                      <FilterPill
                        key={place}
                        active={on}
                        onClick={() => {
                          setQualifyingPlaces((prev) =>
                            on
                              ? prev.filter((p) => p !== place)
                              : [...prev, place].sort((a, b) => a - b)
                          );
                        }}
                        className="tabular-nums"
                      >
                        {place === 2 ? "2nd" : place === 3 ? "3rd" : `${place}th`}
                      </FilterPill>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2 rounded-md border border-dashed bg-muted/20 px-3 py-2.5">
                <label className="flex cursor-pointer items-start gap-2.5 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={winnerMustBeSpFavourite}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setWinnerMustBeSpFavourite(on);
                      if (on && qualifyingPlaces.length !== 1) setQualifyingPlaces([2]);
                      if (!on) setMinFavouriteSpOdds("");
                    }}
                  />
                  <span>
                    <span className="font-medium text-foreground">
                      Winner must be SP favourite
                    </span>
                    <span className="mt-0.5 block text-muted-foreground">
                      QuinnBet-style: place only pays behind the Starting Price favourite.
                    </span>
                  </span>
                </label>
                {winnerMustBeSpFavourite ? (
                  <div className="flex flex-wrap items-end gap-2 border-t border-border/40 pt-2 pl-6">
                    <div className="flex min-w-[7.5rem] flex-col gap-1">
                      <Label
                        htmlFor="offer-min-fav-sp"
                        className="text-xs text-muted-foreground"
                      >
                        Min favourite SP
                      </Label>
                      <Input
                        id="offer-min-fav-sp"
                        type="number"
                        step="0.01"
                        min={1.01}
                        placeholder="e.g. 2.5"
                        value={minFavouriteSpOdds}
                        onChange={(e) => setMinFavouriteSpOdds(e.target.value)}
                        className="max-w-[8rem]"
                      />
                    </div>
                    <p className="pb-1.5 text-xs text-muted-foreground">
                      Optional. Leave blank if the offer has no floor.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Match the qualifier tightly; extract the free bet at higher odds with a tight lay.
            </p>
          )}
        </FormSection>
      )}

      {isRacingCategory && (
        <FormSection
          title="Scope"
          open={sectionScope}
          onOpenChange={setSectionScope}
          summary={scopeSummary}
        >
          <div className={needsRacingDay ? "grid grid-cols-2 gap-2 max-sm:grid-cols-1" : undefined}>
            {needsRacingDay ? (
              <div className="flex flex-col gap-1">
                <Label htmlFor="offer-event-date" className="text-xs text-muted-foreground">
                  Racing day
                </Label>
                <DatePicker
                  id="offer-event-date"
                  value={eventDate}
                  onChange={(date) => {
                    setEventDate(date);
                    setScopeRaceId("");
                    setScopeRaceLabel("");
                  }}
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Scope</Label>
              <Select value={scopeMode} onValueChange={(v) => changeScopeMode(v as ScopeMode)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uk_ire">UK &amp; Ireland</SelectItem>
                  <SelectItem value="course">Specific course</SelectItem>
                  <SelectItem value="race">Specific race</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {scopeMode === "uk_ire" && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Regions</Label>
              <div className="flex gap-2">
                {(
                  [
                    { id: "GB" as const, label: "UK (GB)" },
                    { id: "IRE" as const, label: "Ireland" },
                  ] as const
                ).map(({ id, label }) => {
                  const active = scopeRegions.includes(id);
                  return (
                    <FilterPill
                      key={id}
                      active={active}
                      onClick={() => {
                        setScopeRegions((prev) => {
                          if (active) {
                            const next = prev.filter((r) => r !== id);
                            return next.length > 0 ? next : prev;
                          }
                          return [...prev, id];
                        });
                      }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <RegionFlag code={id} />
                        {label}
                      </span>
                    </FilterPill>
                  );
                })}
              </div>
            </div>
          )}

          {scopeMode === "course" && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Courses</Label>
              {courses.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {courses.map((c) => {
                    const active = selectedCourses.some(
                      (name) => normalizeCourseName(name) === normalizeCourseName(c.name)
                    );
                    return (
                      <FilterPill
                        key={c.name}
                        active={active}
                        onClick={() => toggleScopeCourse(c.name)}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <RegionFlag code={c.region} />
                          {c.name}
                        </span>
                      </FilterPill>
                    );
                  })}
                </div>
              ) : (
                <Input
                  placeholder={
                    cardsLoading
                      ? "Loading courses…"
                      : "No cards - type courses, e.g. Galway, Goodwood"
                  }
                  value={scopeCourse}
                  onChange={(e) => setScopeCourse(e.target.value)}
                />
              )}
              {selectedCourses.length > 1 ? (
                <p className="text-xs text-muted-foreground">
                  {selectedCourses.length} courses selected · {formatOfferScopeLabel(scopeCourse)}
                </p>
              ) : null}
              {!cardsLoading && courses.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Racecards are available for today and tomorrow when the racing feed is connected.
                </p>
              ) : null}
            </div>
          )}

          {scopeMode === "race" && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Course</Label>
              {courses.length > 0 ? (
                <Select
                  value={
                    courses.find(
                      (c) => normalizeCourseName(c.name) === normalizeCourseName(primaryCourse)
                    )?.name ?? (primaryCourse || undefined)
                  }
                  onValueChange={(v) => {
                    setScopeCourse(v);
                    setScopeRaceId("");
                    setScopeRaceLabel("");
                    setPreferredOffTime(null);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={cardsLoading ? "Loading…" : "Pick course"} />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        <span className="inline-flex items-center gap-1.5">
                          <RegionFlag code={c.region} />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder={cardsLoading ? "Loading courses…" : "No cards - type course name"}
                  value={scopeCourse}
                  onChange={(e) => setScopeCourse(e.target.value)}
                />
              )}
            </div>
          )}

          {scopeMode === "race" && (
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Race</Label>
              {racesAtCourse.length > 0 ? (
                <Select
                  value={scopeRaceId || undefined}
                  onValueChange={(v) => {
                    const hit = racesAtCourse.find((r) => r.externalId === v);
                    setScopeRaceId(v);
                    setScopeRaceLabel(hit ? raceLabel(hit) : "");
                    setPreferredOffTime(null);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        primaryCourse ? "Pick race time" : "Pick a course first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent matchTrigger>
                    {racesAtCourse.map((r) => (
                      <SelectItem key={r.externalId} value={r.externalId}>
                        <SelectItemRow
                          label={raceLabel(r)}
                          trailing={`${r.fieldSize} runners`}
                        />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  {primaryCourse
                    ? cardsLoading
                      ? "Loading races…"
                      : "No races listed for this course on that day."
                    : "Choose a course to see race times."}
                </p>
              )}
            </div>
          )}

          {scopeMode === "race" ? (
            <p className="text-xs text-muted-foreground">
              One race only. Completing it does not create another campaign for later races.
            </p>
          ) : resultConditional ? (
            <p className="text-xs text-muted-foreground">
              Place-refund offers stay available all day: after you log a qualifier, a fresh copy
              appears so you can go again on the next race in this scope. The awarded free bet is
              not locked to these courses, only to the same sport.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Shows on the Racing Desk from Starts on through Expires. One qualifier; leaves the
              desk once logged.
            </p>
          )}
        </FormSection>
      )}

      <FormSection
        title="Details"
        open={sectionDetails}
        onOpenChange={setSectionDetails}
        summary={[
          bookmaker || null,
          expected ? `EV £${expected}` : null,
          expiryMs != null ? formatOfferExpiry(expiryMs) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      >
        <div className="flex flex-col gap-1">
          <PasteFieldLabel
            htmlFor="offer-title"
            provenance={pasteProvenance.title}
            required={titleRequired && editingId == null}
          >
            {isRacingCategory ? "Title (optional)" : "Title"}
          </PasteFieldLabel>
          <Input
            id="offer-title"
            placeholder={
              isRacingCategory
                ? "Auto-generated from stake amounts"
                : "Bet £20 get £10 free bet (Football)"
            }
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              touchPasteUser("title");
            }}
            aria-describedby={pasteDescribedBy(pasteProvenance.title, "offer-title")}
            className={pasteFieldClass(pasteProvenance.title, {
              requiredEmpty:
                titleRequired &&
                editingId == null &&
                !title.trim() &&
                Boolean(pasteText.trim()),
            })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <PasteFieldLabel provenance={pasteProvenance.bookmaker} describedById="offer-bookie-paste">
            Bookie / Exchange
          </PasteFieldLabel>
          <VenueSelect
            value={bookmaker}
            onChange={(v) => {
              setBookmaker(v);
              touchPasteUser("bookmaker");
            }}
            label=""
            placeholder="Select bookie or exchange"
            persistCustom={false}
            className={pasteFieldClass(pasteProvenance.bookmaker)}
          />
        </div>
        <OfferUrlField id="offer-url" value={offerUrl} onChange={setOfferUrl} />
        {showAutoAddAccount ? (
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-dashed px-3 py-2.5 text-xs">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={autoAddAccount}
              onChange={(e) => setAutoAddAccount(e.target.checked)}
            />
            <span>
              <span className="font-medium text-foreground">
                Add &ldquo;{bookmakerTrimmed}&rdquo; to Accounts
              </span>
              <span className="mt-0.5 block text-muted-foreground">
                Creates a {autoAddKind} wallet for this venue when you save the offer.
              </span>
            </span>
          </label>
        ) : null}
        <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          <div className="flex flex-col gap-1">
            <PasteFieldLabel htmlFor="offer-exp" provenance={pasteProvenance.expected}>
              Expected profit (£)
            </PasteFieldLabel>
            <Input
              id="offer-exp"
              type="number"
              step="0.01"
              placeholder="45"
              value={expected}
              onChange={(e) => {
                setExpected(e.target.value);
                touchPasteUser("expected");
              }}
              aria-describedby={pasteDescribedBy(pasteProvenance.expected, "offer-exp")}
              className={pasteFieldClass(pasteProvenance.expected)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <PasteFieldLabel htmlFor="offer-starts-on" provenance={pasteProvenance.startsOn}>
              Starts on
            </PasteFieldLabel>
            <DatePicker
              id="offer-starts-on"
              placeholder="Today"
              value={startsOn}
              onChange={(v) => {
                setStartsOn(v);
                touchPasteUser("startsOn");
              }}
              className={pasteFieldClass(pasteProvenance.startsOn)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          <div className="flex flex-col gap-1">
            <PasteFieldLabel
              htmlFor="offer-expires-date"
              provenance={pasteProvenance.expiresAtMs}
            >
              Expires
            </PasteFieldLabel>
            <DatePicker
              id="offer-expires-date"
              value={expiresDate}
              onChange={(v) => {
                setExpiresDate(v);
                touchPasteUser("expiresAtMs");
              }}
              placeholder="Pick a date"
              shortcuts="ending"
              className={pasteFieldClass(pasteProvenance.expiresAtMs)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <PasteFieldLabel
              htmlFor="offer-expires-time"
              provenance={pasteProvenance.expiresAtMs}
            >
              Time
            </PasteFieldLabel>
            <EventTimeInput
              id="offer-expires-time"
              value={expiresTime}
              onChange={(v) => {
                setExpiresTime(v);
                touchPasteUser("expiresAtMs");
              }}
              placeholder="Pick a time"
              shortcuts="ending"
              className={pasteFieldClass(pasteProvenance.expiresAtMs)}
            />
          </div>
        </div>
        {expiryAlreadyPassed ? (
          <p className="text-xs font-medium text-warning">
            This deadline has already passed, so the offer is filed under Expired as soon as
            you save it. Clear or update the date to keep it in the main feed.
          </p>
        ) : startsOn.trim() && startsOn.trim() > localYmd(new Date()) ? (
          <p className="text-xs text-muted-foreground">
            Stays &ldquo;Planned&rdquo; until {startsOn}, then goes live automatically.
          </p>
        ) : null}
        {editingId == null ? (
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-dashed px-3 py-2.5 text-xs">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={repeatsEnabled}
              onChange={(e) => setRepeatsEnabled(e.target.checked)}
            />
            <span>
              <span className="font-medium text-foreground">Repeats</span>
              <span className="mt-0.5 block text-muted-foreground">
                Creates a new offer each occurrence. Each gets its own ID so bets and completion
                stay separate.
              </span>
            </span>
          </label>
        ) : null}
        {editingId == null && repeatsEnabled ? (
          <div className="flex flex-col gap-2 rounded-md border border-dashed px-3 py-2.5">
            <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Frequency</Label>
                <Select
                  value={repeatFreq}
                  onValueChange={(v) => setRepeatFreq(v as RepeatFreq)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="offer-repeat-interval" className="text-xs text-muted-foreground">
                  Every
                </Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="offer-repeat-interval"
                    type="number"
                    min={1}
                    className="w-16"
                    value={repeatInterval}
                    onChange={(e) => setRepeatInterval(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">
                    {repeatFreq === "daily" ? "day(s)" : repeatFreq === "weekly" ? "week(s)" : "month(s)"}
                  </span>
                </div>
              </div>
            </div>

            {repeatFreq === "weekly" ? (
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">On</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAY_LABELS.map((label, day) => {
                    const active = repeatWeekdays.includes(day);
                    return (
                      <FilterPill
                        key={day}
                        active={active}
                        onClick={() =>
                          setRepeatWeekdays((prev) => {
                            if (active) {
                              const next = prev.filter((d) => d !== day);
                              return next.length > 0 ? next : prev;
                            }
                            return [...prev, day].sort();
                          })
                        }
                      >
                        {label}
                      </FilterPill>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {repeatFreq === "monthly" ? (
              <div className="flex flex-col gap-1">
                <Label htmlFor="offer-repeat-monthday" className="text-xs text-muted-foreground">
                  Day of month
                </Label>
                <Input
                  id="offer-repeat-monthday"
                  type="number"
                  min={1}
                  max={31}
                  className="w-20"
                  value={repeatMonthday}
                  onChange={(e) => setRepeatMonthday(e.target.value)}
                />
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Each occurrence stays live for the same span as &ldquo;Starts on&rdquo; → &ldquo;Expires&rdquo;
              above (leave &ldquo;Starts on&rdquo; blank to anchor from today).
            </p>
          </div>
        ) : seriesRecurrence?.enabled ? (
          <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2.5 text-xs">
            <p className="font-medium text-foreground">
              {formatRecurrenceLabel(seriesRecurrence.rule)}
              {seriesRecurrence.instanceDate ? ` · ${seriesRecurrence.instanceDate}` : ""}
            </p>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-muted-foreground">
              <input
                type="checkbox"
                checked={stopRecurrence}
                onChange={(e) => setStopRecurrence(e.target.checked)}
              />
              Stop repeating from this occurrence forward
            </label>
          </div>
        ) : null}
      </FormSection>

      <FormSection
        title="Important - don't forget"
        open={sectionImportant}
        onOpenChange={setSectionImportant}
        summary={formatImportantTermsSummary(importantFromForm()) || undefined}
        accent
      >
        <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
          <div className="flex flex-col gap-1">
            <PasteFieldLabel htmlFor="offer-promo-code" provenance={pasteProvenance.promoCode}>
              Promo / deposit code
            </PasteFieldLabel>
            <Input
              id="offer-promo-code"
              placeholder="e.g. UEFA"
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value.toUpperCase());
                touchPasteUser("promoCode");
                if (e.target.value.trim()) setDepositRequired(true);
              }}
              className={cn(
                "font-semibold tracking-wide",
                pasteFieldClass(pasteProvenance.promoCode)
              )}
            />
          </div>
          <div className="flex flex-col gap-1">
            <PasteFieldLabel htmlFor="offer-min-deposit" provenance={pasteProvenance.minDeposit}>
              Min deposit
            </PasteFieldLabel>
            <Input
              id="offer-min-deposit"
              type="number"
              step="0.01"
              min={0}
              placeholder="£30"
              value={minDeposit}
              onChange={(e) => {
                setMinDeposit(e.target.value);
                touchPasteUser("minDeposit");
                if (e.target.value.trim()) setDepositRequired(true);
              }}
              className={pasteFieldClass(pasteProvenance.minDeposit)}
            />
          </div>
        </div>
        {(promoCode.trim() || minDeposit.trim()) && (
          <p className="text-xs text-warning">
            Step 1 when you start this offer: deposit
            {minDeposit.trim() ? ` £${minDeposit.trim()}+` : ""}
            {promoCode.trim() ? ` with code ${promoCode.trim()}` : ""}.
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <PasteFieldLabel provenance={pasteProvenance.qualifierScopes}>
            Qualifier scope
          </PasteFieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {BET_SCOPES.map((scope) => (
              <FilterPill
                key={`q-${scope}`}
                type="button"
                active={qualifierScopes.includes(scope)}
                onClick={() => {
                  setQualifierScopes((prev) => toggleScope(prev, scope));
                  touchPasteUser("qualifierScopes");
                }}
              >
                {betScopeLabel(scope)}
              </FilterPill>
            ))}
          </div>
          {scopesNeedMinSelections(qualifierScopes) ? (
            <div className="flex flex-col gap-1">
              <PasteFieldLabel
                htmlFor="offer-min-selections"
                provenance={pasteProvenance.minSelections}
              >
                Qualifier min selections
              </PasteFieldLabel>
              <Input
                id="offer-min-selections"
                type="number"
                step="1"
                min={2}
                max={12}
                placeholder="e.g. 3"
                value={minSelections}
                onChange={(e) => {
                  setMinSelections(e.target.value);
                  touchPasteUser("minSelections");
                }}
                aria-describedby={pasteDescribedBy(
                  pasteProvenance.minSelections,
                  "offer-min-selections"
                )}
                className={cn("max-w-[8rem]", pasteFieldClass(pasteProvenance.minSelections))}
              />
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Tick every allowed type. Acca / Bet builder open Combo Desk when entitled; otherwise
            Place uses Add bet.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <PasteFieldLabel provenance={pasteProvenance.rewardScopes}>
            Reward scope
          </PasteFieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {BET_SCOPES.map((scope) => (
              <FilterPill
                key={`r-${scope}`}
                type="button"
                active={rewardScopes.includes(scope)}
                onClick={() => {
                  setRewardScopes((prev) => toggleScope(prev, scope));
                  touchPasteUser("rewardScopes");
                }}
              >
                {betScopeLabel(scope)}
              </FilterPill>
            ))}
          </div>
          {scopesNeedMinSelections(rewardScopes) ? (
            <div className="flex flex-col gap-1">
              <PasteFieldLabel
                htmlFor="offer-reward-min-selections"
                provenance={pasteProvenance.rewardMinSelections}
              >
                Reward min selections
              </PasteFieldLabel>
              <Input
                id="offer-reward-min-selections"
                type="number"
                step="1"
                min={2}
                max={12}
                placeholder="e.g. 3"
                value={rewardMinSelections}
                onChange={(e) => {
                  setRewardMinSelections(e.target.value);
                  touchPasteUser("rewardMinSelections");
                }}
                aria-describedby={pasteDescribedBy(
                  pasteProvenance.rewardMinSelections,
                  "offer-reward-min-selections"
                )}
                className={cn(
                  "max-w-[8rem]",
                  pasteFieldClass(pasteProvenance.rewardMinSelections)
                )}
              />
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Tick every type the free bet can use. Acca / Bet builder open Combo Desk when entitled;
            otherwise Convert uses Add bet.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
          <div className="flex flex-col gap-1">
            <PasteFieldLabel htmlFor="offer-min-odds" provenance={pasteProvenance.minOdds}>
              Min odds
            </PasteFieldLabel>
            <Input
              id="offer-min-odds"
              type="number"
              step="0.01"
              min={1.01}
              placeholder="2.0"
              value={minOdds}
              onChange={(e) => {
                setMinOdds(e.target.value);
                touchPasteUser("minOdds");
              }}
              aria-describedby={pasteDescribedBy(pasteProvenance.minOdds, "offer-min-odds")}
              className={pasteFieldClass(pasteProvenance.minOdds)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <PasteFieldLabel htmlFor="offer-min-stake" provenance={pasteProvenance.minStake}>
              Min stake
            </PasteFieldLabel>
            <Input
              id="offer-min-stake"
              type="number"
              step="0.01"
              min={0}
              placeholder="£"
              value={minStake}
              onChange={(e) => {
                setMinStake(e.target.value);
                touchPasteUser("minStake");
              }}
              aria-describedby={pasteDescribedBy(pasteProvenance.minStake, "offer-min-stake")}
              className={pasteFieldClass(pasteProvenance.minStake)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <PasteFieldLabel htmlFor="offer-max-stake" provenance={pasteProvenance.maxStake}>
              Max stake
            </PasteFieldLabel>
            <Input
              id="offer-max-stake"
              type="number"
              step="0.01"
              min={0}
              placeholder="£"
              value={maxStake}
              onChange={(e) => {
                setMaxStake(e.target.value);
                touchPasteUser("maxStake");
              }}
              aria-describedby={pasteDescribedBy(pasteProvenance.maxStake, "offer-max-stake")}
              className={pasteFieldClass(pasteProvenance.maxStake)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <PasteFieldLabel htmlFor="offer-important" provenance={pasteProvenance.importantNotes}>
            Other must-not-miss
          </PasteFieldLabel>
          <textarea
            id="offer-important"
            rows={4}
            placeholder="Opt-in · SNR · sportsbook only…"
            value={importantNotes}
            onChange={(e) => {
              setImportantNotes(e.target.value);
              touchPasteUser("importantNotes");
            }}
            className={cn(
              fieldControl,
              "min-h-[5.5rem] w-full resize-y px-2.5 py-2 text-sm leading-relaxed outline-none",
              pasteFieldClass(pasteProvenance.importantNotes)
            )}
          />
        </div>
      </FormSection>
      </div>

      <div className="shrink-0 border-t px-6 py-4">
        <DialogSaveButton
          type="submit"
          className="w-full"
          disabled={saving || (titleRequired && !title.trim() && editingId == null)}
        >
          {editingId != null ? (
            <>
              <Save className="size-4" /> Save changes
            </>
          ) : (
            <>
              <Plus className="size-4" /> Add offer
            </>
          )}
        </DialogSaveButton>
      </div>

      <Dialog
        open={seriesConfirmOpen}
        onOpenChange={(next) => {
          if (!next && saving) return;
          setSeriesConfirmOpen(next);
        }}
      >
        <DialogContent
          mobile="center"
          className="max-w-sm"
          showCloseButton={!saving}
          onEscapeKeyDown={(e) => {
            if (saving) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (saving) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Update repeats?</DialogTitle>
            <DialogDescription
              explainer={
                <DialogExplainer title="Repeating offer">
                  This offer repeats
                  {seriesRecurrence?.rule
                    ? ` (${formatRecurrenceLabel(seriesRecurrence.rule).toLowerCase()})`
                    : ""}
                  . {otherOccurrenceCount} other occurrence
                  {otherOccurrenceCount === 1 ? "" : "s"}.
                </DialogExplainer>
              }
            >
              Choose what to update.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2 text-sm">
            <legend className="sr-only">Update scope</legend>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name="offer-series-update-scope"
                className="mt-1"
                checked={seriesUpdateScope === "instance"}
                onChange={() => setSeriesUpdateScope("instance")}
              />
              <span>
                <span className="font-medium text-foreground">This occurrence only</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Later repeats keep the previous terms.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="radio"
                name="offer-series-update-scope"
                className="mt-1"
                checked={seriesUpdateScope === "series"}
                onChange={() => setSeriesUpdateScope("series")}
              />
              <span>
                <span className="font-medium text-foreground">This and other occurrences</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Updates the series template and untouched repeats. Occurrences with bets stay as
                  they are.
                </span>
              </span>
            </label>
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSeriesConfirmOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <DialogSaveButton
              type="button"
              disabled={saving}
              onClick={() => void persistOffer(seriesUpdateScope === "series")}
            >
              {saving ? "Saving…" : "Save"}
            </DialogSaveButton>
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}
