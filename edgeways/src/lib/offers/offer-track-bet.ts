import type { AddBetPrefill } from "@/components/add-bet-dialog";
import type { AccaRunPrefill } from "@/lib/acca/acca-run-prefill";
import type { BetBuilderRunPrefill } from "@/lib/bet-builder/bet-builder-run-prefill";
import type { BetMode } from "@/lib/calc";
import { offerTriggerDetectedInLabel } from "@/lib/calc/ai-triggers";
import { canUseAccaDesk } from "@/lib/entitlements/acca-desk";
import { canUseBetBuilderDesk } from "@/lib/entitlements/bet-builder-desk";
import { deriveOfferNextAction } from "@/lib/offers/next-actions";
import {
  currentPlaybookStep,
  playbookFromOffer,
} from "@/lib/offers/offer-playbook";
import {
  betTypeUsesOfferVenueScope,
  isRegionalScope,
  parseOfferRules,
  placeRefundTriggerText,
} from "@/lib/offers/racing-offer-rules";
import {
  betScopeLabel,
  readImportantTerms,
  type BetScope,
  type OfferImportantTerms,
} from "@/lib/offers/offer-terms";
import {
  inferRewardEventSport,
  parseRewardEventTeams,
} from "@/lib/offers/reward-event-scope";
import {
  bookmakerFromOfferPrefs,
  stakeFromOfferPrefs,
  type AppSettings,
} from "@/lib/services/settings-shared";
import { isKnownSport } from "@/lib/sports";
import type { OfferSummary } from "@/lib/services/offers.types";
import { FREE_BET_EV_RETENTION } from "@/lib/offers/offer-intelligence/estimates";
import { isRefundIfOffer } from "@/lib/offers/refund-if";

function ctaLabelForAction(
  action: ReturnType<typeof deriveOfferNextAction>,
  betType: BetMode,
  enabled: boolean
): string {
  if (!enabled && action?.title) return action.title;
  if (action?.kind === "convert_free_bet" || betType === "free_snr") {
    return "Convert free bet";
  }
  if (action?.kind === "start_planned") return "Start campaign";
  if (betType === "risk_free") return "Place refund-if bet";
  if (action?.kind === "place_qualifying" || action?.kind === "review_expiry") {
    return "Place qualifying bet";
  }
  return "Place qualifying bet";
}

/**
 * Offer-trigger text for a qualifying leg: structured place-refund rules when
 * present, otherwise a title that already parses as a bet&get / free-bet promo
 * (e.g. "Bet £10 get £10 free bet" on a General campaign).
 */
export function qualifyingOfferTriggerText(
  offer: Pick<OfferSummary, "title" | "offerType" | "rules">
): string | null {
  const rules = parseOfferRules(offer);
  if (isRefundIfOffer(offer) || rules?.refundIf) {
    const stake = rules?.betStake;
    const refund = rules?.freeBetAmount ?? stake;
    if (stake != null && refund != null) {
      return `Bet £${stake} get £${refund} free bet if bet loses`;
    }
    const title = offer.title.trim();
    return title || "Money back if bet loses";
  }
  if (rules) return placeRefundTriggerText(rules);
  const title = offer.title.trim();
  if (title && offerTriggerDetectedInLabel(title)) return title;
  return null;
}

export type ConcreteTrackBetDestination =
  | { kind: "add_bet"; prefill: AddBetPrefill; scopeHint: BetScope }
  | { kind: "acca_desk"; prefill: AccaRunPrefill }
  | { kind: "bet_builder_desk"; prefill: BetBuilderRunPrefill };

export type PlacementOption = {
  id: string;
  scope: BetScope;
  label: string;
  description: string;
  destination: ConcreteTrackBetDestination;
  /** Minimal Add-bet shape for orphan "mark placed" quick-log. */
  markPrefill: AddBetPrefill;
};

export type TrackBetDestination =
  | ConcreteTrackBetDestination
  | { kind: "choose"; options: PlacementOption[] }
  /** Soft playbook gates (deposit / opt-in / WR / await) — footer confirms the step. */
  | { kind: "playbook_mark_done"; stepId: string }
  /** Existing Acca / Bet Builder / Systems run — open that desk, don't create another. */
  | { kind: "open_desk"; href: "/acca" | "/bet-builder" | "/systems" }
  | { kind: "none" };

