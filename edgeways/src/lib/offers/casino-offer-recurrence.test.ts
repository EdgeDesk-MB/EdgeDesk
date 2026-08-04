import { describe, expect, it, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  casinoOfferComponents,
  casinoOfferSeries,
  casinoOfferSeriesComponents,
  casinoOffers,
} from "@/lib/db";
import { deriveComponentEv } from "@/lib/calc/casino-reward-ev";
import { sumCampaignEv } from "@/lib/calc/casino-reward-ev";
import {
  createCasinoOfferSeriesWithInstance,
  deleteCasinoOfferWithScope,
  maybeSealCasinoSeriesTemplate,
  stopCasinoOfferRecurrence,
  syncCasinoOfferSeriesInstances,
  syncCasinoSeriesTemplateFromOffer,
  type CasinoInstanceTemplate,
} from "./casino-offer-recurrence";
import { parseSkippedDates } from "./offer-recurrence-shared";

const baseTemplate: CasinoInstanceTemplate = {
  casino: "LeoVegas",
  title: "Daily £10 reload",
  notes: null,
  expiresAt: null,
};

beforeEach(() => {
  db.delete(casinoOfferComponents).run();
  db.delete(casinoOffers).run();
  db.delete(casinoOfferSeriesComponents).run();
  db.delete(casinoOfferSeries).run();
});

function addBonusComponent(offerId: number, amount = 10, now = Date.now()) {
  const expectedEv = deriveComponentEv({
    componentType: "bonus",
    amount,
    wageringMultiplier: 30,
    rtp: 0.96,
  });
  return db
    .insert(casinoOfferComponents)
    .values({
      casinoOfferId: offerId,
      componentType: "bonus",
      amount,
      wageringMultiplier: 30,
      rtp: 0.96,
      contributionPct: null,
      spins: null,
      spinValue: null,
      chipCount: null,
      chipValue: null,
      houseEdgePreset: null,
      cashbackPct: null,
      cashbackCap: null,
      game: null,
      expectedEv,
      sortOrder: 0,
      createdAt: now,
    })
    .returning()
    .get();
}

describe("createCasinoOfferSeriesWithInstance - first occurrence anchoring", () => {
  it("snaps the first occurrence to the next matching weekday instead of creation day", () => {
    // 2026-07-09 is a Thursday.
    const now = new Date(2026, 6, 9, 10, 0, 0).getTime();
    const { offerId } = createCasinoOfferSeriesWithInstance(
      baseTemplate,
      { freq: "weekly", interval: 1, byWeekday: [3] },
      { now }
    );
    const offer = db.select().from(casinoOffers).where(eq(casinoOffers.id, offerId)).get();
    expect(offer?.instanceDate).toBe("2026-07-15");
    expect(offer?.status).toBe("planned");
    expect(offer?.seriesId).toBeTruthy();
  });

  it("fires immediately when the rule already matches the creation day", () => {
    const now = new Date(2026, 6, 9, 10, 0, 0).getTime();
    const { offerId } = createCasinoOfferSeriesWithInstance(
      baseTemplate,
      { freq: "daily", interval: 1 },
      { now }
    );
    const offer = db.select().from(casinoOffers).where(eq(casinoOffers.id, offerId)).get();
    expect(offer?.instanceDate).toBe("2026-07-09");
    expect(offer?.status).toBe("active");
  });

  it("does not materialise the horizon until the component template is sealed", () => {
    const now = new Date(2026, 6, 9, 10, 0, 0).getTime();
    createCasinoOfferSeriesWithInstance(baseTemplate, { freq: "daily", interval: 1 }, { now });
    syncCasinoOfferSeriesInstances(now);
    expect(db.select().from(casinoOffers).all()).toHaveLength(1);
  });
});

