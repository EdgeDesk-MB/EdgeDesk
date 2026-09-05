import { describe, expect, it } from "vitest";
import { combineShareParams } from "./share-intake";

describe("combineShareParams", () => {
  it("joins title, text and url with blank lines", () => {
    expect(
      combineShareParams({
        title: "Your £10 free bet",
        text: "Place a £10 bet on football",
        url: "https://www.skybet.com/promo",
      })
    ).toBe(
      "Your £10 free bet\n\nPlace a £10 bet on football\n\nhttps://www.skybet.com/promo"
    );
  });

  it("drops the url when the text already carries it (Chrome link shares)", () => {
    expect(
      combineShareParams({
        title: "Promo",
        text: "Bet £10 get £30 https://www.skybet.com/promo",
        url: "https://www.skybet.com/promo",
      })
    ).toBe("Promo\n\nBet £10 get £30 https://www.skybet.com/promo");
  });

  it("drops a title that just repeats the text", () => {
    expect(
      combineShareParams({ title: "Same words", text: "Same words" })
    ).toBe("Same words");
  });

  it("keeps a Safari-style url-only share", () => {
    expect(
      combineShareParams({ url: "https://www.skybet.com/promo" })
    ).toBe("https://www.skybet.com/promo");
  });

  it("returns empty when nothing usable arrived", () => {
    expect(combineShareParams({})).toBe("");
    expect(combineShareParams({ title: "  ", text: null })).toBe("");
  });
});