export interface TrackBetAction {
  enabled: boolean;
  label: string;
  reason: string | null;
  destination: TrackBetDestination;
  /**
   * Prefill for Add bet and for orphan "mark placed" quick-log.
   * Present whenever the track action is enabled (including Acca Desk / chooser).
   */
  prefill: AddBetPrefill | null;
}

export type TrackBetSettings = Pick<
  AppSettings,
  "offerBetPrefs" | "defaultBackStake" | "planPreview" | "billing"
>;

function rewardEventNote(important: OfferImportantTerms): string | null {
  if (!important.rewardEventLabel?.trim()) return null;
  const date = important.rewardEventDate?.trim();
  return date
    ? `Free bet locked to ${important.rewardEventLabel.trim()} (${date})`
    : `Free bet locked to ${important.rewardEventLabel.trim()}`;
}

function mergeImportantNotes(
  important: OfferImportantTerms,
  purpose: "qualify" | "convert"
): string | null {
  const bits = [important.importantNotes.trim()].filter(Boolean);
  if (purpose === "convert") {
    const locked = rewardEventNote(important);
    if (locked && !bits.some((b) => b.includes(important.rewardEventLabel!.trim()))) {
      bits.unshift(locked);
    }
  }
  return bits.length > 0 ? bits.join(" · ") : null;
}

function convertSport(
  purpose: "qualify" | "convert",
  offerSport: string | null | undefined,
  important: OfferImportantTerms
): string | null {
  if (purpose === "convert") {
    const scoped = inferRewardEventSport(important.rewardEventLabel, offerSport);
    if (scoped) return scoped;
  }
  return isKnownSport(offerSport) ? offerSport : (offerSport ?? null);
}

function buildAccaPrefill(input: {
  offer: OfferSummary;
  important: OfferImportantTerms;
  stake: number;
  bookmaker: string | undefined;
  purpose: "qualify" | "convert";
}): AccaRunPrefill {
  const { offer, important, stake, bookmaker, purpose } = input;
  const isConvert = purpose === "convert";
  const minSelections = isConvert
    ? important.rewardMinSelections ?? important.minSelections
    : important.minSelections;
  const eventLabel = important.rewardEventLabel?.trim();
  const prefill: AccaRunPrefill = {
    offerId: offer.id,
    label: isConvert
      ? eventLabel
        ? `Convert FB · ${eventLabel}`
        : `Convert FB · ${bookmaker ?? offer.title}`
      : offer.title.trim() || `Qualify · ${bookmaker ?? "Acca"}`,
    stake,
    bookmaker,
    sport: convertSport(purpose, offer.sport, important),
    minOdds: important.minOdds,
    minStake: isConvert ? null : important.minStake,
    maxStake: important.maxStake,
    minSelections,
    importantNotes: mergeImportantNotes(important, purpose),
    suggestedMethod: "sequential",
    scope: "acca",
    purpose,
    backBetType: isConvert ? "free_snr" : "qualifying",
  };

  // Same as Add bet: course lock is qualify-only. Convert stays sport-wide.
  if (
    purpose === "qualify" &&
    offer.sport === "horse_racing" &&
    betTypeUsesOfferVenueScope("qualifying")
  ) {
    const course = offer.scopeCourse?.trim();
    if (course && !isRegionalScope(course)) {
      prefill.scopeCourse = course;
      prefill.sport = "horse_racing";
    }
  }

  return prefill;
}

function buildBetBuilderPrefill(input: {
  offer: OfferSummary;
  important: OfferImportantTerms;
  stake: number;
  bookmaker: string | undefined;
  purpose: "qualify" | "convert";
}): BetBuilderRunPrefill {
  const { offer, important, stake, bookmaker, purpose } = input;
  const isConvert = purpose === "convert";
  const minSelections = isConvert
    ? important.rewardMinSelections ?? important.minSelections
    : important.minSelections;
  const eventLabel = important.rewardEventLabel?.trim();
  return {
    offerId: offer.id,
    label: isConvert
      ? eventLabel
        ? `Convert FB · ${eventLabel}`
        : `Convert FB · ${bookmaker ?? offer.title}`
      : offer.title.trim() || `Qualify · ${bookmaker ?? "Bet builder"}`,
    stake,
    bookmaker,
    sport: convertSport(purpose, offer.sport, important),
    minOdds: important.minOdds,
    minStake: isConvert ? null : important.minStake,
    maxStake: important.maxStake,
    minSelections,
    importantNotes: mergeImportantNotes(important, purpose),
    suggestedMethod: "combined",
    purpose,
    backBetType: isConvert ? "free_snr" : "qualifying",
  };
}