describe("maybeSealCasinoSeriesTemplate + sync", () => {
  it("seals the template, materialises the horizon, and derives fresh EVs per instance", () => {
    const now = new Date(2026, 6, 9, 10, 0, 0).getTime();
    const { seriesId, offerId } = createCasinoOfferSeriesWithInstance(
      baseTemplate,
      { freq: "daily", interval: 1 },
      { now }
    );
    const seedComponent = addBonusComponent(offerId, 10, now);
    expect(maybeSealCasinoSeriesTemplate(offerId, now)).toBe(true);

    const template = db
      .select()
      .from(casinoOfferSeriesComponents)
      .where(eq(casinoOfferSeriesComponents.seriesId, seriesId))
      .all();
    expect(template).toHaveLength(1);
    expect(template[0]?.amount).toBe(10);
    // Template has no expectedEv column - instance EVs are derived fresh.
    expect("expectedEv" in template[0]!).toBe(false);

    const instances = db
      .select()
      .from(casinoOffers)
      .where(eq(casinoOffers.seriesId, seriesId))
      .all()
      .sort((a, b) => (a.instanceDate ?? "").localeCompare(b.instanceDate ?? ""));
    // today + 14-day horizon inclusive → 15 dates for daily
    expect(instances.length).toBe(15);
    expect(instances[0]?.instanceDate).toBe("2026-07-09");
    expect(instances[1]?.instanceDate).toBe("2026-07-10");

    const day2 = instances[1]!;
    const day2Components = db
      .select()
      .from(casinoOfferComponents)
      .where(eq(casinoOfferComponents.casinoOfferId, day2.id))
      .all();
    expect(day2Components).toHaveLength(1);
    expect(day2Components[0]?.expectedEv).toBe(seedComponent.expectedEv);
    expect(day2Components[0]?.amount).toBe(10);

    // Idempotent seal
    expect(maybeSealCasinoSeriesTemplate(offerId, now)).toBe(false);
    expect(
      db
        .select()
        .from(casinoOfferSeriesComponents)
        .where(eq(casinoOfferSeriesComponents.seriesId, seriesId))
        .all()
    ).toHaveLength(1);

    // No double-materialisation on re-sync
    expect(syncCasinoOfferSeriesInstances(now)).toBe(0);
    expect(
      db.select().from(casinoOffers).where(eq(casinoOffers.seriesId, seriesId)).all()
    ).toHaveLength(15);
  });

  it("materialises multi-component campaigns with freshly derived EVs per type", () => {
    const now = new Date(2026, 6, 9, 10, 0, 0).getTime();
    const { seriesId, offerId } = createCasinoOfferSeriesWithInstance(
      baseTemplate,
      { freq: "daily", interval: 1 },
      { now }
    );
    // Qualifying wager drag + free spins reward on one campaign.
    const qwEv = deriveComponentEv({
      componentType: "qualifying_wager",
      amount: 20,
      rtp: 0.96,
    });
    db.insert(casinoOfferComponents)
      .values({
        casinoOfferId: offerId,
        componentType: "qualifying_wager",
        amount: 20,
        wageringMultiplier: null,
        rtp: 0.96,
        contributionPct: null,
        spins: null,
        spinValue: null,
        chipCount: null,
        chipValue: null,
        houseEdgePreset: null,
        cashbackPct: null,
        cashbackCap: null,
        game: null,
        expectedEv: qwEv,
        sortOrder: 0,
        createdAt: now,
      })
      .run();
    const fsEv = deriveComponentEv({
      componentType: "free_spins",
      spins: 50,
      spinValue: 0.2,
      rtp: 0.96,
    });
    db.insert(casinoOfferComponents)
      .values({
        casinoOfferId: offerId,
        componentType: "free_spins",
        amount: null,
        wageringMultiplier: null,
        rtp: 0.96,
        contributionPct: null,
        spins: 50,
        spinValue: 0.2,
        chipCount: null,
        chipValue: null,
        houseEdgePreset: null,
        cashbackPct: null,
        cashbackCap: null,
        game: null,
        expectedEv: fsEv,
        sortOrder: 1,
        createdAt: now,
      })
      .run();

    maybeSealCasinoSeriesTemplate(offerId, now);

    const day2 = db
      .select()
      .from(casinoOffers)
      .where(eq(casinoOffers.seriesId, seriesId))
      .all()
      .find((o) => o.instanceDate === "2026-07-10");
    expect(day2).toBeTruthy();
    const comps = db
      .select()
      .from(casinoOfferComponents)
      .where(eq(casinoOfferComponents.casinoOfferId, day2!.id))
      .all()
      .sort((a, b) => a.sortOrder - b.sortOrder);
    expect(comps).toHaveLength(2);
    expect(comps[0]?.componentType).toBe("qualifying_wager");
    expect(comps[0]?.expectedEv).toBe(
      deriveComponentEv({ componentType: "qualifying_wager", amount: 20, rtp: 0.96 })
    );
    expect(comps[1]?.componentType).toBe("free_spins");
    expect(comps[1]?.expectedEv).toBe(
      deriveComponentEv({
        componentType: "free_spins",
        spins: 50,
        spinValue: 0.2,
        rtp: 0.96,
      })
    );
  });

  it("re-syncs the template when a second step is added after early seal (calendar EV bug)", () => {
    // Reproduce: seal with qualifying wager only (-EV), then add a reward on
    // the seed. Untouched horizon clones must pick up both steps / full EV.
    const now = new Date(2026, 6, 9, 10, 0, 0).getTime();
    const { seriesId, offerId } = createCasinoOfferSeriesWithInstance(
      { ...baseTemplate, casino: "PricedUp", title: "Spend £30 on a selected slot game" },
      { freq: "daily", interval: 1 },
      { now }
    );

    const qwFields = {
      componentType: "qualifying_wager" as const,
      amount: 30,
      rtp: 0.9657,
    };
    const qwEv = deriveComponentEv(qwFields);
    db.insert(casinoOfferComponents)
      .values({
        casinoOfferId: offerId,
        componentType: "qualifying_wager",
        amount: 30,
        wageringMultiplier: null,
        rtp: 0.9657,
        contributionPct: null,
        spins: null,
        spinValue: null,
        chipCount: null,
        chipValue: null,
        houseEdgePreset: null,
        cashbackPct: null,
        cashbackCap: null,
        game: null,
        expectedEv: qwEv,
        sortOrder: 0,
        createdAt: now,
      })
      .run();
    expect(maybeSealCasinoSeriesTemplate(offerId, now)).toBe(true);

    const day2Before = db
      .select()
      .from(casinoOffers)
      .where(eq(casinoOffers.seriesId, seriesId))
      .all()
      .find((o) => o.instanceDate === "2026-07-10")!;
    expect(
      db
        .select()
        .from(casinoOfferComponents)
        .where(eq(casinoOfferComponents.casinoOfferId, day2Before.id))
        .all()
    ).toHaveLength(1);
    expect(sumCampaignEv(
      db
        .select()
        .from(casinoOfferComponents)
        .where(eq(casinoOfferComponents.casinoOfferId, day2Before.id))
        .all()
    )).toBeCloseTo(qwEv, 2);

    // Second step added on the seed after seal (log dialog → desk flow).
    const bonusFields = {
      componentType: "bonus" as const,
      amount: 2.6,
      wageringMultiplier: 1,
      rtp: 0.9657,
    };
    const bonusEv = deriveComponentEv(bonusFields);
    db.insert(casinoOfferComponents)
      .values({
        casinoOfferId: offerId,
        ...bonusFields,
        contributionPct: null,
        spins: null,
        spinValue: null,
        chipCount: null,
        chipValue: null,
        houseEdgePreset: null,
        cashbackPct: null,
        cashbackCap: null,
        game: null,
        expectedEv: bonusEv,
        sortOrder: 1,
        createdAt: now,
      })
      .run();
    expect(syncCasinoSeriesTemplateFromOffer(offerId, now)).toBe(true);

    const template = db
      .select()
      .from(casinoOfferSeriesComponents)
      .where(eq(casinoOfferSeriesComponents.seriesId, seriesId))
      .all();
    expect(template).toHaveLength(2);

    const day2Comps = db
      .select()
      .from(casinoOfferComponents)
      .where(eq(casinoOfferComponents.casinoOfferId, day2Before.id))
      .all()
      .sort((a, b) => a.sortOrder - b.sortOrder);
    expect(day2Comps).toHaveLength(2);
    expect(sumCampaignEv(day2Comps)).toBeCloseTo(qwEv + bonusEv, 2);

    // Today's active seed clone path: restamp siblings that stayed on the old template.
    const todayComps = db
      .select()
      .from(casinoOfferComponents)
      .where(eq(casinoOfferComponents.casinoOfferId, offerId))
      .all();
    expect(todayComps).toHaveLength(2);
  });

  it("repair on sync promotes a richer instance into the series template", () => {
    const now = new Date(2026, 6, 9, 10, 0, 0).getTime();
    const { seriesId, offerId } = createCasinoOfferSeriesWithInstance(
      baseTemplate,
      { freq: "daily", interval: 1 },
      { now }
    );
    addBonusComponent(offerId, 10, now);
    maybeSealCasinoSeriesTemplate(offerId, now);

    // Simulate legacy divergence: seed gained a second step without template sync.
    const rewardEv = deriveComponentEv({
      componentType: "bonus",
      amount: 5,
      wageringMultiplier: 1,
      rtp: 0.96,
    });
    db.insert(casinoOfferComponents)
      .values({
        casinoOfferId: offerId,
        componentType: "bonus",
        amount: 5,
        wageringMultiplier: 1,
        rtp: 0.96,
        contributionPct: null,
        spins: null,
        spinValue: null,
        chipCount: null,
        chipValue: null,
        houseEdgePreset: null,
        cashbackPct: null,
        cashbackCap: null,
        game: null,
        expectedEv: rewardEv,
        sortOrder: 1,
        createdAt: now,
      })
      .run();

    expect(
      db
        .select()
        .from(casinoOfferSeriesComponents)
        .where(eq(casinoOfferSeriesComponents.seriesId, seriesId))
        .all()
    ).toHaveLength(1);

    syncCasinoOfferSeriesInstances(now);

    expect(
      db
        .select()
        .from(casinoOfferSeriesComponents)
        .where(eq(casinoOfferSeriesComponents.seriesId, seriesId))
        .all()
    ).toHaveLength(2);

    const clone = db
      .select()
      .from(casinoOffers)
      .where(eq(casinoOffers.seriesId, seriesId))
      .all()
      .find((o) => o.instanceDate === "2026-07-10")!;
    expect(
      db
        .select()
        .from(casinoOfferComponents)
        .where(eq(casinoOfferComponents.casinoOfferId, clone.id))
        .all()
    ).toHaveLength(2);
  });

  it("rolls a planned instance to active when its date becomes today", () => {
    const thursday = new Date(2026, 6, 9, 10, 0, 0).getTime();
    const { seriesId, offerId } = createCasinoOfferSeriesWithInstance(
      baseTemplate,
      { freq: "weekly", interval: 1, byWeekday: [3] },
      { now: thursday }
    );
    addBonusComponent(offerId, 10, thursday);
    maybeSealCasinoSeriesTemplate(offerId, thursday);

    const wed = db
      .select()
      .from(casinoOffers)
      .where(eq(casinoOffers.seriesId, seriesId))
      .all()
      .find((o) => o.instanceDate === "2026-07-15");
    expect(wed?.status).toBe("planned");

    const wednesdayNow = new Date(2026, 6, 15, 10, 0, 0).getTime();
    syncCasinoOfferSeriesInstances(wednesdayNow);
    const rolled = db.select().from(casinoOffers).where(eq(casinoOffers.id, wed!.id)).get();
    expect(rolled?.status).toBe("active");
  });
});

