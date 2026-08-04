import { describe, expect, it } from "vitest";
import {
  compareByAccessThenName,
  isWorldCupCompetition,
  normalizeAccessStatus,
} from "./access";

describe("normalizeAccessStatus", () => {
  it("defaults unknown to available", () => {
    expect(normalizeAccessStatus(null)).toBe("available");
    expect(normalizeAccessStatus("weird")).toBe("available");
  });
});

describe("compareByAccessThenName", () => {
  it("sorts available before gubbed before closed", () => {
    const list = [
      { name: "Zed", accessStatus: "gubbed" },
      { name: "Alpha", accessStatus: "closed" },
      { name: "Beta", accessStatus: "available" },
      { name: "Gamma", accessStatus: "available" },
    ];
    const sorted = [...list].sort(compareByAccessThenName);
    expect(sorted.map((x) => x.name)).toEqual(["Beta", "Gamma", "Zed", "Alpha"]);
  });
});

describe("isWorldCupCompetition", () => {
  it("matches common WC labels", () => {
    expect(isWorldCupCompetition("FIFA World Cup")).toBe(true);
    expect(isWorldCupCompetition("World Cup - Group Stage")).toBe(true);
    expect(isWorldCupCompetition("Premier League")).toBe(false);
  });
});