function applyRewardEventConvertScope(
  prefill: AddBetPrefill,
  important: OfferImportantTerms
): void {
  const eventLabel = important.rewardEventLabel?.trim();
  if (!eventLabel) return;
  const teams = parseRewardEventTeams(eventLabel);
  const sport = inferRewardEventSport(eventLabel, prefill.sport);
  if (sport) {
    prefill.sport = sport;
    if (sport === "football") prefill.market = "match_odds";
  }
  if (teams) {
    prefill.homeTeam = teams.homeTeam;
    prefill.awayTeam = teams.awayTeam;
  }
  const date = important.rewardEventDate?.trim();
  if (date) {
    prefill.eventDate = date;
    prefill.raceEventDate = date;
  }
  prefill.rewardEventLabel = eventLabel;
  // Convert must not carry a qualifying offer trigger. The lock lives on
  // rewardEventLabel so Add bet can caption it without filling Offer trigger.
  delete prefill.triggerText;
}

function buildAddBetPrefill(input: {
  offer: OfferSummary;
  important: OfferImportantTerms;
  betType: BetMode;
  stake: number;
  bookmaker: string | undefined;
}): AddBetPrefill {
  const { offer, important, betType, stake, bookmaker } = input;
  const eventLabel = important.rewardEventLabel?.trim();
  const knownSport = isKnownSport(offer.sport) ? offer.sport : undefined;
  const prefill: AddBetPrefill = {
    offerId: offer.id,
    betType,
    backStake: stake,
    bookmaker,
    sport: knownSport,
    labelSuggestion:
      betType === "free_snr"
        ? eventLabel
          ? `Convert FB · ${eventLabel}`
          : `Convert FB · ${bookmaker ?? offer.title}`
        : `Qualify · ${bookmaker ?? offer.title}`,
  };

  if (betType === "qualifying" || betType === "risk_free") {
    const trigger = qualifyingOfferTriggerText(offer);
    if (trigger) prefill.triggerText = trigger;
  }

  if (betType === "risk_free") {
    const rules = parseOfferRules(offer);
    const refund = rules?.freeBetAmount ?? rules?.betStake ?? stake;
    prefill.refundAmount = refund;
    prefill.refundRetention = FREE_BET_EV_RETENTION;
    prefill.labelSuggestion = `Refund-if · ${bookmaker ?? offer.title}`;
  }

  if (offer.sport === "horse_racing") {
    prefill.sport = "horse_racing";
    prefill.market = "win";
    // Awarded free bets are sport-locked only. Course / race / meeting-day
    // stay on the qualifying leg so convert can use any horse race.
    if (betTypeUsesOfferVenueScope(betType)) {
      const course = offer.scopeCourse?.trim();
      if (course && !isRegionalScope(course)) {
        prefill.scopeCourse = course;
        if (offer.eventDate?.trim()) prefill.raceEventDate = offer.eventDate.trim();
      }
      if (offer.scopeRaceLabel?.trim()) {
        prefill.labelSuggestion = course
          ? `${course} · ${offer.scopeRaceLabel.trim()}`
          : offer.scopeRaceLabel.trim();
      }
      if (offer.scopeRaceId?.trim()) {
        prefill.raceExternalId = offer.scopeRaceId.trim();
        if (offer.eventDate?.trim()) prefill.raceEventDate = offer.eventDate.trim();
      }
    }
  }

  // Named free-bet lock wins over campaign sport / racing defaults.
  if (betType === "free_snr") {
    applyRewardEventConvertScope(prefill, important);
  }

  return prefill;
}

