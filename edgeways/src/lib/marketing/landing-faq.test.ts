import { describe, expect, it } from "vitest";
import { HOW_IT_HELPS_LEAD, POSITIONING_FAQ } from "./landing-faq";

describe("landing positioning (EDGE-64)", () => {
  it("says we supplement finders and do not send bookie offers", () => {
    expect(HOW_IT_HELPS_LEAD).toContain("We supplement finders, we do not replace them");
    expect(HOW_IT_HELPS_LEAD).toContain("We do not send bookie offers");
  });

  it("answers the offer-feed and beginner questions", () => {
    const questions = POSITIONING_FAQ.map((item) => item.q);
    expect(questions).toContain("Do you send me bookie offers?");
    expect(questions).toContain("I'm new to matched betting. Is this for me?");
    const offers = POSITIONING_FAQ.find((item) => item.q.startsWith("Do you send"));
    expect(offers?.a.startsWith("No.")).toBe(true);
    expect(offers?.a).toContain("Oddsmonkey");
    expect(offers?.a).toContain("Outplayed");
  });
});
