import { describe, expect, it } from "vitest";
import { moneyPositiveClass } from "./money-flow";
import { contrastInkOrWhite, relativeLuminance } from "@/lib/brand-accent";

function contrastRatio(a: string, b: string): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

describe("moneyPositiveClass", () => {
  it("uses the profit token, not Tailwind emerald", () => {
    expect(moneyPositiveClass).toBe("text-profit");
  });
});

describe("EDGE-32 default amber pairs", () => {
  it("keeps ink on the default brand plate", () => {
    expect(contrastInkOrWhite("#FFC71E")).toBe("#111111");
  });

  it("gives light-mode profit type AA on the canvas", () => {
    // --profit light ≈ #0a5c2c; --canvas light ≈ #e2e3e4
    expect(contrastRatio("#0a5c2c", "#e2e3e4")).toBeGreaterThanOrEqual(4.5);
  });

  it("gives dark-mode profit type AA on the page", () => {
    // --profit dark ≈ #34d399; --page dark ≈ #101213
    expect(contrastRatio("#34d399", "#101213")).toBeGreaterThanOrEqual(4.5);
  });
});
