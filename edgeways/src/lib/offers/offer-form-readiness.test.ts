import { describe, expect, it } from "vitest";
import {
  computeCasinoFormReadiness,
  computeOfferFormReadiness,
} from "./offer-form-readiness";

describe("computeOfferFormReadiness", () => {
  it("scores a filled football bet&get as complete", () => {
    const r = computeOfferFormReadiness({
      isRacing: false,
      title: "Bet £20 get £10 free bet (Football)",
      bookmaker: "Dynobet",
      expiresAtMs: Date.parse("2026-08-12T23:59:00"),
      minOdds: "1.5",
      minStake: "20",
      betStake: "",
      freeBetAmount: "",
    });
    expect(r).toEqual({ completed: 6, total: 6, percent: 100 });
  });

  it("counts missing bookie and expiry", () => {
    const r = computeOfferFormReadiness({
      isRacing: false,
      title: "Bet £20 get £10 free bet (Football)",
      bookmaker: "",
      expiresAtMs: null,
      minOdds: "1.5",
      minStake: "20",
      betStake: "",
      freeBetAmount: "",
    });
    expect(r.completed).toBe(4);
    expect(r.total).toBe(6);
    expect(r.percent).toBe(67);
  });

  it("allows racing title to come from stakes", () => {
    const r = computeOfferFormReadiness({
      isRacing: true,
      title: "",
      bookmaker: "Coral",
      expiresAtMs: Date.parse("2026-08-12T23:59:00"),
      minOdds: "1.25",
      minStake: "",
      betStake: "10",
      freeBetAmount: "10",
    });
    expect(r.completed).toBe(6);
  });
});

describe("computeCasinoFormReadiness", () => {
  it("needs casino, title and parsed draft", () => {
    expect(
      computeCasinoFormReadiness({
        casino: "Sky Vegas",
        title: "Stake £10 get £20",
        hasDraft: true,
      }).percent
    ).toBe(100);
    expect(
      computeCasinoFormReadiness({
        casino: "",
        title: "",
        hasDraft: false,
      }).completed
    ).toBe(0);
  });
});
