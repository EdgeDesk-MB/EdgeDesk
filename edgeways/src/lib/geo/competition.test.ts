import { describe, expect, it } from "vitest";
import { competitionFlagIso } from "@/lib/geo/competition";

describe("competitionFlagIso", () => {
  it("uses the England flag for English leagues", () => {
    expect(competitionFlagIso("Premier League", "England")).toBe("ENG");
    expect(competitionFlagIso("Premier League")).toBe("ENG");
    expect(competitionFlagIso("Championship", "England")).toBe("ENG");
    expect(competitionFlagIso("FA Cup")).toBe("ENG");
  });

  it("keeps other countries and global comps", () => {
    expect(competitionFlagIso("La Liga", "Spain")).toBe("ES");
    expect(competitionFlagIso("Liga MX", "Mexico")).toBe("MX");
    expect(competitionFlagIso("Primera División", "Bolivia")).toBe("BO");
    expect(competitionFlagIso("FIFA World Cup", "World")).toBeNull();
    expect(competitionFlagIso("Second League - Group 2", "Russia")).toBe("RU");
  });
});
