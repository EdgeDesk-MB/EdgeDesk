import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, offers, bets } from "@/lib/db";
import {
  SAME_DAY_TWIN_SOURCE,
  ensureSameDayOfferSiblings,
  isAutoSpawnedSameDayTwin,
  isSameDayMultiRaceOffer,
  reconcileSameDayOfferSiblings,
  retireUnusedSameDayOfferSiblings,
  sameDayTwinParentId,
} from "./course-offer-sync";
import {
  spawnCourseOfferSiblingsIfNeeded,
  spawnSameDayOfferSiblingsIfNeeded,
  syncOfferStatuses,
} from "@/lib/services/offers";

beforeEach(() => {
  db.delete(bets).run();
  db.delete(offers).run();
});

function insertOffer(partial: {
  title?: string;
  status?: "planned" | "active" | "completed" | "expired";
  scopeCourse?: string | null;
  scopeRaceId?: string | null;
  eventDate?: string | null;
  bookmaker?: string | null;
  createdAt?: number;
  rules?: string | null;
  seriesId?: number | null;
  source?: string | null;
}): number {
  const row = db
    .insert(offers)
    .values({
      bookmaker: partial.bookmaker ?? "Tote",
      title: partial.title ?? "Bet £10 get £10 free bet (2nd & 3rd)",
      description: null,
      expectedProfit: 7.2,
      status: partial.status ?? "active",
      sport: "horse_racing",
      offerType: "bet_get_free_place",
      scopeCourse: partial.scopeCourse ?? "Goodwood",
      eventDate: partial.eventDate ?? "2026-08-01",
      scopeRaceId: partial.scopeRaceId ?? null,
      scopeRaceLabel: partial.scopeRaceId ? "1:50 · Test" : null,
      rules: partial.rules !== undefined ? partial.rules : placeRules,
      seriesId: partial.seriesId ?? null,
      source: partial.source ?? null,
      expiresAt: null,
      createdAt: partial.createdAt ?? Date.now(),
    })
    .returning({ id: offers.id })
    .get();
  return row.id;
}

function linkBet(offerId: number): void {
  db.insert(bets)
    .values({
      bookmaker: "Tote",
      label: "Test",
      betType: "qualifying",
      backStake: 10,
      backOdds: 5,
      layStake: 8,
      layOdds: 5.2,
      commission: 0.02,
      status: "open",
      offerId,
      createdAt: Date.now(),
    })
    .run();
}

const placeRules = JSON.stringify({
  type: "bet_get_free_place",
  minRunners: 8,
  regions: ["GB", "IRE"],
  qualifyingPlaces: [2, 3],
  betStake: 10,
  freeBetAmount: 10,
});

const repeatRules = JSON.stringify({
  type: "bet_get_free_place",
  minRunners: 8,
  regions: ["GB", "IRE"],
  qualifyingPlaces: [2, 3],
  betStake: 10,
  freeBetAmount: 10,
  repeatSameDay: true,
});

const regionalRules = JSON.stringify({
  type: "bet_get_free_place",
  minRunners: 6,
  regions: ["GB", "IRE"],
  qualifyingPlaces: [2],
  betStake: 10,
  freeBetAmount: 10,
  winnerMustBeSpFavourite: true,
});

const unconditionalRules = JSON.stringify({
  type: "bet_get_free_place",
  minRunners: 8,
  regions: ["GB", "IRE"],
  qualifyingPlaces: [],
  betStake: 10,
  freeBetAmount: 10,
});