function optionForScope(input: {
  scope: BetScope;
  purpose: "qualify" | "convert";
  offer: OfferSummary;
  important: OfferImportantTerms;
  betType: BetMode;
  stake: number;
  bookmaker: string | undefined;
  settings?: TrackBetSettings | null;
}): PlacementOption {
  const { scope, purpose, offer, important, betType, stake, bookmaker, settings } = input;
  const id = `${purpose}-${scope}`;
  const addPrefill = buildAddBetPrefill({ offer, important, betType, stake, bookmaker });

  if (scope === "acca") {
    if (canUseAccaDesk(settings)) {
      return {
        id,
        scope,
        label: purpose === "convert" ? "Acca Desk" : "Acca Desk",
        description:
          purpose === "convert"
            ? "Convert the free bet with legs and sequential lay."
            : "Build the qualifying Acca with legs and sequential lay.",
        markPrefill: addPrefill,
        destination: {
          kind: "acca_desk",
          prefill: buildAccaPrefill({
            offer,
            important,
            stake,
            bookmaker,
            purpose,
          }),
        },
      };
    }
    return {
      id,
      scope,
      label: "Acca",
      description: "Log the Acca in Add bet (Acca Desk needs a paid plan).",
      markPrefill: addPrefill,
      destination: { kind: "add_bet", prefill: addPrefill, scopeHint: "acca" },
    };
  }

  if (scope === "bet_builder") {
    if (canUseBetBuilderDesk(settings)) {
      return {
        id,
        scope,
        label: "Bet Builder Desk",
        description:
          purpose === "convert"
            ? "Convert the free bet on Bet Builder Desk (combined lay or no lay)."
            : "Build the qualifying bet builder (combined lay or no lay).",
        markPrefill: addPrefill,
        destination: {
          kind: "bet_builder_desk",
          prefill: buildBetBuilderPrefill({
            offer,
            important,
            stake,
            bookmaker,
            purpose,
          }),
        },
      };
    }
    return {
      id,
      scope,
      label: "Bet builder",
      description: "Log the bet builder in Add bet (Bet Builder Desk needs a paid plan).",
      markPrefill: addPrefill,
      destination: { kind: "add_bet", prefill: addPrefill, scopeHint: "bet_builder" },
    };
  }

  return {
    id,
    scope: "single",
    label: "Single",
    description: "Log a single selection in Add bet.",
    markPrefill: addPrefill,
    destination: { kind: "add_bet", prefill: addPrefill, scopeHint: "single" },
  };
}

function finalizeFromOptions(
  options: PlacementOption[],
  fallbackLabel: string,
  purpose: "qualify" | "convert"
): TrackBetAction {
  if (options.length === 0) {
    return {
      enabled: false,
      label: fallbackLabel,
      reason: "Nothing to log at this campaign step.",
      destination: { kind: "none" },
      prefill: null,
    };
  }

  if (options.length === 1) {
    const only = options[0]!;
    const dest = only.destination;
    let label = fallbackLabel;
    if (dest.kind === "acca_desk") {
      label = purpose === "convert" ? "Convert on Acca Desk" : "Build acca";
    } else if (dest.kind === "bet_builder_desk") {
      label =
        purpose === "convert" ? "Convert on Bet Builder Desk" : "Build bet builder";
    }
    return {
      enabled: true,
      label,
      reason: null,
      destination: dest,
      prefill: only.markPrefill,
    };
  }

  return {
    enabled: true,
    label: fallbackLabel,
    reason: null,
    destination: { kind: "choose", options },
    // First option is enough for orphan quick-log (stake / bookie / offer shared).
    prefill: options[0]!.markPrefill,
  };
}

function buildOptionsForScopes(input: {
  scopes: readonly BetScope[];
  purpose: "qualify" | "convert";
  offer: OfferSummary;
  important: OfferImportantTerms;
  betType: BetMode;
  stake: number;
  bookmaker: string | undefined;
  settings?: TrackBetSettings | null;
}): PlacementOption[] {
  return input.scopes.map((scope) =>
    optionForScope({
      scope,
      purpose: input.purpose,
      offer: input.offer,
      important: input.important,
      betType: input.betType,
      stake: input.stake,
      bookmaker: input.bookmaker,
      settings: input.settings,
    })
  );
}

/** Open the destination from a track / convert action (handles chooser). */
export function resolveTrackBetDestination(
  action: TrackBetAction,
  handlers: {
    openAddBet: (prefill: AddBetPrefill) => void;
    openAccaRun: (prefill: AccaRunPrefill) => void;
    openBetBuilderRun: (prefill: BetBuilderRunPrefill) => void;
    openScopeChooser: (options: PlacementOption[]) => void;
    openDesk?: (href: "/acca" | "/bet-builder" | "/systems") => void;
    beforeOpen?: () => void;
  }
): boolean {
  if (!action.enabled) return false;
  const d = action.destination;
  if (d.kind === "none" || d.kind === "playbook_mark_done") return false;
  handlers.beforeOpen?.();
  if (d.kind === "open_desk") {
    handlers.openDesk?.(d.href);
    return handlers.openDesk != null;
  }
  if (d.kind === "choose") {
    handlers.openScopeChooser(d.options);
    return true;
  }
  if (d.kind === "acca_desk") {
    handlers.openAccaRun(d.prefill);
    return true;
  }
  if (d.kind === "bet_builder_desk") {
    handlers.openBetBuilderRun(d.prefill);
    return true;
  }
  if (d.kind === "add_bet") {
    handlers.openAddBet(d.prefill);
    return true;
  }
  return false;
}

