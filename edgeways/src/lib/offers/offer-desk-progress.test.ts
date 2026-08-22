import { describe, expect, it } from "vitest";
import {
  indexOfferDeskProgress,
  ordinalLeg,
  progressFromAcca,
  progressFromBetBuilder,
  progressFromSystems,
} from "./offer-desk-progress";

describe("ordinalLeg", () => {
  it("uses 1st / 2nd / 3rd then th, including teens", () => {
    expect(ordinalLeg(1)).toBe("1st");
    expect(ordinalLeg(2)).toBe("2nd");
    expect(ordinalLeg(3)).toBe("3rd");
    expect(ordinalLeg(4)).toBe("4th");
    expect(ordinalLeg(11)).toBe("11th");
    expect(ordinalLeg(12)).toBe("12th");
    expect(ordinalLeg(21)).toBe("21st");
  });
});

describe("progressFromAcca", () => {
  const york = {
    id: 7,
    offerId: 42,
    status: "active",
    method: "sequential",
    wholeLayStake: null,
    legs: [
      {
        seq: 1,
        label: "Notable Speech",
        result: "won" as const,
        layStake: 10,
      },
      {
        seq: 2,
        label: "Dance In The Storm",
        result: "pending" as const,
        layStake: null,
      },
    ],
  };

  it("after a winning first leg, asks to lay the 2nd", () => {
    const p = progressFromAcca(york);
    expect(p).toMatchObject({
      kind: "acca",
      href: "/acca",
      actionTitle: "Lay 2nd leg",
      actionDetail: "Lay Dance In The Storm on Acca Desk.",
      done: 1,
      total: 2,
      progressCaption: "1/2 laid",
      nextCaption: "Dance In The Storm",
      needsAction: true,
    });
  });

  it("while the first laid leg is still in play, waits rather than asking to lay the 2nd", () => {
    const p = progressFromAcca({
      ...york,
      legs: [
        { seq: 1, label: "Notable Speech", result: "pending", layStake: 10 },
        { seq: 2, label: "Dance In The Storm", result: "pending", layStake: null },
      ],
    });
    expect(p?.needsAction).toBe(false);
    expect(p?.stageLabel).toBe("Awaiting result");
    expect(p?.progressCaption).toBe("1/2 laid");
    expect(p?.nextCaption).toBe("Lay next after this result");
  });

  it("asks to lay the 1st when nothing is on yet", () => {
    const p = progressFromAcca({
      ...york,
      legs: [
        { seq: 1, label: "Notable Speech", result: "pending", layStake: null },
        { seq: 2, label: "Dance In The Storm", result: "pending", layStake: null },
      ],
    });
    expect(p?.actionTitle).toBe("Lay 1st leg");
    expect(p?.needsAction).toBe(true);
    expect(p?.done).toBe(0);
  });

  it("treats an unlaid combined acca as lay the combo", () => {
    const p = progressFromAcca({
      ...york,
      method: "combined",
      legs: york.legs.map((l) => ({ ...l, result: "pending", layStake: null })),
    });
    expect(p?.actionTitle).toBe("Lay the combo");
    expect(p?.needsAction).toBe(true);
    expect(p?.progressCaption).toBe("0/1 laid");
  });

  it("ignores finished or unlinked runs", () => {
    expect(progressFromAcca({ ...york, status: "completed" })).toBeNull();
    expect(progressFromAcca({ ...york, offerId: null })).toBeNull();
    expect(
      progressFromAcca({
        ...york,
        legs: [
          { ...york.legs[0]!, result: "lost" },
          york.legs[1]!,
        ],
      })
    ).toBeNull();
  });
});

describe("progressFromBetBuilder / systems", () => {
  it("asks to lay an unlaid combined builder", () => {
    const p = progressFromBetBuilder({
      id: 3,
      offerId: 9,
      status: "active",
      method: "combined",
      wholeLayStake: null,
      selectionCount: 3,
    });
    expect(p?.actionTitle).toBe("Lay the bet builder");
    expect(p?.needsAction).toBe(true);
    expect(p?.progressCaption).toBe("3 selections · 0/1 laid");
  });

  it("shows settled/total on an in-play system", () => {
    const p = progressFromSystems({
      id: 4,
      offerId: 11,
      status: "active",
      legs: [
        { seq: 1, label: "A", result: "won" },
        { seq: 2, label: "B", result: "pending" },
        { seq: 3, label: "C", result: "pending" },
      ],
    });
    expect(p?.kind).toBe("systems");
    expect(p?.href).toBe("/systems");
    expect(p?.progressCaption).toBe("1/3 settled");
    expect(p?.nextCaption).toBe("B");
    expect(p?.needsAction).toBe(false);
  });
});

describe("indexOfferDeskProgress", () => {
  it("prefers a lay-due acca over a waiting builder on the same offer", () => {
    const map = indexOfferDeskProgress({
      acca: [
        {
          id: 1,
          offerId: 5,
          status: "active",
          method: "sequential",
          wholeLayStake: null,
          legs: [
            { seq: 1, label: "A", result: "won", layStake: 10 },
            { seq: 2, label: "B", result: "pending", layStake: null },
          ],
        },
      ],
      betBuilder: [
        {
          id: 2,
          offerId: 5,
          status: "active",
          method: "combined",
          wholeLayStake: 12,
          selectionCount: 2,
        },
      ],
    });
    expect(map.get(5)?.kind).toBe("acca");
    expect(map.get(5)?.needsAction).toBe(true);
  });
});