describe("stopCasinoOfferRecurrence", () => {
  it("disables the series and deletes untouched future planned instances, leaving history", () => {
    const now = new Date(2026, 6, 9, 10, 0, 0).getTime();
    const { seriesId, offerId } = createCasinoOfferSeriesWithInstance(
      baseTemplate,
      { freq: "daily", interval: 1 },
      { now }
    );
    addBonusComponent(offerId, 10, now);
    maybeSealCasinoSeriesTemplate(offerId, now);

    // Mark today's instance as started work.
    db.update(casinoOffers)
      .set({ status: "active" })
      .where(eq(casinoOffers.id, offerId))
      .run();

    stopCasinoOfferRecurrence(seriesId, "2026-07-10");

    const series = db
      .select()
      .from(casinoOfferSeries)
      .where(eq(casinoOfferSeries.id, seriesId))
      .get();
    expect(series?.recurrenceEnabled).toBe(0);
    expect(series?.recurrenceStoppedFrom).toBe("2026-07-10");

    const remaining = db
      .select()
      .from(casinoOffers)
      .where(eq(casinoOffers.seriesId, seriesId))
      .all();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(offerId);
    expect(remaining[0]?.instanceDate).toBe("2026-07-09");
  });

  it("keeps a future planned instance that has diverged from the template", () => {
    const now = new Date(2026, 6, 9, 10, 0, 0).getTime();
    const { seriesId, offerId } = createCasinoOfferSeriesWithInstance(
      baseTemplate,
      { freq: "daily", interval: 1 },
      { now }
    );
    addBonusComponent(offerId, 10, now);
    maybeSealCasinoSeriesTemplate(offerId, now);

    const future = db
      .select()
      .from(casinoOffers)
      .where(eq(casinoOffers.seriesId, seriesId))
      .all()
      .find((o) => o.instanceDate === "2026-07-11");
    expect(future).toBeTruthy();
    addBonusComponent(future!.id, 5, now); // second step → diverged

    stopCasinoOfferRecurrence(seriesId, "2026-07-10");

    const kept = db.select().from(casinoOffers).where(eq(casinoOffers.id, future!.id)).get();
    expect(kept).toBeTruthy();
  });
});

