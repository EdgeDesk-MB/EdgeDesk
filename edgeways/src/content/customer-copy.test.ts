import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HELP_GUIDE_NAV, HELP_GUIDES } from "@/content/help/guides";
import { PAGE_HELP } from "@/content/help/page-help";
import { RELEASE_NOTES } from "@/content/release-notes";
import { ROADMAP_CATEGORIES, ROADMAP_VERSION } from "@/content/roadmap";
import { POSITIONING_FAQ } from "@/lib/marketing/landing-faq";
import { racingSyncToast } from "@/lib/racing/sync-toast";
import { formatExchangeMatchError } from "@/lib/services/exchange/format-exchange-error";

/**
 * D8 + launch hygiene: customer-facing copy must not name data providers,
 * leak operator internals, or ship editorial review notes.
 */
const LEAK =
  /ORF\b|Racing API|API-Football|api-football|The Racing API|budget guard|requests\/day|request budget|Football feed limits|provider keys|README\.md|week-key latch|tidy-up|Editorial, not live|hosted desk yet|\/admin\/feeds|EDGE-\d+|Data & API|RACING_API_|Do I need API keys|operator can raise|polls the app state|desk's heartbeat/i;

function blobsFromHelp(): string[] {
  return HELP_GUIDES.flatMap((guide) => [
    guide.title,
    guide.description,
    ...guide.sections.flatMap((section) => [
      section.heading ?? "",
      ...(section.paragraphs ?? []),
      ...(section.bullets ?? []),
    ]),
  ]);
}

function blobsFromPageHelp(): string[] {
  return Object.values(PAGE_HELP).flatMap((page) => [
    page.title,
    page.summary,
    ...page.bullets,
  ]);
}

function blobsFromRoadmap(): string[] {
  return [
    ROADMAP_VERSION.currentLabel,
    ROADMAP_VERSION.targetLabel,
    ROADMAP_VERSION.targetNote,
    ...ROADMAP_CATEGORIES.flatMap((category) =>
      category.items.flatMap((item) => [item.title, item.description ?? ""])
    ),
  ];
}

function blobsFromReleaseNotes(): string[] {
  return RELEASE_NOTES.flatMap((group) => [
    group.title,
    group.summary,
    ...group.entries.map((entry) => entry.text),
  ]);
}

describe("customer-facing copy does not leak internals", () => {
  it("keeps Help, page help, FAQ, roadmap and release notes clean", () => {
    const blobs = [
      ...blobsFromHelp(),
      ...blobsFromPageHelp(),
      ...POSITIONING_FAQ.flatMap((item) => [item.q, item.a]),
      ...blobsFromRoadmap(),
      ...blobsFromReleaseNotes(),
    ];
    for (const text of blobs) {
      expect(text, text).not.toMatch(LEAK);
    }
  });

  it("puts FAQ next to Getting started in the nav", () => {
    expect(HELP_GUIDE_NAV.map((guide) => guide.slug).slice(0, 2)).toEqual([
      "getting-started",
      "faq",
    ]);
  });

  it("does not ship the Help site-map editorial block", () => {
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../components/help/site-map.tsx"),
      "utf8"
    );
    expect(src).not.toMatch(/Tidy-up observations|Editorial, not live data|OBSERVATIONS/);
    expect(src).not.toMatch(LEAK);
  });

  it("keeps racing result toasts free of provider and plan-tier talk", () => {
    const samples = [
      racingSyncToast({ updated: 2, pending: 0, tier: "basic" }),
      racingSyncToast({ updated: 0, pending: 2, tierBlocked: true, tier: "free" }),
      racingSyncToast({ updated: 0, pending: 1, tier: "basic", historicBlocked: true }),
      racingSyncToast({ updated: 0, pending: 1, tier: "none" }),
    ];
    for (const toast of samples) {
      const blob = `${toast.title} ${toast.description ?? ""}`;
      expect(blob, blob).not.toMatch(LEAK);
      expect(blob, blob).not.toMatch(/credentials|~£28|from API/i);
    }
  });

  it("maps exchange feed faults to generic customer copy", () => {
    expect(
      formatExchangeMatchError(
        `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`
      )
    ).toBe("Exchange feed unavailable");
    expect(formatExchangeMatchError("No matching Betfair market")).toBe(
      "No matching exchange market"
    );
    expect(formatExchangeMatchError("Betfair not configured")).toBe(
      "Exchange feed is not connected"
    );
    expect(
      formatExchangeMatchError("Betdaq API requires partner credentials - use Betfair for now")
    ).toBe("Live prices are not available for this exchange yet");
  });
});
