import { describe, expect, it } from "vitest";
import { accaSquareHeadline } from "./acca-square-headline";

describe("accaSquareHeadline", () => {
  it("cash mid-run cover: if this loses, not worst outcome", () => {
    const h = accaSquareHeadline({
      square: { value: 0, kind: "worst", squareLegSeq: 1 },
      method: "sequential",
      legs: [
        { seq: 1, label: "Star Start", result: "pending" },
        { seq: 2, label: "Burning Up", result: "pending" },
      ],
      allWinEst: { value: -14, usedProxy: true },
    });
    expect(h).toEqual({
      mode: "cover",
      loseLabel: "If Star Start loses",
      value: 0,
      nextVerb: "lock",
      nextLabel: "Burning Up",
      winEst: -14,
      winEstProxy: true,
    });
  });

  it("free-bet mid-run cover: bust extraction is the lose path", () => {
    const h = accaSquareHeadline({
      square: { value: 10, kind: "worst", squareLegSeq: 1 },
      method: "sequential",
      legs: [
        { seq: 1, label: "Flying Pirate", result: "pending" },
        { seq: 2, label: "High Hazard", result: "pending" },
      ],
      allWinEst: { value: 0, usedProxy: true },
    });
    expect(h).toMatchObject({
      mode: "cover",
      loseLabel: "If Flying Pirate loses",
      value: 10,
      nextVerb: "lock",
      nextLabel: "High Hazard",
      winEst: 0,
    });
  });

  it("treble mid-run names the next cover as lay, not lock", () => {
    const h = accaSquareHeadline({
      square: { value: 0, kind: "worst", squareLegSeq: 1 },
      method: "sequential",
      legs: [
        { seq: 1, label: "A", result: "pending" },
        { seq: 2, label: "B", result: "pending" },
        { seq: 3, label: "C", result: "pending" },
      ],
      allWinEst: { value: -8, usedProxy: true },
    });
    expect(h).toMatchObject({ mode: "cover", nextVerb: "lay", nextLabel: "B" });
  });

  it("final laid sequential lock stays Locked", () => {
    const h = accaSquareHeadline({
      square: { value: -14, kind: "locked", squareLegSeq: 2 },
      method: "sequential",
      legs: [
        { seq: 1, label: "Star Start", result: "won" },
        { seq: 2, label: "Burning Up", result: "pending" },
      ],
      allWinEst: { value: -14, usedProxy: false },
    });
    expect(h).toEqual({ mode: "locked", label: "Locked", value: -14 });
  });

  it("whole-acca unequal hedge stays Worst outcome", () => {
    const h = accaSquareHeadline({
      square: { value: -2.4, kind: "worst", squareLegSeq: null },
      method: "combined",
      legs: [
        { seq: 1, label: "A", result: "pending" },
        { seq: 2, label: "B", result: "pending" },
      ],
      allWinEst: { value: 1.1, usedProxy: false },
    });
    expect(h).toEqual({ mode: "worst", label: "Worst outcome", value: -2.4 });
  });

  it("insurance mid-run cover lays the next leg", () => {
    const h = accaSquareHeadline({
      square: { value: 0, kind: "worst", squareLegSeq: 1 },
      method: "insurance_legs",
      legs: [
        { seq: 1, label: "A", result: "pending" },
        { seq: 2, label: "B", result: "pending" },
      ],
      allWinEst: { value: 4, usedProxy: true },
    });
    expect(h).toMatchObject({ mode: "cover", nextVerb: "lay", nextLabel: "B" });
  });
});
