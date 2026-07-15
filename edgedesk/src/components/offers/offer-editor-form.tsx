"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OfferPasteDialog } from "@/components/offers/offer-paste-dialog";
import { OfferCategoryIcon } from "@/components/offers/offer-category-icon";
import { RegionFlag } from "@/components/region-flag";
import { VenueSelect } from "@/components/venue-select";
import { api } from "@/hooks/use-app-state";
import type { OfferSummary } from "@/lib/services/offers.types";
import type { RacingRacecard } from "@/lib/services/theracingapi";
import {
  formatBetGetFreePlaceSummary,
  isRegionalScope,
  parseOfferRules,
} from "@/lib/offers/racing-offer-rules";
import {
  OFFER_CATEGORIES,
  normalizeOfferCategoryId,
  offerCategoryById,
  offerCategoryFromSport,
  type OfferCategoryId,
} from "@/lib/offers/offer-categories";
import {
  buildPromoTermsRules,
  emptyImportantTerms,
  formatImportantTermsSummary,
  formatOfferExpiry,
  fromDatetimeLocalValue,
  mergeImportantIntoRacingRules,
  readImportantTerms,
  toDatetimeLocalValue,
  type OfferImportantTerms,
} from "@/lib/offers/offer-terms";
import { normalizeOfferDetailsText } from "@/lib/offers/offer-odds-text";
import { missedOfferLabelForCategory } from "@/lib/offers/offer-expiry";
import { formatRecurrenceLabel } from "@/lib/offers/offer-recurrence-shared";
import type { ParsedOfferDraft } from "@/lib/offers/parse-offer-text";
import { formatApiError } from "@/lib/api-errors";
import { filterPillState } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronDown, Pencil, Plus } from "lucide-react";

export type OfferEditorPrefill = {
  category?: OfferCategoryId;
  eventDate?: string;
  editOffer?: OfferSummary;
};

type OfferStatus = "planned" | "active" | "completed" | "expired";
type ScopeMode = "uk_ire" | "course" | "race";

function formImportantFromState(input: {
  minOdds: string;
  minStake: string;
  maxStake: string;
  importantNotes: string;
}): OfferImportantTerms {
  const odds = input.minOdds.trim() ? parseFloat(input.minOdds) : NaN;
  const minS = input.minStake.trim() ? parseFloat(input.minStake) : NaN;
  const maxS = input.maxStake.trim() ? parseFloat(input.maxStake) : NaN;
  return {
    minOdds: Number.isFinite(odds) && odds > 1 ? odds : null,
    minStake: Number.isFinite(minS) && minS > 0 ? minS : null,
    maxStake: Number.isFinite(maxS) && maxS > 0 ? maxS : null,
    importantNotes: input.importantNotes.trim(),
  };
}

function raceLabel(card: Pick<RacingRacecard, "offTime" | "raceName">): string {
  const name = card.raceName?.trim();
  return name ? `${card.offTime} · ${name}` : card.offTime;
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
          <span className="max-w-[55%] truncate text-[11px] text-muted-foreground">
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
    return {
      editingId: offer.id as number | null,
      title: offer.title,
      bookmaker: offer.bookmaker ?? "",
      expected: offer.expectedProfit != null ? String(offer.expectedProfit) : "",
      expires: offer.expiresAt ? toDatetimeLocalValue(offer.expiresAt) : "",
      offerStatus: offer.status as OfferStatus,
      category: offerCategoryFromSport(offer.sport),
      betStake: rules ? String(rules.betStake) : "50",
      freeBetAmount: rules ? String(rules.freeBetAmount) : "50",
      minRunners: rules ? String(rules.minRunners) : "8",
      qualifyingPlaces: (rules?.qualifyingPlaces?.length
        ? rules.qualifyingPlaces
        : [2, 3, 4]) as number[],
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
      repeatsEnabled: false,
      stopRecurrence: false,
      seriesRecurrence: offer.recurrence ?? null,
    };
  }

  const empty = emptyImportantTerms();
  return {
    editingId: null as number | null,
    title: "",
    bookmaker: "",
    expected: "",
    expires: "",
    offerStatus: "active" as OfferStatus,
    category: (prefill?.category ?? "general") as OfferCategoryId,
    betStake: "50",
    freeBetAmount: "50",
    minRunners: "8",
    qualifyingPlaces: [2, 3, 4] as number[],
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
    repeatsEnabled: false,
    stopRecurrence: false,
    seriesRecurrence: null as import("@/lib/services/offers.types").OfferRecurrenceMeta | null,
  };
}

