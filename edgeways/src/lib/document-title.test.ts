import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetDocumentTitleStateForTests,
  announceAlertDocumentTitle,
  clearAlertDocumentTitles,
  formatDeskDocumentTitle,
  pageLabelFromPathname,
  resolveDocumentTitle,
  setDeskDocumentTitleFromPathname,
} from "@/lib/document-title";

describe("pageLabelFromPathname", () => {
  it("matches longest desk prefixes", () => {
    expect(pageLabelFromPathname("/")).toBe("Home");
    expect(pageLabelFromPathname("/racing")).toBe("Racing Desk");
    expect(pageLabelFromPathname("/offers/calendar")).toBe("Offer calendar");
    expect(pageLabelFromPathname("/calculators/ep-desk")).toBe("2UP Desk");
    expect(pageLabelFromPathname("/calculators/matched")).toBe("Matched betting");
  });
});

describe("formatDeskDocumentTitle", () => {
  it("uses the bare app name on Home", () => {
    expect(formatDeskDocumentTitle("Home")).toBe("Edgeways");
  });

  it("suffixes other desks", () => {
    expect(formatDeskDocumentTitle("Racing Desk")).toBe("Racing Desk · Edgeways");
  });
});

describe("resolveDocumentTitle", () => {
  it("shows the latest push-style alert and a count when stacked", () => {
    expect(
      resolveDocumentTitle({
        baseTitle: "Racing Desk · Edgeways",
        unreadTitles: ["⚡ You just made £4.10 · Bet won"],
      })
    ).toBe("⚡ You just made £4.10 · Bet won");

    expect(
      resolveDocumentTitle({
        baseTitle: "Edgeways",
        unreadTitles: [
          "⚠️ Lay missing · full stake exposed",
          "🔒 2UP · lock £11.29",
        ],
      })
    ).toBe("(2) 🔒 2UP · lock £11.29");
  });
});

describe("announceAlertDocumentTitle", () => {
  let doc: { title: string; hidden: boolean };

  beforeEach(() => {
    __resetDocumentTitleStateForTests();
    doc = { title: "Edgeways", hidden: true };
    vi.stubGlobal("document", doc);
  });

  afterEach(() => {
    __resetDocumentTitleStateForTests();
    vi.unstubAllGlobals();
  });

  it("uses push emoji titles and skips ephemeral feedback", () => {
    setDeskDocumentTitleFromPathname("/tracker");
    announceAlertDocumentTitle({
      key: "result_settled:1",
      title: "You just made £4.10 · Bet won",
    });
    expect(doc.title).toBe("⚡ You just made £4.10 · Bet won");

    announceAlertDocumentTitle({
      key: "ephemeral:1",
      title: "Bet logged",
      delivery: "ephemeral",
    });
    expect(doc.title).toBe("⚡ You just made £4.10 · Bet won");

    clearAlertDocumentTitles();
    expect(doc.title).toBe("Profit Tracker · Edgeways");
  });

  it("keeps semantic emoji titles from alert rules", () => {
    announceAlertDocumentTitle({
      key: "naked_exposure:9",
      title: "⚠️ Lay missing · full stake exposed",
    });
    expect(doc.title).toBe("⚠️ Lay missing · full stake exposed");
  });
});