/** Apply a chooser option (same destinations as a concrete track action). */
export function resolvePlacementOption(
  option: PlacementOption,
  handlers: {
    openAddBet: (prefill: AddBetPrefill) => void;
    openAccaRun: (prefill: AccaRunPrefill) => void;
    openBetBuilderRun: (prefill: BetBuilderRunPrefill) => void;
  }
): void {
  const d = option.destination;
  if (d.kind === "acca_desk") {
    handlers.openAccaRun(d.prefill);
    return;
  }
  if (d.kind === "bet_builder_desk") {
    handlers.openBetBuilderRun(d.prefill);
    return;
  }
  if (d.kind === "add_bet") {
    handlers.openAddBet(d.prefill);
  }
}

/** Build place / convert action for the campaign's current pipeline step. */
export function deriveTrackBetAction(
  offer: OfferSummary,
  settings?: TrackBetSettings | null
): TrackBetAction {
  const prefs = settings?.offerBetPrefs ?? {};
  const defaultStake = settings?.defaultBackStake ?? 10;
  const rules = parseOfferRules(offer);
  const action = deriveOfferNextAction(offer);
  const profit = offer.profit;
  const important = readImportantTerms(offer);

  const disabled = (label: string, reason: string): TrackBetAction => ({
    enabled: false,
    label,
    reason,
    destination: { kind: "none" },
    prefill: null,
  });

  if (offer.status === "completed" || offer.status === "expired") {
    return disabled(
      offer.status === "completed" ? "Campaign complete" : "Campaign expired",
      "This campaign is finished."
    );
  }

  if (
    action?.kind === "playbook_deposit" ||
    action?.kind === "playbook_opt_in" ||
    action?.kind === "playbook_clear_wagering"
  ) {
    const step = currentPlaybookStep(playbookFromOffer(offer));
    if (!step) {
      return disabled(action.title, action.detail || action.title);
    }
    const label =
      action.kind === "playbook_deposit"
        ? "Mark deposit done"
        : action.kind === "playbook_opt_in"
          ? "Mark opt-in done"
          : "Mark WR cleared";
    return {
      enabled: true,
      label,
      reason: null,
      destination: { kind: "playbook_mark_done", stepId: step.id },
      prefill: null,
    };
  }

  const desk = offer.deskProgress;
  if (desk) {
    return {
      enabled: true,
      label: desk.needsAction ? desk.actionTitle : `Open ${deskKindLabel(desk.kind)}`,
      reason: null,
      destination: { kind: "open_desk", href: desk.href },
      prefill: null,
    };
  }

  if (action?.kind === "playbook_await_award") {
    const step = currentPlaybookStep(playbookFromOffer(offer));
    if (!step) {
      return disabled(action.title, action.detail || action.title);
    }
    return {
      enabled: true,
      label: "Mark award received",
      reason: null,
      destination: { kind: "playbook_mark_done", stepId: step.id },
      prefill: null,
    };
  }

  // Bookies like Ladbrokes release the free bet on placement while the
  // qualifying leg is still open — only block when the FB isn't awarded yet.
  if (profit.qualifyingOpenCount > 0 && profit.freeBetStage !== "awarded") {
    return disabled(
      ctaLabelForAction(action, "qualifying", false),
      action?.detail ?? "Qualifying bet is still open — settle when the result lands."
    );
  }

  if (profit.freeBetStage === "in_use" || profit.freeBetStage === "awaiting_result") {
    return disabled(
      ctaLabelForAction(action, "free_snr", false),
      action?.detail ?? "Awaiting result on an open bet."
    );
  }

  let betType: BetMode = "qualifying";
  let stakeSource: number | null | undefined = rules?.betStake;
  let label = ctaLabelForAction(action, "qualifying", true);

  if (profit.freeBetStage === "awarded" || action?.kind === "convert_free_bet") {
    betType = "free_snr";
    stakeSource = profit.freeBetAwardAmount ?? rules?.freeBetAmount ?? null;
    label = ctaLabelForAction(action, "free_snr", true);
  } else if (
    action?.kind === "place_qualifying" ||
    action?.kind === "start_planned" ||
    (offer.betCount === 0 && profit.freeBetStage === "none")
  ) {
    betType = isRefundIfOffer(offer) || rules?.refundIf ? "risk_free" : "qualifying";
    label = ctaLabelForAction(action, betType, true);
  } else if (action?.kind === "review_expiry" && offer.betCount === 0) {
    betType = isRefundIfOffer(offer) || rules?.refundIf ? "risk_free" : "qualifying";
    label = ctaLabelForAction(action, betType, true);
  } else {
    return disabled(
      ctaLabelForAction(action, "qualifying", false),
      action?.detail ?? "Nothing to log at this campaign step."
    );
  }

  // Prefer Important min stake when racing rules have no betStake (qualify only).
  if (
    (betType === "qualifying" || betType === "risk_free") &&
    stakeSource == null &&
    important.minStake != null
  ) {
    stakeSource = important.minStake;
  }

  const stake = stakeFromOfferPrefs(prefs, offer.id, stakeSource, defaultStake);
  const bookmaker =
    bookmakerFromOfferPrefs(prefs, offer.id, offer.bookmaker, "") || undefined;

  const purpose = betType === "free_snr" ? "convert" : "qualify";
  const scopes =
    purpose === "convert" ? important.rewardScopes : important.qualifierScopes;

  const options = buildOptionsForScopes({
    scopes,
    purpose,
    offer,
    important,
    betType,
    stake,
    bookmaker,
    settings,
  });

  return finalizeFromOptions(options, label, purpose);
}