type Boot = ReturnType<typeof initialFromPrefill>;

export function OfferEditorForm({
  prefill,
  open = true,
  onSaved,
}: {
  prefill?: OfferEditorPrefill;
  open?: boolean;
  onSaved: () => void;
}) {
  const boot = initialFromPrefill(prefill);
  const [title, setTitle] = useState(boot.title);
  const [bookmaker, setBookmaker] = useState(boot.bookmaker);
  const [expected, setExpected] = useState(boot.expected);
  const [expires, setExpires] = useState(boot.expires);
  const [offerStatus, setOfferStatus] = useState<OfferStatus>(boot.offerStatus);
  const [category, setCategory] = useState<OfferCategoryId>(boot.category);
  const [betStake, setBetStake] = useState(boot.betStake);
  const [freeBetAmount, setFreeBetAmount] = useState(boot.freeBetAmount);
  const [minRunners, setMinRunners] = useState(boot.minRunners);
  const [qualifyingPlaces, setQualifyingPlaces] = useState<number[]>(boot.qualifyingPlaces);
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
  const [repeatsEnabled, setRepeatsEnabled] = useState(boot.repeatsEnabled);
  const [stopRecurrence, setStopRecurrence] = useState(boot.stopRecurrence);
  const [seriesRecurrence, setSeriesRecurrence] = useState(boot.seriesRecurrence);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(boot.editingId);
  const [racecards, setRacecards] = useState<RacingRacecard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [sectionRacing, setSectionRacing] = useState(true);
  const [sectionScope, setSectionScope] = useState(false);
  const [sectionDetails, setSectionDetails] = useState(true);
  const [sectionImportant, setSectionImportant] = useState(true);

  function applyBoot(next: Boot) {
    setTitle(next.title);
    setBookmaker(next.bookmaker);
    setExpected(next.expected);
    setExpires(next.expires);
    setOfferStatus(next.offerStatus);
    setCategory(next.category);
    setBetStake(next.betStake);
    setFreeBetAmount(next.freeBetAmount);
    setMinRunners(next.minRunners);
    setQualifyingPlaces(next.qualifyingPlaces);
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
    setRepeatsEnabled(next.repeatsEnabled);
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

  // Load Racing Desk racecards for the chosen day (courses + races)
  useEffect(() => {
    if (!open || !isRacingCategory || !eventDate) {
      queueMicrotask(() => setRacecards([]));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setCardsLoading(true);
    });
    api<{ racecards: RacingRacecard[] }>(`/api/racing/racecards?date=${encodeURIComponent(eventDate)}`)
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
  }, [open, isRacingCategory, eventDate]);

  const courses = useMemo(() => {
    const byName = new Map<string, string | undefined>();
    for (const c of racecards) {
      const name = c.course?.trim();
      if (!name) continue;
      if (!byName.has(name)) byName.set(name, c.region);
    }
    if (scopeCourse.trim()) {
      const hit = [...byName.keys()].find(
        (c) => c.toLowerCase() === scopeCourse.trim().toLowerCase()
      );
      if (!hit) byName.set(scopeCourse.trim(), undefined);
    }
    return [...byName.entries()]
      .map(([name, region]) => ({ name, region }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [racecards, scopeCourse]);

  const racesAtCourse = useMemo(() => {
    if (!scopeCourse.trim()) return [];
    return racecards
      .filter((c) => c.course.trim().toLowerCase() === scopeCourse.trim().toLowerCase())
      .slice()
      .sort((a, b) => a.offTime.localeCompare(b.offTime));
  }, [racecards, scopeCourse]);

  // Resolve preferred off-time (from paste) → race id once cards load
  useEffect(() => {
    if (scopeMode !== "race" || !preferredOffTime || !scopeCourse.trim()) return;
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
  }, [scopeMode, preferredOffTime, scopeCourse, scopeRaceId, racesAtCourse]);

  function setImportantFromTerms(terms: OfferImportantTerms) {
    setMinOdds(terms.minOdds != null ? String(terms.minOdds) : "");
    setMinStake(terms.minStake != null ? String(terms.minStake) : "");
    setMaxStake(terms.maxStake != null ? String(terms.maxStake) : "");
    setImportantNotes(terms.importantNotes);
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
    }
  }

  function buildOfferPayload() {
    const isRacing = isRacingCategory;
    const cat = offerCategoryById(category);
    const important = formImportantFromState({ minOdds, minStake, maxStake, importantNotes });
    const normalizedImportant = {
      ...important,
      importantNotes: normalizeOfferDetailsText(important.importantNotes),
    };
    const stake = parseFloat(betStake) || 50;
    const free = parseFloat(freeBetAmount) || stake;
    const places = qualifyingPlaces.length > 0 ? qualifyingPlaces : ([2, 3, 4] as number[]);
    const placeLabel =
      places.length === 2 && places[0] === 2 && places[1] === 3
        ? "2nd & 3rd"
        : places.length === 3 && places[0] === 2 && places[2] === 4
          ? "2nd–4th place"
          : `places ${places.join(", ")}`;
    const racingTitle =
      title.trim() || `Bet £${stake} get £${free} free bet (${placeLabel})`;
    const regions =
      scopeMode === "uk_ire"
        ? scopeRegions.length > 0
          ? scopeRegions
          : (["GB", "IRE"] as ("GB" | "IRE")[])
        : (["GB", "IRE"] as ("GB" | "IRE")[]);

    const racingRules = isRacing
      ? {
          type: "bet_get_free_place" as const,
          minRunners: parseInt(minRunners, 10) || 8,
          regions,
          qualifyingPlaces: places,
          betStake: stake,
          freeBetAmount: free,
        }
      : null;

    const rulesPayload = isRacing
      ? JSON.stringify(mergeImportantIntoRacingRules(racingRules!, normalizedImportant))
      : (() => {
          const promo = buildPromoTermsRules(normalizedImportant);
          return promo ? JSON.stringify(promo) : null;
        })();

    const importantSummary = formatImportantTermsSummary(normalizedImportant);
    const description = normalizeOfferDetailsText(
      isRacing
        ? [formatBetGetFreePlaceSummary(racingRules!), importantSummary].filter(Boolean).join(" · ")
        : importantSummary ?? ""
    );

    const courseValue =
      scopeMode === "uk_ire" ? "uk_ire" : scopeCourse.trim() || "uk_ire";

    return {
      title: isRacing ? racingTitle : title.trim(),
      bookmaker: bookmaker.trim() || undefined,
      expectedProfit: expected.trim() ? parseFloat(expected) : undefined,
      status: offerStatus,
      expiresAt: fromDatetimeLocalValue(expires),
      sport: cat.sport,
      description: description ?? "",
      ...(editingId == null && repeatsEnabled
        ? { recurrence: { freq: "daily" as const, interval: 1 } }
        : {}),
      ...(editingId != null && stopRecurrence && seriesRecurrence?.enabled
        ? { stopRecurrence: true }
        : {}),
      ...(isRacing
        ? {
            offerType: "bet_get_free_place",
            scopeCourse: courseValue,
            eventDate,
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
    if (isRacingCategory) {
      const stake = parseFloat(betStake);
      const free = parseFloat(freeBetAmount);
      const runners = parseInt(minRunners, 10);
      if (!Number.isFinite(stake) || stake <= 0) {
        setSectionRacing(true);
        return "Enter a bet stake greater than 0.";
      }
      if (!Number.isFinite(free) || free <= 0) {
        setSectionRacing(true);
        return "Enter a free bet amount greater than 0.";
      }
      if (!Number.isFinite(runners) || runners < 5) {
        setSectionRacing(true);
        return "Min runners must be at least 5.";
      }
      if (!eventDate.trim()) {
        setSectionScope(true);
        return "Pick a racing day.";
      }
      if ((scopeMode === "course" || scopeMode === "race") && !scopeCourse.trim()) {
        setSectionScope(true);
        return "Pick a course from the Racing Desk list.";
      }
      if (scopeMode === "race" && !scopeRaceId.trim()) {
        setSectionScope(true);
        return "Pick a specific race.";
      }
    }
    if (expires.trim() && fromDatetimeLocalValue(expires) == null) {
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

  function applyPasteDraft(draft: ParsedOfferDraft) {
    setEditingId(null);
    setCategory(draft.category);
    setTitle(draft.title);
    setBookmaker(draft.bookmaker ?? "");
    setExpected(draft.expectedProfit != null ? String(draft.expectedProfit) : "");
    setExpires(draft.expiresAt != null ? toDatetimeLocalValue(draft.expiresAt) : "");
    setOfferStatus("active");
    setImportantFromTerms(draft.important);
    setSectionDetails(true);
    setSectionImportant(true);
    if (offerCategoryById(draft.category).isRacing) {
      setBetStake(draft.betStake != null ? String(draft.betStake) : "");
      setFreeBetAmount(draft.freeBetAmount != null ? String(draft.freeBetAmount) : "");
      setMinRunners(draft.minRunners != null ? String(draft.minRunners) : "8");
      setQualifyingPlaces(
        draft.qualifyingPlaces.length > 0 ? draft.qualifyingPlaces : [2, 3, 4]
      );
      setScopeMode(draft.scopeMode);
      setScopeCourse(draft.scopeCourse);
      setScopeRaceId("");
      setScopeRaceLabel(
        draft.preferredOffTime ? `${draft.preferredOffTime} · resolving…` : ""
      );
      setPreferredOffTime(draft.preferredOffTime);
      setScopeRegions(draft.scopeRegions.length > 0 ? draft.scopeRegions : ["GB", "IRE"]);
      setEventDate(draft.eventDate ?? new Date().toISOString().slice(0, 10));
      setSectionRacing(true);
      // Expand scope when paste pinned a course/race so the user can confirm
      setSectionScope(draft.scopeMode !== "uk_ire");
    }
    const expiryHint =
      draft.expiresAt != null
        ? `Expires ${formatOfferExpiry(draft.expiresAt)}`
        : "Check expiry";
    toast.success("Offer form filled from paste", {
      description: `${expiryHint} · review bookie and stakes, then save.`,
    });
  }

  async function saveOffer(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateBeforeSave();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSaving(true);
    try {
      const payload = buildOfferPayload();
      if (editingId != null) {
        await api(`/api/offers/${editingId}`, { method: "PATCH", json: payload });
        toast.success("Offer updated");
      } else {
        await api("/api/offers", { method: "POST", json: payload });
        toast.success("Offer added");
      }
      onSaved();
    } catch (err) {
      toast.error(editingId != null ? "Could not update offer" : "Could not create offer", {
        description: formatApiError(err),
      });
    } finally {
      setSaving(false);
    }
  }

  const scopeSummary =
    scopeMode === "uk_ire"
      ? `UK & IRE · ${eventDate}`
      : scopeMode === "race"
        ? `${scopeCourse || "Course"} · ${scopeRaceLabel || "pick race"} · ${eventDate}`
        : `${scopeCourse || "Course"} · ${eventDate}`;

  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={saveOffer}>
      <div className="flex-1 space-y-2.5 overflow-y-auto px-6 py-5">
      <div className="flex items-end gap-2">
        <div className="grid flex-1 grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-[11px] text-muted-foreground">Category</Label>
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
            <Label className="text-[11px] text-muted-foreground">Status</Label>
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
        {editingId == null ? <OfferPasteDialog onApply={applyPasteDraft} /> : null}
      </div>

      {isRacingCategory && (
        <FormSection
          title="Racing terms"
          open={sectionRacing}
          onOpenChange={setSectionRacing}
          summary={`£${betStake || "-"} → £${freeBetAmount || "-"} · min ${minRunners || "-"}`}
        >
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="offer-stake" className="text-[11px] text-muted-foreground">
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
              <Label htmlFor="offer-free" className="text-[11px] text-muted-foreground">
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
            <div className="flex flex-col gap-1">
              <Label htmlFor="offer-min-runners" className="text-[11px] text-muted-foreground">
                Min runners
              </Label>
              <Input
                id="offer-min-runners"
                type="number"
                min={5}
                value={minRunners}
                onChange={(e) => setMinRunners(e.target.value)}
              />
            </div>
          </div>
        </FormSection>
      )}

      {isRacingCategory && (
        <FormSection
          title="Scope"
          open={sectionScope}
          onOpenChange={setSectionScope}
          summary={scopeSummary}
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="offer-event-date" className="text-[11px] text-muted-foreground">
                Racing day
              </Label>
              <Input
                id="offer-event-date"
                type="date"
                value={eventDate}
                onChange={(e) => {
                  setEventDate(e.target.value);
                  setScopeRaceId("");
                  setScopeRaceLabel("");
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">Scope</Label>
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
              <Label className="text-[11px] text-muted-foreground">Regions</Label>
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
                      <span className="inline-flex items-center gap-1.5">
                        <RegionFlag code={id} />
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(scopeMode === "course" || scopeMode === "race") && (
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">Course</Label>
              {courses.length > 0 ? (
                <Select
                  value={
                    courses.find((c) => c.name.toLowerCase() === scopeCourse.trim().toLowerCase())
                      ?.name ?? (scopeCourse || undefined)
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
              {!cardsLoading && courses.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Racecards available for today/tomorrow when Racing API is connected.
                </p>
              ) : null}
            </div>
          )}

          {scopeMode === "race" && (
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">Race</Label>
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
                        scopeCourse ? "Pick race time" : "Pick a course first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {racesAtCourse.map((r) => (
                      <SelectItem key={r.externalId} value={r.externalId}>
                        {raceLabel(r)}
                        <span className="ml-1.5 text-muted-foreground">
                          · {r.fieldSize} runners
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-md border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
                  {scopeCourse
                    ? cardsLoading
                      ? "Loading races…"
                      : "No races listed for this course on that day."
                    : "Choose a course to see race times."}
                </p>
              )}
            </div>
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
          expires ? formatOfferExpiry(fromDatetimeLocalValue(expires) ?? 0) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="offer-title" className="text-[11px] text-muted-foreground">
            {isRacingCategory ? "Title (optional)" : "Title"}
          </Label>
          <Input
            id="offer-title"
            placeholder={
              isRacingCategory ? "Auto-generated from stake amounts" : "Bet £50 get £50 free bet"
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <VenueSelect
          value={bookmaker}
          onChange={setBookmaker}
          label="Bookie / Exchange"
          placeholder="Select bookie or exchange"
        />
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="offer-exp" className="text-[11px] text-muted-foreground">
              Expected profit (£)
            </Label>
            <Input
              id="offer-exp"
              type="number"
              step="0.01"
              placeholder="45"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="offer-expires" className="text-[11px] text-muted-foreground">
              Expires
            </Label>
            <Input
              id="offer-expires"
              type="datetime-local"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </div>
        </div>
        {editingId == null ? (
          <label className="flex cursor-pointer items-start gap-2 rounded-md border border-dashed px-3 py-2.5 text-xs">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={repeatsEnabled}
              onChange={(e) => setRepeatsEnabled(e.target.checked)}
            />
            <span>
              <span className="font-medium text-foreground">Repeats daily</span>
              <span className="mt-0.5 block text-muted-foreground">
                Creates a new offer each day for the next 2 weeks. Each day gets its own ID so
                bets and completion stay separate.
              </span>
            </span>
          </label>
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
        summary={
          formatImportantTermsSummary(
            formImportantFromState({ minOdds, minStake, maxStake, importantNotes })
          ) || undefined
        }
        accent
      >
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="offer-min-odds" className="text-[11px] text-muted-foreground">
              Min odds
            </Label>
            <Input
              id="offer-min-odds"
              type="number"
              step="0.01"
              min={1.01}
              placeholder="2.0"
              value={minOdds}
              onChange={(e) => setMinOdds(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="offer-min-stake" className="text-[11px] text-muted-foreground">
              Min stake
            </Label>
            <Input
              id="offer-min-stake"
              type="number"
              step="0.01"
              min={0}
              placeholder="£"
              value={minStake}
              onChange={(e) => setMinStake(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="offer-max-stake" className="text-[11px] text-muted-foreground">
              Max stake
            </Label>
            <Input
              id="offer-max-stake"
              type="number"
              step="0.01"
              min={0}
              placeholder="£"
              value={maxStake}
              onChange={(e) => setMaxStake(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="offer-important" className="text-[11px] text-muted-foreground">
            Other must-not-miss
          </Label>
          <textarea
            id="offer-important"
            rows={2}
            placeholder="SNR · new customers only · min 3 selections…"
            value={importantNotes}
            onChange={(e) => setImportantNotes(e.target.value)}
            className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2"
          />
        </div>
      </FormSection>
      </div>

      <div className="shrink-0 border-t px-6 py-4">
        <Button
          type="submit"
          className="w-full"
          disabled={saving || (titleRequired && !title.trim() && editingId == null)}
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
      </div>
    </form>
  );
}
