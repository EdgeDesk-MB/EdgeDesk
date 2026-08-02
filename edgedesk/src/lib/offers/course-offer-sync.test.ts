import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, offers, bets } from "@/lib/db";
import { ensureCourseOfferSiblings } from "./course-offer-sync";
import { spawnCourseOfferSiblingsIfNeeded, syncOfferStatuses } from "@/lib/services/offers";

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
      rules: null,
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

describe("ensureCourseOfferSiblings", () => {
  it("spawns a fresh course sibling when a course-scoped offer has been used", () => {
    const usedId = insertOffer({ scopeRaceId: null });
    linkBet(usedId);

    ensureCourseOfferSiblings(
      db.select().from(offers).all(),
      db.select({ offerId: bets.offerId }).from(bets).all()
    );

    const rows = db.select().from(offers).all();
    expect(rows).toHaveLength(2);
    const fresh = rows.find((o) => o.id !== usedId);
    expect(fresh?.scopeRaceId).toBeNull();
    expect(fresh?.status).toBe("active");
    expect(fresh?.scopeCourse).toBe("Goodwood");
  });

  it("does not spawn when a fresh course sibling already exists", () => {
    const usedId = insertOffer({ scopeRaceId: null, createdAt: 1 });
    linkBet(usedId);
    insertOffer({ scopeRaceId: null, createdAt: 2 });

    ensureCourseOfferSiblings(
      db.select().from(offers).all(),
      db.select({ offerId: bets.offerId }).from(bets).all()
    );

    expect(db.select().from(offers).all()).toHaveLength(2);
  });

  it("does not treat a race-scoped offer as a reason to spawn a course sibling", () => {
    // Deleting the auto-spawned course card used to come back on the next
    // /api/state sync because the race-scoped bet counted as "group all used".
    const raceScopedId = insertOffer({ scopeRaceId: "rac_32293062958" });
    linkBet(raceScopedId);

    ensureCourseOfferSiblings(
      db.select().from(offers).all(),
      db.select({ offerId: bets.offerId }).from(bets).all()
    );

    expect(db.select().from(offers).all()).toHaveLength(1);
    expect(db.select().from(offers).where(eq(offers.id, raceScopedId)).get()).toBeDefined();
  });

  it("still spawns from a used course card even if a race-scoped sibling also exists", () => {
    const courseUsed = insertOffer({ scopeRaceId: null, createdAt: 1 });
    linkBet(courseUsed);
    const raceScoped = insertOffer({ scopeRaceId: "rac_99", createdAt: 2 });
    linkBet(raceScoped);

    ensureCourseOfferSiblings(
      db.select().from(offers).all(),
      db.select({ offerId: bets.offerId }).from(bets).all()
    );

    const rows = db.select().from(offers).all();
    expect(rows).toHaveLength(3);
    expect(rows.some((o) => o.scopeRaceId == null && (o.id !== courseUsed))).toBe(true);
  });

  it("does not respawn a deleted fresh sibling on status sync", () => {
    // Ladbrokes Galway-style: used card + auto fresh. Deleting the fresh one
    // used to come back on the next /api/state syncOfferStatuses pass.
    const usedId = insertOffer({
      bookmaker: "Ladbrokes",
      title: "Bet £5 get £5 free bet",
      scopeCourse: "Galway",
      eventDate: "2026-08-02",
      createdAt: 1,
    });
    linkBet(usedId);
    spawnCourseOfferSiblingsIfNeeded();

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
});
