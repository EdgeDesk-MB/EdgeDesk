import { describe, expect, it } from "vitest";
import { resolveOfferConfidence, formatOddsSourceLabel } from "@/lib/offers/place-refund-ev";

describe("manual odds confidence", () => {
  it("treats manual bookie odds as mixed (better than a pure estimate)", () => {
    expect(resolveOfferConfidence("manual", "estimated")).toBe("mixed");
    expect(resolveOfferConfidence("manual", "live")).toBe("mixed");
    expect(resolveOfferConfidence("proxy", "estimated")).toBe("estimate");
    expect(resolveOfferConfidence("proxy", "live")).toBe("mixed");
  });

  it("labels manual source clearly", () => {
    expect(formatOddsSourceLabel("manual")).toBe("Manual override");
  });
});
