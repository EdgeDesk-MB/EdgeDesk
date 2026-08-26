import { afterEach, describe, expect, it } from "vitest";
import {
  PUBLIC_PLANS,
  TRIAL_DAYS,
  monthlyLabel,
} from "@/lib/billing/public-offer";
import {
  PUBLIC_SITE_ORIGIN,
  SHARE_SITE_NAME,
  canonicalUrl,
  marketingShareCopy,
  marketingShareMetadata,
  publicSiteUrl,
} from "@/lib/marketing/share-metadata";

const TITLE_MAX = 70;
const DESCRIPTION_MAX = 160;

describe("marketingShareCopy", () => {
  it("keeps waitlist title benefit-led and within share limits", () => {
    const copy = marketingShareCopy("waitlist");
    expect(copy.title.startsWith("Join the waitlist:")).toBe(true);
    expect(copy.title.toLowerCase()).not.toContain("edgeways");
    expect(copy.title).toContain("faff");
    expect(copy.title.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(copy.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(copy.description.toLowerCase()).not.toContain("faff");
    expect(copy.imageLine).toBe("One desk for the day. No more faff.");
    expect(copy.description).toContain("UK matched bettors");
    expect(copy.eyebrow).toBe("Waitlist open");
  });

  it("keeps launch copy in sync with the public offer", () => {
    const copy = marketingShareCopy("launch");
    const core = PUBLIC_PLANS.find((plan) => plan.id === "core")!;
    const edge = PUBLIC_PLANS.find((plan) => plan.id === "edge")!;
    expect(copy.title.startsWith("Start free:")).toBe(true);
    expect(copy.title.toLowerCase()).not.toContain("edgeways");
    expect(copy.title.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(copy.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(copy.description).toContain(monthlyLabel(core));
    expect(copy.description).toContain(monthlyLabel(edge));
    expect(copy.description).toContain(`${TRIAL_DAYS}-day Edge trial`);
    expect(copy.eyebrow).toBe(`${TRIAL_DAYS}-day Edge trial`);
  });
});

describe("marketingShareMetadata", () => {
  it("sets Slack/X fields without repeating the brand in the title", () => {
    const meta = marketingShareMetadata("waitlist");
    const copy = marketingShareCopy("waitlist");
    expect(meta.openGraph?.siteName).toBe(SHARE_SITE_NAME);
    expect(meta.openGraph?.locale).toBe("en_GB");
    expect(meta.openGraph?.title).toBe(copy.title);
    expect(meta.openGraph?.description).toBe(copy.description);
    expect(meta.title).toEqual({
      absolute: `${copy.title} · ${SHARE_SITE_NAME}`,
    });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect(meta.twitter?.title).toBe(copy.title);
    expect(meta.openGraph?.url).toBe(`${PUBLIC_SITE_ORIGIN}/`);
    expect(meta.alternates?.canonical).toBe(`${PUBLIC_SITE_ORIGIN}/`);
    expect(canonicalUrl("/terms")).toBe(`${PUBLIC_SITE_ORIGIN}/terms`);
    const ogImages = meta.openGraph?.images;
    const image = Array.isArray(ogImages) ? ogImages[0] : ogImages;
    expect(image).toMatchObject({
      url: `${PUBLIC_SITE_ORIGIN}/og`,
      width: 2400,
      height: 1260,
    });
  });
});

describe("publicSiteUrl", () => {
  const prev = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
    else process.env.NEXT_PUBLIC_SITE_URL = prev;
  });

  it("falls back to the live origin", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(publicSiteUrl().origin).toBe(PUBLIC_SITE_ORIGIN);
  });

  it("honours NEXT_PUBLIC_SITE_URL when valid", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://preview.example";
    expect(publicSiteUrl().origin).toBe("https://preview.example");
  });

  it("strips www from the live host so metadataBase stays on the apex", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.edgeways.app";
    expect(publicSiteUrl().origin).toBe(PUBLIC_SITE_ORIGIN);
  });

  it("ignores the Vercel preview host so production tags stay on the apex", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://edgeways-edgeways.vercel.app";
    expect(publicSiteUrl().origin).toBe(PUBLIC_SITE_ORIGIN);
  });
});