describe("same-day twin source", () => {
  it("treats parent-tagged and legacy twin sources as auto-spawned", () => {
    expect(isAutoSpawnedSameDayTwin({ source: SAME_DAY_TWIN_SOURCE })).toBe(true);
    expect(isAutoSpawnedSameDayTwin({ source: `${SAME_DAY_TWIN_SOURCE}:12` })).toBe(true);
    expect(isAutoSpawnedSameDayTwin({ source: null })).toBe(false);
    expect(isAutoSpawnedSameDayTwin({ source: "email" })).toBe(false);
    expect(sameDayTwinParentId({ source: `${SAME_DAY_TWIN_SOURCE}:12` })).toBe(12);
    expect(sameDayTwinParentId({ source: SAME_DAY_TWIN_SOURCE })).toBeNull();
  });
});

describe("isSameDayMultiRaceOffer", () => {
  it("accepts regional UK & Ireland place-refund day offers", () => {
    const id = insertOffer({
      scopeCourse: "uk_ire",
      scopeRaceId: null,
      rules: regionalRules,
    });
    const row = db.select().from(offers).where(eq(offers.id, id)).get()!;
    expect(isSameDayMultiRaceOffer(row)).toBe(true);
  });

  it("rejects race-scoped offers", () => {
    const id = insertOffer({ scopeRaceId: "rac_1", rules: placeRules });
    const row = db.select().from(offers).where(eq(offers.id, id)).get()!;
    expect(isSameDayMultiRaceOffer(row)).toBe(false);
  });

  it("rejects straight bet&get / multiples with no result trigger", () => {
    const id = insertOffer({
      scopeCourse: "uk_ire",
      rules: unconditionalRules,
      title: "Bet £10 get £10 free bet",
    });
    const row = db.select().from(offers).where(eq(offers.id, id)).get()!;
    expect(isSameDayMultiRaceOffer(row)).toBe(false);
  });
});