describe("deleteCasinoOfferWithScope", () => {
  it("deletes one occurrence and skips that date so sync does not recreate it", () => {
    const now = new Date(2026, 6, 9, 10, 0, 0).getTime();
    const { seriesId, offerId } = createCasinoOfferSeriesWithInstance(
      baseTemplate,
      { freq: "daily", interval: 1 },
      { now }
    );
    addBonusComponent(offerId, 10, now);
    maybeSealCasinoSeriesTemplate(offerId, now);

    const target = db.select().from(casinoOffers).where(eq(casinoOffers.id, offerId)).get()!;
    deleteCasinoOfferWithScope(target, "instance");

    expect(db.select().from(casinoOffers).where(eq(casinoOffers.id, offerId)).get()).toBeUndefined();

    const series = db
      .select()
      .from(casinoOfferSeries)
      .where(eq(casinoOfferSeries.id, seriesId))
      .get();
    expect(series?.recurrenceEnabled).toBe(1);
    expect(parseSkippedDates(series?.skippedDatesJson)).toEqual(["2026-07-09"]);

    syncCasinoOfferSeriesInstances(now);
    const after = db.select().from(casinoOffers).where(eq(casinoOffers.seriesId, seriesId)).all();
    expect(after.some((o) => o.instanceDate === "2026-07-09")).toBe(false);
    expect(after.some((o) => o.instanceDate === "2026-07-10")).toBe(true);
  });
});
