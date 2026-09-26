import { beforeAll, describe, expect, it } from "vitest";
import { GET as enterDemo } from "@/app/demo/route";
import { flatNavLinks } from "@/components/app-nav";
import { twoUpDeskSearch } from "@/lib/twoup/desk-view";
import {
  parsePublicDemoView,
  publicDemoSearchWithView,
  readPublicDemoViewParam,
  withPublicDemoView,
  type PublicDemoView,
} from "./public-demo";

const ORIGIN = "http://localhost:3000";

/** What a reload shows: the provider parses `?view=` from scratch. */
function viewingAfterReload(url: URL): PublicDemoView {
  return parsePublicDemoView(url.searchParams.get("view"));
}

/** Client nav to `href`, then the provider's post-navigation write-back. */
function navigate(href: string, view: PublicDemoView): URL {
  const url = new URL(href, ORIGIN);
  const repaired = publicDemoSearchWithView(url.search, view);
  if (repaired != null) url.search = repaired;
  return url;
}

async function openDemo(search: string): Promise<{ url: URL; view: PublicDemoView }> {
  const res = await enterDemo(new Request(`${ORIGIN}/demo${search}`));
  expect(res.status).toBe(307);
  const url = new URL(res.headers.get("location")!);
  const view = readPublicDemoViewParam(url.searchParams.get("view"));
  expect(view).not.toBeNull();
  return { url, view: view! };
}

function navHref(label: string): string {
  const link = flatNavLinks.find((l) => l.label === label);
  expect(link, label).toBeDefined();
  return link!.href;
}

beforeAll(() => {
  process.env.PUBLIC_DEMO_COOKIE_SECRET ??= "vitest-public-demo";
});

// EDGE-159 manual check: /demo?view=free, Early payout, Tracked, reload.
describe("public demo plan survives navigation into a desk", () => {
  it("keeps Free from /demo through Early payout, Tracked and a reload", async () => {
    const { url: landing, view } = await openDemo("?view=free");
    expect(landing.pathname).toBe("/desk");
    expect(view).toBe("free");

    const earlyPayout = navigate(withPublicDemoView(navHref("Early-payout"), view), view);
    expect(earlyPayout.pathname).toBe("/early-payout");
    expect(earlyPayout.searchParams.get("view")).toBe("free");

    const tracked = new URL(earlyPayout);
    tracked.search = `?${twoUpDeskSearch(earlyPayout.search, { view: "tracked" })}`;
    expect(tracked.searchParams.get("deskView")).toBe("tracked");

    expect(viewingAfterReload(tracked)).toBe("free");
  });

  it("repairs a bare link that dropped the plan (command palette, desk cards)", async () => {
    const { view } = await openDemo("?view=free");
    const landed = navigate("/early-payout", view);
    expect(viewingAfterReload(landed)).toBe("free");
  });

  it.each(["free", "core", "edge"] as const)(
    "every desk entry link carries view=%s",
    async (plan) => {
      const { view } = await openDemo(`?view=${plan}`);
      expect(flatNavLinks.length).toBeGreaterThan(10);
      for (const link of flatNavLinks) {
        const href = withPublicDemoView(link.href, view);
        const url = new URL(href, ORIGIN);
        expect(url.pathname, link.label).toBe(link.href.split("?")[0]);
        expect(viewingAfterReload(url), link.label).toBe(plan);
      }
    }
  );
});

describe("withPublicDemoView", () => {
  it("keeps existing query and hash, and leaves external links alone", () => {
    expect(withPublicDemoView("/tracker?queue=settle", "core")).toBe(
      "/tracker?queue=settle&view=core"
    );
    expect(withPublicDemoView("/help#faq", "free")).toBe("/help?view=free#faq");
    expect(withPublicDemoView("/desk?view=free", "free")).toBe("/desk?view=free");
    expect(withPublicDemoView("https://example.com/x", "free")).toBe(
      "https://example.com/x"
    );
    expect(withPublicDemoView("//example.com/x", "free")).toBe("//example.com/x");
  });

  it("overwrites a foreign view value with the plan", () => {
    expect(withPublicDemoView("/early-payout?view=tracked", "free")).toBe(
      "/early-payout?view=free"
    );
  });
});

describe("readPublicDemoViewParam", () => {
  it("only accepts an explicit plan", () => {
    expect(readPublicDemoViewParam("free")).toBe("free");
    expect(readPublicDemoViewParam("edge")).toBe("edge");
    expect(readPublicDemoViewParam(null)).toBeNull();
    expect(readPublicDemoViewParam("tracked")).toBeNull();
  });
});