describe("ensureSameDayOfferSiblings", () => {
  it("does not spawn for one-shot place-refund after the first bet", () => {
    const usedId = insertOffer({ scopeRaceId: null, rules: placeRules });
    linkBet(usedId);

    ensureSameDayOfferSiblings(
      db.select().from(offers).all(),
      db.select({ offerId: bets.offerId }).from(bets).all()
    );

    expect(db.select().from(offers).all()).toHaveLength(1);
  });

  it("spawns a twin when repeatSameDay is set on a course offer", () => {
    const usedId = insertOffer({ scopeRaceId: null, rules: repeatRules });
    linkBet(usedId);

    ensureSameDayOfferSiblings(
      db.select().from(offers).all(),
      db.select({ offerId: bets.offerId }).from(bets).all()
    );

    const rows = db.select().from(offers).all();
    expect(rows).toHaveLength(2);
    const fresh = rows.find((o) => o.id !== usedId);
    expect(fresh?.status).toBe("active");
    expect(fresh?.scopeCourse).toBe("Goodwood");
    expect(fresh?.source).toBe(`${SAME_DAY_TWIN_SOURCE}:${usedId}`);
    expect(JSON.parse(fresh!.rules!).repeatSameDay).toBe(true);
  });

  it("spawns a twin for UK & Ireland when repeatSameDay is set", () => {
    const usedId = insertOffer({
      bookmaker: "QuinnBet",
      title: "Bet £10 get £10 free bet (2nd to SP favourite)",
      scopeCourse: "uk_ire",
      eventDate: "2026-08-07",
      rules: JSON.stringify({
        ...JSON.parse(regionalRules),
        repeatSameDay: true,
      }),
    });
    linkBet(usedId);

    ensureSameDayOfferSiblings(
      db.select().from(offers).all(),
      db.select({ offerId: bets.offerId }).from(bets).all()
    );

    expect(db.select().from(offers).all()).toHaveLength(2);
  });

  it("does not spawn for an unconditional multiples-style offer", () => {
    const usedId = insertOffer({
      scopeCourse: "uk_ire",
      rules: unconditionalRules,
      title: "Bet £10 get £10 free bet",
    });
    linkBet(usedId);

    ensureSameDayOfferSiblings(
      db.select().from(offers).all(),
      db.select({ offerId: bets.offerId }).from(bets).all()
    );

    expect(db.select().from(offers).all()).toHaveLength(1);
  });

  it("does not treat a race-scoped offer as a reason to spawn a sibling", () => {
    const raceScopedId = insertOffer({
      scopeRaceId: "rac_32293062958",
      rules: repeatRules,
    });
    linkBet(raceScopedId);

    ensureSameDayOfferSiblings(
      db.select().from(offers).all(),
      db.select({ offerId: bets.offerId }).from(bets).all()
    );

    expect(db.select().from(offers).all()).toHaveLength(1);
  });

  it("does not respawn a deleted fresh sibling on status sync", () => {
    const usedId = insertOffer({
      bookmaker: "Ladbrokes",
      title: "Bet £5 get £5 free bet",
      scopeCourse: "Galway",
      eventDate: "2026-08-02",
      rules: repeatRules,
      createdAt: 1,
    });
    linkBet(usedId);
    spawnSameDayOfferSiblingsIfNeeded();

    const fresh = db
      .select()
      .from(offers)
      .all()
      .find((o) => o.id !== usedId);
    expect(fresh).toBeDefined();
    db.delete(offers).where(eq(offers.id, fresh!.id)).run();

    syncOfferStatuses();

    const after = db.select().from(offers).all();
    expect(after).toHaveLength(1);
    expect(after[0]?.id).toBe(usedId);
  });

  it("keeps the deprecated spawnCourseOfferSiblingsIfNeeded alias working for multi-use", () => {
    const usedId = insertOffer({
      scopeCourse: "uk_ire",
      rules: JSON.stringify({ ...JSON.parse(regionalRules), repeatSameDay: true }),
    });
    linkBet(usedId);
    spawnCourseOfferSiblingsIfNeeded();
    expect(db.select().from(offers).all()).toHaveLength(2);
  });

  it("does not spawn a same-day twin for a recurring series instance", () => {
    const usedId = insertOffer({
      bookmaker: "Betfair Sportsbook",
      title: "Bet £20 get £20 free bet (2nd, 3rd, 4th)",
      scopeCourse: "uk_ire",
      eventDate: "2026-08-10",
      rules: JSON.stringify({ ...JSON.parse(regionalRules), repeatSameDay: true }),
      seriesId: 2,
    });
    linkBet(usedId);

    ensureSameDayOfferSiblings(
      db.select().from(offers).all(),
      db.select({ offerId: bets.offerId }).from(bets).all()
    );

    expect(db.select().from(offers).all()).toHaveLength(1);
  });

  it("does not treat a second user-created same-spec offer as the first campaign's twin", () => {
    const usedId = insertOffer({
      bookmaker: "Paddy Power",
      title: "Bet £10 get £10 free bet (2nd–4th)",
      scopeCourse: "uk_ire",
      eventDate: "2026-08-15",
      rules: repeatRules,
      createdAt: 1,
    });
    linkBet(usedId);
    const added = insertOffer({
      bookmaker: "Paddy Power",
      title: "Bet £10 get £10 free bet (2nd–4th)",
      scopeCourse: "uk_ire",
      eventDate: "2026-08-15",
      rules: repeatRules,
      createdAt: 2,
    });

    ensureSameDayOfferSiblings(
      db.select().from(offers).all(),
      db.select({ offerId: bets.offerId }).from(bets).all()
    );

    const rows = db.select().from(offers).all();
    expect(rows).toHaveLength(3);
    expect(db.select().from(offers).where(eq(offers.id, added)).get()?.status).toBe(
      "active"
    );
    const twin = rows.find((o) => o.id !== usedId && o.id !== added);
    expect(twin?.source).toBe(`${SAME_DAY_TWIN_SOURCE}:${usedId}`);
    expect(twin?.status).toBe("active");
  });
});

