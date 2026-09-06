import { describe, expect, it } from "vitest";
import { roundPence, roundToIncrement, stepByIncrement } from "./money";

describe("roundToIncrement", () => {
  // Hand-worked from Dutch 2025.xlsx Man Utd v Everton (row 1188):
  // First £275 @ 1.93 → Draw ideal = 275 × 1.93 / 4 = 132.6875
  // Away ideal = 275 × 1.93 / 3.6 = 147.430555...
  it("MROUND to £0.01 matches the spreadsheet Draw/Away ideals", () => {
    expect(roundToIncrement(132.6875, 0.01)).toBe(132.69);
    expect(roundToIncrement(147.43055555555556, 0.01)).toBe(147.43);
  });

  it("MROUND to £1.00 / £0.50 / £2.50 uses nearest multiple, half away from zero", () => {
    expect(roundToIncrement(132.6875, 1)).toBe(133);
    expect(roundToIncrement(147.43055555555556, 1)).toBe(147);
    expect(roundToIncrement(132.6875, 0.5)).toBe(132.5);
    expect(roundToIncrement(147.43055555555556, 0.5)).toBe(147.5);
    // 1.25 / 2.5 = 0.5 → 2.50 (half away from zero)
    expect(roundToIncrement(1.25, 2.5)).toBe(2.5);
    expect(roundToIncrement(1.24, 2.5)).toBe(0);
  });

  it("falls back to penny rounding when the increment is missing or not positive", () => {
    expect(roundToIncrement(1.234, 0)).toBe(roundPence(1.234));
    expect(roundToIncrement(1.234, -1)).toBe(1.23);
    expect(roundToIncrement(Number.NaN, 0.01)).toBe(0);
  });
});

describe("stepByIncrement", () => {
  // Draw ideal 132.69 / Away 147.43 from the Man Utd First-mode book.
  it("£1 arrows snap off 132.69 onto the next pound", () => {
    expect(stepByIncrement(132.69, 1, 1)).toBe(133);
    expect(stepByIncrement(132.69, 1, -1)).toBe(132);
  });

  it("£1 arrows from an already-rounded stake move by exactly one pound", () => {
    expect(stepByIncrement(133, 1, 1)).toBe(134);
    expect(stepByIncrement(133, 1, -1)).toBe(132);
  });

  it("1p arrows stay on the penny grid", () => {
    expect(stepByIncrement(147.43, 0.01, 1)).toBe(147.44);
    expect(stepByIncrement(147.43, 0.01, -1)).toBe(147.42);
  });

  it("50p and £2.50 arrows land on those increments", () => {
    expect(stepByIncrement(132.69, 0.5, 1)).toBe(133);
    expect(stepByIncrement(132.69, 0.5, -1)).toBe(132.5);
    expect(stepByIncrement(132.69, 2.5, 1)).toBe(135);
    expect(stepByIncrement(132.69, 2.5, -1)).toBe(132.5);
  });

  it("£2 and £5 arrows land on those increments", () => {
    expect(stepByIncrement(132.69, 2, 1)).toBe(134);
    expect(stepByIncrement(132.69, 2, -1)).toBe(132);
    expect(stepByIncrement(134, 2, 1)).toBe(136);
    expect(stepByIncrement(147.43, 5, 1)).toBe(150);
    expect(stepByIncrement(147.43, 5, -1)).toBe(145);
    expect(stepByIncrement(150, 5, 1)).toBe(155);
  });

  it("does not step below zero", () => {
    expect(stepByIncrement(0, 1, -1)).toBe(0);
    expect(stepByIncrement(2, 5, -1)).toBe(0);
  });

  it("falls back to 1p when the increment is missing or not positive", () => {
    expect(stepByIncrement(1.23, 0, 1)).toBe(1.24);
    expect(stepByIncrement(Number.NaN, 1, 1)).toBe(0);
  });
});
