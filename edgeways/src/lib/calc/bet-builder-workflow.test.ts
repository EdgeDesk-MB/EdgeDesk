import { describe, expect, it } from "vitest";
import { bbCampaignProfit } from "./bet-builder-workflow";

describe("bbCampaignProfit", () => {
  it("all-win with whole lay mirrors per-bet roundPence", () => {
    // Back +£40, lay lost −roundPence(9.26×4.5) = −41.67 → −1.67
    expect(
      bbCampaignProfit(
        {
          stake: 10,
          backOdds: 5,
          commission: 0.02,
          wholeLayStake: 9.26,
          wholeLayOdds: 5.5,
        },
        [{ result: "won" }, { result: "won" }]
      )
    ).toBe(-1.67);
  });

  it("lose with whole lay: −stake + rounded lay win", () => {
    // −10 + roundPence(9.5×0.98) = −10 + 9.31 = −0.69
    expect(
      bbCampaignProfit(
        {
          stake: 10,
          backOdds: 5,
          commission: 0.02,
          wholeLayStake: 9.5,
          wholeLayOdds: 5.2,
        },
        [{ result: "lost" }, { result: "won" }]
      )
    ).toBe(-0.69);
  });

  it("free_snr lose contributes £0 on the back", () => {
    expect(
      bbCampaignProfit(
        {
          stake: 10,
          backOdds: 5,
          commission: 0,
          backBetType: "free_snr",
        },
        [{ result: "lost" }, { result: "won" }]
      )
    ).toBe(0);
  });

  it("still-open run reports £0", () => {
    expect(
      bbCampaignProfit(
        { stake: 10, backOdds: 5, commission: 0 },
        [{ result: "won" }, { result: "pending" }]
      )
    ).toBe(0);
  });
});