describe("retireUnusedSameDayOfferSiblings", () => {
  it("completes unused twins when a recurring series day is marked complete", () => {
    const usedId = insertOffer({
      scopeCourse: "uk_ire",
      rules: regionalRules,
      seriesId: 2,
      createdAt: 1,
    });
    linkBet(usedId);
    const freshId = insertOffer({
      scopeCourse: "uk_ire",
      rules: regionalRules,
      seriesId: null,
      source: `${SAME_DAY_TWIN_SOURCE}:${usedId}`,
      createdAt: 2,
    });

    db.update(offers)
      .set({ status: "completed", completedAt: Date.now() })
      .where(eq(offers.id, usedId))
      .run();

    retireUnusedSameDayOfferSiblings(usedId);

    expect(db.select().from(offers).where(eq(offers.id, freshId)).get()?.status).toBe(
      "completed"
    );
  });

  it("leaves a multi-use fresh twin active when the used campaign is completed", () => {
    const usedId = insertOffer({
      scopeCourse: "uk_ire",
      rules: repeatRules,
      createdAt: 1,
    });
    linkBet(usedId);
    const freshId = insertOffer({
      scopeCourse: "uk_ire",
      rules: repeatRules,
      createdAt: 2,
    });

    db.update(offers)
      .set({ status: "completed", completedAt: Date.now() })
      .where(eq(offers.id, usedId))
      .run();

    retireUnusedSameDayOfferSiblings(usedId);

    expect(db.select().from(offers).where(eq(offers.id, freshId)).get()?.status).toBe(
      "active"
    );
  });

  it("completes a one-shot orphan twin when the used campaign is marked complete", () => {
    const usedId = insertOffer({
      scopeCourse: "uk_ire",
      rules: placeRules,
      createdAt: 1,
    });
    linkBet(usedId);
    const freshId = insertOffer({
      scopeCourse: "uk_ire",
      rules: placeRules,
      source: `${SAME_DAY_TWIN_SOURCE}:${usedId}`,
      createdAt: 2,
    });

    db.update(offers)
      .set({ status: "completed", completedAt: Date.now() })
      .where(eq(offers.id, usedId))
      .run();

    retireUnusedSameDayOfferSiblings(usedId);

    expect(db.select().from(offers).where(eq(offers.id, freshId)).get()?.status).toBe(
      "completed"
    );
  });

  it("leaves a user-created unused sibling when the used campaign is marked complete", () => {
    const usedId = insertOffer({
      scopeCourse: "uk_ire",
      rules: placeRules,
      createdAt: 1,
    });
    linkBet(usedId);
    const addedId = insertOffer({
      scopeCourse: "uk_ire",
      rules: placeRules,
      createdAt: 2,
    });

    db.update(offers)
      .set({ status: "completed", completedAt: Date.now() })
      .where(eq(offers.id, usedId))
      .run();

    retireUnusedSameDayOfferSiblings(usedId);

    expect(db.select().from(offers).where(eq(offers.id, addedId)).get()?.status).toBe(
      "active"
    );
  });
});

