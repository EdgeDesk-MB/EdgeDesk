import { describe, expect, it } from "vitest";
import { plainAlertBody } from "./plain-body";

describe("plainAlertBody", () => {
  it("suffixes identity alerts with (Bookie)", () => {
    expect(
      plainAlertBody({
        body: "Qualifying · Bet £10 get £10 free bet",
        bookmaker: "Ivybet",
        kind: "result_settled",
      })
    ).toBe("Qualifying · Bet £10 get £10 free bet (Ivybet)");
  });

  it("prefixes offer_expiring alerts with Bookie ·", () => {
    expect(
      plainAlertBody({
        body: "Bet £5 get £5 free bet · place the £5 qualifying bet",
        bookmaker: "Bet365",
        kind: "offer_expiring",
      })
    ).toBe("Bet365 · Bet £5 get £5 free bet · place the £5 qualifying bet");
  });

  it("leaves body alone when there is no bookie", () => {
    expect(plainAlertBody({ body: "No bet logged · finish the workflow" })).toBe(
      "No bet logged · finish the workflow"
    );
  });
});
