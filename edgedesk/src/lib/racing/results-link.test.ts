import { describe, expect, it } from "vitest";
import {
  atrCoursePath,
  atrDatePath,
  buildAtrResultsLink,
  buildRacingResultsLinks,
} from "./results-link";
import {
  cleanHorseName,
  extractSpDecimal,
  parseRaceResultText,
  repairOcrRaceResultText,
} from "./parse-race-result-text";

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
    expect(parseRaceResultText(text)).toMatchObject({
      first: "Sportingsilvermine",
      second: "Paddy The Squire",
      third: "Night Breeze",
      fourth: "Ammes",
      spDecimals: { 1: 13, 2: 9, 3: 13, 4: 17 },
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

  it("detects Fav / JFav on the winner from ordinal paste", () => {
    const parsed = parseRaceResultText(
      `1st Alpha Star 6/4 Fav
2nd Bravo Bay
3rd Charlie Chip`
    );
    expect(parsed?.first).toBe("Alpha Star");
    expect(parsed?.winnerIsSpFavourite).toBe(true);
    expect(parsed?.spFavouritePlace).toBe(1);
  });

  it("detects Fav on a placed horse (ATR-style 2nd was SP fav)", () => {
    const parsed = parseRaceResultText(
      `1st Ephron (IRE) 11/1
2nd Mwafaq (IRE) 5/2 Fav
3rd Yaaser (IRE) 6/1
4th Sanafi Zabeel (FR) 3/1 2Fav`
    );
    expect(parsed?.first).toBe("Ephron");
    expect(parsed?.second).toBe("Mwafaq");
    expect(parsed?.spFavouritePlace).toBe(2);
    expect(parsed?.winnerIsSpFavourite).toBeUndefined();
  });

  it("attaches Fav from a following SP line after commentary (OCR table layout)", () => {
    const parsed = parseRaceResultText(
      `1
9. EPHRON (IRE) (5)
handy, ridden over 1f out
11/1
2
4. MWAFAQ (IRE) (4)
handy in second, pushed along 3f out
5/2 Fav
3
3. YAASER (IRE) (8)
6/1
4
6. SANAFI ZABEEL (FR) (9)
3/1 2Fav`
    );
    expect(parsed?.first).toBe("Ephron");
    expect(parsed?.second).toBe("Mwafaq");
    expect(parsed?.spFavouritePlace).toBe(2);
  });

  it("ignores beaten-distance fractions when picking SP (ATR OCR)", () => {
    const parsed = parseRaceResultText(
      `1
9. EPHRON (IRE) (8)
11/1
2
4. MWAFAQ (IRE) (9)
nk
5/2 Fav
3
10. YAASER (IRE) (10)
3/4
20/1
4
6. SANAFI ZABEEL (FR) (3)
4 1/4
3/1 2Fav`
    );
    expect(parsed?.spDecimals).toEqual({
      1: 12,
      2: 3.5,
      3: 21,
      4: 4,
    });
    expect(parsed?.spFavouritePlace).toBe(2);
  });

  it("does not treat bare Dist Btn crumbs as SP", () => {
    expect(extractSpDecimal("3/4")).toBeUndefined();
    expect(extractSpDecimal("1/4")).toBeUndefined();
    expect(extractSpDecimal("4 1/4")).toBeUndefined();
    expect(extractSpDecimal("nk")).toBeUndefined();
    expect(extractSpDecimal("5/2 Fav")).toBe(3.5);
    expect(extractSpDecimal("3/1 2Fav")).toBe(4);
    expect(extractSpDecimal("11/1")).toBe(12);
  });

  it("reads SP glued onto long commentary lines (ATR 1st/3rd)", () => {
    const parsed = parseRaceResultText(
      `1
9. EPHRON (IRE) (8)
dwelt, towards rear, pushed along over 3f out, switched left for headway 2f out, ridden and went fourth 1f out, stayed on well to lead final strides 11/1
2
4. MWAFAQ (IRE) (9)
handy in second, pushed along 3f out
5/2 Fav
3
10. YAASER (IRE) (10)
slowly away, in rear, soon in touch, pushed along and good headway over 1f out, ridden inside final furlong and took third towards line, nearest finish 20/1
4
6. SANAFI ZABEEL (FR) (3)
led, pushed along under 3f out
3/1 2Fav`
    );
    expect(parsed?.spDecimals).toEqual({
      1: 12,
      2: 3.5,
      3: 21,
      4: 4,
    });
    expect(parsed?.spFavouritePlace).toBe(2);
  });

  it("repairs mangled ATR OCR odds (512Fav / 201 / 3n2Fav)", () => {
    expect(repairOcrRaceResultText("512Fav")).toContain("5/2");
    expect(extractSpDecimal("512Fav")).toBe(3.5);
    expect(extractSpDecimal("@ 201 888")).toBe(21);
    expect(extractSpDecimal("3n2Fav")).toBe(4);
    expect(extractSpDecimal("301 2Fav")).toBe(4);
    expect(extractSpDecimal("© nn 3810")).toBe(12);

    const parsed = parseRaceResultText(
      `9. EPHRON (re) (8) © nn 3810
4. MWAFAQ (re) (9) @ 512Fav 497p
10. YAASER (re) (10) @ 201 888
6. SANAFI ZABEEL (FR) (3) @ 3n2Fav 596`
    );
    expect(parsed?.spDecimals).toEqual({
      1: 12,
      2: 3.5,
      3: 21,
      4: 4,
    });
    expect(parsed?.spFavouritePlace).toBe(2);
  });
});
