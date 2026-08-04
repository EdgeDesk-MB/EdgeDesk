import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, bets, offers, type OfferRow } from "@/lib/db";
import { syncOfferStatuses } from "./offers";
import { localYmd } from "@/lib/offers/offer-recurrence-shared";

function insertOffer(
  over: Partial<Pick<OfferRow, "status" | "startsOn" | "expiresAt">> = {}
): OfferRow {
  return db
    .insert(offers)
    .values({
      title: "Bet £50 get £20 free bet",
      bookmaker: "Betfair Sportsbook",
      expectedProfit: 13.5,
      status: over.status ?? "planned",
      startsOn: over.startsOn ?? null,
      expiresAt: over.expiresAt ?? null,
      createdAt: Date.now(),
    })
    .returning()
    .get();
}

beforeEach(() => {
  db.delete(bets).run();
  db.delete(offers).run();
});

describe("syncOfferStatuses - startsOn scheduling", () => {
  it("activates a planned offer once its startsOn date has arrived", () => {
    const todayKey = localYmd(new Date());
    const offer = insertOffer({ status: "planned", startsOn: todayKey });

    syncOfferStatuses();

    const updated = db.select().from(offers).where(eq(offers.id, offer.id)).get();
    expect(updated?.status).toBe("active");
  });

  it("leaves a planned offer alone until its startsOn date arrives", () => {
    const future = localYmd(new Date(Date.now() + 30 * 86_400_000));
    const offer = insertOffer({ status: "planned", startsOn: future });

    syncOfferStatuses();

    const updated = db.select().from(offers).where(eq(offers.id, offer.id)).get();
    expect(updated?.status).toBe("planned");
  });

  it("doesn't touch planned offers with no startsOn (existing manual-review behaviour)", () => {
    const offer = insertOffer({ status: "planned", startsOn: null });

    syncOfferStatuses();

    const updated = db.select().from(offers).where(eq(offers.id, offer.id)).get();
    expect(updated?.status).toBe("planned");
  });
});
