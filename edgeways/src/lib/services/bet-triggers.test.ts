import { describe, expect, it } from "vitest";
import { isFreeBetUsageBetType, resolveTriggerFields } from "./bet-triggers";

describe("resolveTriggerFields", () => {
  it("strips triggers for free-bet conversion types even when trigger text is sent", () => {
    for (const betType of ["free_snr", "free_sr"] as const) {
      const resolved = resolveTriggerFields({
        betType,
        label: "Convert FB · Ladbrokes",
        triggerText: "Bet £10 get £10 free bet",
      });
      expect(resolved.triggerText).toBeNull();
      expect(resolved.triggerRule).toBeNull();
    }
  });

  it("does not infer offer triggers from the label on free-bet conversion", () => {
    const resolved = resolveTriggerFields({
      betType: "free_snr",
      label: "Bet £10 get £10 free bet",
    });
    expect(resolved.triggerText).toBeNull();
    expect(resolved.triggerRule).toBeNull();
  });

  it("keeps qualifying trigger parsing", () => {
    const resolved = resolveTriggerFields({
      betType: "qualifying",
      label: "Thirsk 14:40",
      triggerText: "Bet £10 get £10 free bet",
    });
    expect(resolved.triggerText).toBe("Bet £10 get £10 free bet");
    expect(resolved.triggerRule).toMatch(/free_bet_award/);
  });
});

describe("isFreeBetUsageBetType", () => {
  it("matches SNR and SR only", () => {
    expect(isFreeBetUsageBetType("free_snr")).toBe(true);
    expect(isFreeBetUsageBetType("free_sr")).toBe(true);
    expect(isFreeBetUsageBetType("qualifying")).toBe(false);
  });
});
