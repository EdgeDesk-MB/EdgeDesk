import { describe, expect, it } from "vitest";
import { betLogTypeCaption } from "./bet-log-title";

describe("betLogTypeCaption", () => {
  it("omits Dutch when the title already starts with Dutch ·", () => {
    expect(betLogTypeCaption("Dutch · Home / Draw / Away", "dutch")).toBeNull();
  });

  it("omits Dutch when the title is 2UP dutch: …", () => {
    expect(betLogTypeCaption("2UP dutch: Arsenal / Chelsea", "dutch")).toBeNull();
  });

  it("keeps Dutch when the title is only the outcomes", () => {
    expect(betLogTypeCaption("Home / Draw / Away", "dutch")).toBe("Dutch");
  });

  it("keeps Qualifying when the title does not name the type", () => {
    expect(betLogTypeCaption("Bet365 £10 free bet", "qualifying")).toBe("Qualifying");
  });

  it("omits when the title is exactly the type label", () => {
    expect(betLogTypeCaption("Dutch", "dutch")).toBeNull();
  });
});
