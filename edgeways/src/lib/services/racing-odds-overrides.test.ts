import { describe, expect, it } from "vitest";
import { resolveOfferConfidence, formatOddsSourceLabel } from "@/lib/offers/place-refund-ev";

describe("manual odds confidence", () => {
  it("treats manual bookie odds as mixed (better than proxy estimate)", () => {
    expect(resolveOfferConfidence("manual", "estimated")).toBe("mixed");
    expect(resolveOfferConfidence("manual", "live")).toBe("mixed");
    expect(resolveOfferConfidence("proxy", "estimated")).toBe("estimate");
  });

  it("labels manual source clearly", () => {
    expect(formatOddsSourceLabel("manual")).toBe("Manual override");
  });
});
