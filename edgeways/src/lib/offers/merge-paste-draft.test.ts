import { describe, expect, it } from "vitest";
import {
  draftToOfferFormPatch,
  markCasinoFieldUser,
  markOfferFieldUser,
  mergeCasinoPasteDraft,
  mergeOfferPasteDraft,
  trimImportantNotesForForm,
  type OfferPasteFormSlice,
  type OfferPasteProvenance,
} from "@/lib/offers/merge-paste-draft";
import { parseOfferFromText } from "@/lib/offers/parse-offer-text";
import type { ParsedCasinoOfferDraft } from "@/lib/offers/parse-casino-offer-text";

function emptySlice(): OfferPasteFormSlice {
  return {
    category: "general",
    title: "",
    bookmaker: "",
    expected: "",
    expiresAtMs: null,
    startsOn: "",
    minOdds: "",
    minStake: "",
    maxStake: "",
    importantNotes: "",
    promoCode: "",
    minDeposit: "",
    depositRequired: false,
    rewardEventLabel: "",
    rewardEventDate: "",
    winningsWageringX: "",
    maxConversion: "",
    paymentExclusions: [],
    qualifierScopes: ["single"],
    rewardScopes: ["single"],
    minSelections: "",
    rewardMinSelections: "",
    betStake: "50",
    freeBetAmount: "50",
    minRunners: "8",
    qualifyingPlaces: [],
    winnerMustBeSpFavourite: false,
    minFavouriteSpOdds: "",
    resultConditional: false,
    repeatSameDay: false,
    scopeMode: "uk_ire",
    scopeCourse: "",
    preferredOffTime: null,
    scopeRegions: ["GB", "IRE"],
    eventDate: "",
  };
}

describe("trimImportantNotesForForm", () => {
  it("drops contacts-list boilerplate and caps how-to-match steps", () => {
    const notes = [
      "ProgressPlay network · Before you close this mail add our email",
      "SNR free bet · Promo code UEFA",
      "",
      "How to match:",
      "1. Deposit £30+",
      "2. Place qualifying",
      "3. Await award",
      "4. Convert free bet",
      "5. Clear wagering",
      "6. Extra step that should be cut",
    ].join("\n");
    const trimmed = trimImportantNotesForForm(notes);
    expect(trimmed).toMatch(/SNR/);
    expect(trimmed).not.toMatch(/add our email/i);
    expect(trimmed).toMatch(/How to match:/);
    expect(trimmed).not.toMatch(/Extra step/);
  });
});

describe("mergeOfferPasteDraft", () => {
  it("fills empty fields from Dynobet paste", () => {
    const draft = parseOfferFromText(
      `DYNOBET
UEFA SUPER CUP BET & GET
Deposit £30 with code UEFA
Place qualifying bets worth £20
Receive a £10 Free Bet for PSG vs Aston Villa
Min odds 1.5. Valid until 12 August, 2026 at 23:59 GMT.`,
      new Date("2026-08-10T12:00:00")
    );
    const { form, provenance } = mergeOfferPasteDraft(emptySlice(), draft, {});
    expect(form.bookmaker).toBe("Dynobet");
    expect(form.promoCode).toBe("UEFA");
    expect(form.minDeposit).toBe("30");
    expect(form.minStake).toBe("20");
    expect(form.title).toMatch(/£10/);
    expect(provenance.title).toBe("paste");
    expect(provenance.promoCode).toBe("paste");
  });

  it("does not mark default Single scopes as from paste", () => {
    const draft = parseOfferFromText(
      `Dynobet Get a £10 Free Bet. Promo code UEFA. Min deposit £30. Place bets worth £20.`,
      new Date("2026-08-10T12:00:00")
    );
    const { provenance } = mergeOfferPasteDraft(emptySlice(), draft, {});
    expect(provenance.qualifierScopes).not.toBe("paste");
    expect(provenance.rewardScopes).not.toBe("paste");
    expect(provenance.minOdds === "paste" || provenance.minStake === "paste").toBe(true);
  });

  it("never overwrites user-edited fields on second paste", () => {
    const draft1 = parseOfferFromText(
      `Dynobet Bet £20 get £10 free bet. Promo code UEFA. Min deposit £30.`,
      new Date("2026-08-10T12:00:00")
    );
    const first = mergeOfferPasteDraft(emptySlice(), draft1, {});
    const afterUser: OfferPasteProvenance = markOfferFieldUser(first.provenance, "title");
    const withUserTitle = { ...first.form, title: "My custom title" };
    const draft2 = parseOfferFromText(
      `Dynobet Get a £10 Free Bet. Promo code UEFA. Min deposit £40. The bonus win must be wagered 1 time. Max conversion £200.`,
      new Date("2026-08-10T12:00:00")
    );
    const second = mergeOfferPasteDraft(withUserTitle, draft2, afterUser);
    expect(second.form.title).toBe("My custom title");
    expect(second.provenance.title).toBe("user");
    // Untouched paste fields may refresh
    expect(second.form.minDeposit).toBe("40");
    expect(second.form.maxConversion).toBe("200");
    expect(Number(second.form.winningsWageringX)).toBe(1);
  });

  it("draftToOfferFormPatch trims important notes", () => {
    const draft = parseOfferFromText(
      `Important: Before you close this mail and start playing, please add our email address info@news.progressplay.com to your contacts list.
Dynobet Get a £10 Free Bet. Deposit £30 code UEFA. Place bets worth £20.`,
      new Date("2026-08-10T12:00:00")
    );
    const patch = draftToOfferFormPatch(draft, false);
    expect(patch.importantNotes ?? "").not.toMatch(/contacts list/i);
  });
});

describe("mergeCasinoPasteDraft", () => {
  it("fills casino and title, locks user title on re-paste", () => {
    const draft: ParsedCasinoOfferDraft = {
      casino: "Sky Vegas",
      title: "£20 bonus",
      qualifyStake: 10,
      bonusAmount: 20,
      wageringMultiplier: 35,
      rtp: 0.965,
      contributionPct: 1,
      spins: null,
      spinValue: null,
      chipCount: null,
      chipValue: null,
      cashbackPct: null,
      likelyComponentType: "bonus",
      confidence: "high",
      notes: [],
      sourceText: "test",
    };
    const first = mergeCasinoPasteDraft(
      { casino: "", title: "", draft: null },
      draft,
      {}
    );
    expect(first.form.casino).toBe("Sky Vegas");
    expect(first.form.title).toBe("£20 bonus");
    const userProv = markCasinoFieldUser(first.provenance, "title");
    const second = mergeCasinoPasteDraft(
      { casino: first.form.casino, title: "Edited title", draft: first.form.draft },
      { ...draft, title: "Other title", casino: "Bet365" },
      userProv
    );
    expect(second.form.title).toBe("Edited title");
    expect(second.form.casino).toBe("Bet365");
  });
});
