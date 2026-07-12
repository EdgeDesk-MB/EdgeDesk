import { describe, expect, it } from "vitest";
import {
  atrCoursePath,
  atrDatePath,
  buildAtrResultsLink,
  buildRacingResultsLinks,
} from "./results-link";
import { cleanHorseName, parseRaceResultText } from "./parse-race-result-text";

describe("ATR results links", () => {
  it("formats course and date paths", () => {
    expect(atrCoursePath("Doncaster")).toBe("Doncaster");
    expect(atrCoursePath("Ffos Las")).toBe("Ffos Las");
    expect(atrCoursePath("Chelmsford")).toBe("Chelmsford City");
    expect(atrCoursePath("Wolverhampton (AW)")).toBe("Wolverhampton");
    expect(atrDatePath(new Date(2026, 6, 3, 16, 55).getTime())).toBe("03-July-2026");
  });

  it("builds View race result deep-link only", () => {
    const start = new Date(2026, 6, 3, 16, 55).getTime();
    const atr = buildAtrResultsLink({ competition: "Doncaster", startTime: start });
    expect(atr?.exact).toBe(true);
    expect(atr?.label).toBe("View race result");
    expect(atr?.url).toBe(
      "https://www.attheraces.com/racecard/Doncaster/03-July-2026/1655"
    );

    const links = buildRacingResultsLinks({ competition: "Doncaster", startTime: start });
    expect(links).toHaveLength(1);
    expect(links[0]?.label).toBe("View race result");
  });
});

describe("parseRaceResultText", () => {
  it("parses Racing TV style positions", () => {
    const text = `
15:15 Newmarket
1st Sportingsilvermine (IRE) 12/1
2nd Paddy The Squire 8/1
3rd Night Breeze (IRE) 12/1
4th Ammes (IRE) 16/1
`;
    expect(parseRaceResultText(text)).toEqual({
      first: "Sportingsilvermine",
      second: "Paddy The Squire",
      third: "Night Breeze",
      fourth: "Ammes",
    });
  });

  it("parses OCR with position on its own line", () => {
    const text = `
1st
Alondra
2nd
Eternal Sunshine
3rd
Space Bear
`;
    expect(parseRaceResultText(text)).toEqual({
      first: "Alondra",
      second: "Eternal Sunshine",
      third: "Space Bear",
      fourth: "",
    });
  });

  it("parses Sporting Life Full Result cloth-number order", () => {
    const text = `
Full Result Future Form
Position DistBtn Horse SP Age / Wt OR Jockey / Trainer
6. DORNEY LAKE (9)
wore hood to post, midfield, progress 2f out
8. BAYRAAT (4)
prominent, ridden 2f out, went second
3. SPIRIT OF APPLAUSE (5)
midfield, pushed along 2f out
2. DICKO THE LEGEND (IRE) (6)
wore hood to post, awkward start
`;
    expect(parseRaceResultText(text)).toEqual({
      first: "Dorney Lake",
      second: "Bayraat",
      third: "Spirit Of Applause",
      fourth: "Dicko The Legend",
    });
  });

  it("parses messy OCR from Sporting Life table", () => {
    const text = `
Full Result Future Form
6. DORNEY LAKE (9) @ nn s108t
8.BAYRAAT (4) © an JFay
3. SPIRIT OF APPLAUSE (5)
2 DICKOTHELEGEND (re) (6)
4. HURT YOU NEVER (re) (7)
`;
    const parsed = parseRaceResultText(text);
    expect(parsed?.first).toBe("Dorney Lake");
    expect(parsed?.second).toBe("Bayraat");
    expect(parsed?.third).toBe("Spirit Of Applause");
    expect(parsed?.fourth).toBe("Dickothelegend");
  });

  it("cleans horse names", () => {
    expect(cleanHorseName("12 (5) Sportingsilvermine (IRE)")).toBe("Sportingsilvermine");
    expect(cleanHorseName("DORNEY LAKE (9)")).toBe("Dorney Lake");
  });
});