describe("reconcileSameDayOfferSiblings", () => {
  it("retires an orphan unused twin once the series day already has a linked bet", () => {
    const seriesDay = insertOffer({
      bookmaker: "Betfair Sportsbook",
      title: "Bet £20 get £20 free bet (2nd, 3rd, 4th)",
      scopeCourse: "uk_ire",
      eventDate: "2026-08-10",
      rules: regionalRules,
      seriesId: 2,
      createdAt: 1,
    });
    linkBet(seriesDay);
    const orphan = insertOffer({
      bookmaker: "Betfair Sportsbook",
      title: "Bet £20 get £20 free bet (2nd, 3rd, 4th)",
      scopeCourse: "uk_ire",
      eventDate: "2026-08-10",
      rules: regionalRules,
      seriesId: null,
      source: `${SAME_DAY_TWIN_SOURCE}:${seriesDay}`,
      createdAt: 2,
    });

    reconcileSameDayOfferSiblings();

    expect(db.select().from(offers).where(eq(offers.id, orphan)).get()?.status).toBe(
      "completed"
    );
    expect(db.select().from(offers).where(eq(offers.id, seriesDay)).get()?.status).toBe(
      "active"
    );
  });

  it("retires a one-shot orphan twin after the first linked bet", () => {
    const usedId = insertOffer({
      bookmaker: "Paddy Power",
      title: "Bet £10 get £10 free bet (2nd & 3rd)",
      scopeCourse: "uk_ire",
      eventDate: "2026-08-11",
      rules: placeRules,
      createdAt: 1,
    });
    linkBet(usedId);
    const orphan = insertOffer({
      bookmaker: "Paddy Power",
      title: "Bet £10 get £10 free bet (2nd & 3rd)",
      scopeCourse: "uk_ire",
      eventDate: "2026-08-11",
      rules: placeRules,
      source: `${SAME_DAY_TWIN_SOURCE}:${usedId}`,
      createdAt: 2,
    });

    reconcileSameDayOfferSiblings();

    expect(db.select().from(offers).where(eq(offers.id, orphan)).get()?.status).toBe(
      "completed"
    );
  });

  it("does not retire a user-created unused sibling after the first linked bet", () => {
    const usedId = insertOffer({
      bookmaker: "Paddy Power",
      title: "Bet £10 get £10 free bet (2nd–4th)",
      scopeCourse: "uk_ire",
      eventDate: "2026-08-15",
      rules: placeRules,
      createdAt: 1,
    });
    linkBet(usedId);
    const added = insertOffer({
      bookmaker: "Paddy Power",
      title: "Bet £10 get £10 free bet (2nd–4th)",
      scopeCourse: "uk_ire",
      eventDate: "2026-08-15",
      rules: placeRules,
      createdAt: 2,
    });

    reconcileSameDayOfferSiblings();

    expect(db.select().from(offers).where(eq(offers.id, added)).get()?.status).toBe(
      "active"
    );
    expect(db.select().from(offers).where(eq(offers.id, usedId)).get()?.status).toBe(
      "active"
    );
  });

  it("leaves a multi-use fresh twin when repeatSameDay is set", () => {
    const usedId = insertOffer({
      bookmaker: "Paddy Power",
      title: "Bet £10 get £10 free bet (2nd & 3rd)",
      scopeCourse: "uk_ire",
      eventDate: "2026-08-11",
      rules: repeatRules,
      createdAt: 1,
    });
    linkBet(usedId);
    const fresh = insertOffer({
      bookmaker: "Paddy Power",
      title: "Bet £10 get £10 free bet (2nd & 3rd)",
      scopeCourse: "uk_ire",
      eventDate: "2026-08-11",
      rules: repeatRules,
      createdAt: 2,
    });

    reconcileSameDayOfferSiblings();

    expect(db.select().from(offers).where(eq(offers.id, fresh)).get()?.status).toBe(
      "active"
    );
  });

  it("keeps a second user-created same-spec offer independent through status sync", () => {
    const first = insertOffer({
      bookmaker: "Paddy Power",
      title: "Bet £10 get £10 free bet (2nd–4th)",
      scopeCourse: "uk_ire",
      eventDate: "2026-08-15",
      rules: placeRules,
      createdAt: 1,
    });
    linkBet(first);
    const second = insertOffer({
      bookmaker: "Paddy Power",
      title: "Bet £10 get £10 free bet (2nd–4th)",
      scopeCourse: "uk_ire",
      eventDate: "2026-08-15",
      rules: placeRules,
      createdAt: 2,
    });

    syncOfferStatuses();

    expect(db.select().from(offers).where(eq(offers.id, first)).get()?.status).toBe(
      "active"
    );
    expect(db.select().from(offers).where(eq(offers.id, second)).get()?.status).toBe(
      "active"
    );
    expect(db.select().from(offers).all()).toHaveLength(2);
  });
});