/**
 * Convert path for an Accounts free-bet lot linked to an offer (via award bet).
 * Uses rewardScopes; falls back to Add bet when unlinked or not Acca-entitled.
 */
export function deriveFreeBetLotConvertAction(
  lot: { remaining: number; accountName: string },
  offer: OfferSummary | null | undefined,
  settings?: TrackBetSettings | null
): TrackBetAction {
  const addBetPrefill: AddBetPrefill = {
    offerId: offer?.id,
    betType: "free_snr",
    bookmaker: lot.accountName,
    backStake: lot.remaining,
    labelSuggestion: `Convert FB · ${lot.accountName}`,
  };

  if (!offer) {
    return {
      enabled: true,
      label: "Convert free bet",
      reason: null,
      destination: { kind: "add_bet", prefill: addBetPrefill, scopeHint: "single" },
      prefill: addBetPrefill,
    };
  }

  const important = readImportantTerms(offer);
  const bookmaker =
    bookmakerFromOfferPrefs(
      settings?.offerBetPrefs ?? {},
      offer.id,
      offer.bookmaker,
      lot.accountName
    ) || lot.accountName;

  const options = buildOptionsForScopes({
    scopes: important.rewardScopes,
    purpose: "convert",
    offer,
    important,
    betType: "free_snr",
    stake: lot.remaining,
    bookmaker,
    settings,
  }).map((opt) => {
    const scopedLabel =
      opt.markPrefill.rewardEventLabel?.trim() ||
      important.rewardEventLabel?.trim();
    const convertLabel = scopedLabel
      ? (opt.markPrefill.labelSuggestion ?? `Convert FB · ${scopedLabel}`)
      : `Convert FB · ${lot.accountName}`;
    const lotPrefill = {
      ...opt.markPrefill,
      bookmaker: lot.accountName,
      backStake: lot.remaining,
      labelSuggestion: convertLabel,
    };
    if (opt.destination.kind === "add_bet") {
      return {
        ...opt,
        markPrefill: lotPrefill,
        destination: {
          ...opt.destination,
          prefill: lotPrefill,
        },
      } satisfies PlacementOption;
    }
    if (opt.destination.kind === "bet_builder_desk") {
      return {
        ...opt,
        markPrefill: lotPrefill,
        destination: {
          ...opt.destination,
          prefill: {
            ...opt.destination.prefill,
            bookmaker: lot.accountName,
            stake: lot.remaining,
            label: convertLabel,
          },
        },
      } satisfies PlacementOption;
    }
    if (opt.destination.kind === "acca_desk") {
      return {
        ...opt,
        markPrefill: lotPrefill,
        destination: {
          ...opt.destination,
          prefill: {
            ...opt.destination.prefill,
            bookmaker: lot.accountName,
            stake: lot.remaining,
            label: convertLabel,
          },
        },
      } satisfies PlacementOption;
    }
    return { ...opt, markPrefill: lotPrefill };
  });

  return finalizeFromOptions(options, "Convert free bet", "convert");
}

/** Display helper for tests / UI. */
export function placementOptionLabel(scope: BetScope): string {
  return betScopeLabel(scope);
}
