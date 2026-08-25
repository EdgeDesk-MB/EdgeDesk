import { describe, expect, it } from "vitest";
import {
  marketingJsonLd,
  marketingJsonLdScript,
} from "@/lib/marketing/structured-data";
import { POSITIONING_FAQ } from "@/lib/marketing/landing-faq";
import { PUBLIC_PLANS } from "@/lib/billing/public-offer";

describe("marketingJsonLd (EDGE-28)", () => {
  it("emits a graph with site, org, app and FAQ nodes", () => {
    const graph = marketingJsonLd("launch")["@graph"] as Array<{ "@type": string }>;
    expect(graph.map((node) => node["@type"])).toEqual([
      "WebSite",
      "Organization",
      "SoftwareApplication",
      "FAQPage",
    ]);
  });

  it("carries the high-intent search terms in the app description", () => {
    const graph = marketingJsonLd("launch")["@graph"] as Array<{
      "@type": string;
      description?: string;
    }>;
    const app = graph.find((node) => node["@type"] === "SoftwareApplication");
    expect(app?.description).toContain("matched betting tracker");
    expect(app?.description).toContain("spreadsheet");
    expect(app?.description).toContain("EV");
  });

  it("lists every public plan as a GBP offer on the launch surface", () => {
    const graph = marketingJsonLd("launch")["@graph"] as Array<{
      "@type": string;
      offers?: Array<{ name: string; price: string; priceCurrency: string }>;
    }>;
    const app = graph.find((node) => node["@type"] === "SoftwareApplication");
    expect(app?.offers).toHaveLength(PUBLIC_PLANS.length);
    for (const offer of app?.offers ?? []) {
      expect(offer.priceCurrency).toBe("GBP");
      expect(Number(offer.price)).toBeGreaterThanOrEqual(0);
    }
  });

  it("omits offers on the waitlist surface", () => {
    const graph = marketingJsonLd("waitlist")["@graph"] as Array<{
      "@type": string;
      offers?: unknown;
    }>;
    const app = graph.find((node) => node["@type"] === "SoftwareApplication");
    expect(app && "offers" in app).toBe(false);
  });

  it("mirrors the landing FAQ one-to-one", () => {
    const graph = marketingJsonLd("launch")["@graph"] as Array<{
      "@type": string;
      mainEntity?: Array<{ name: string; acceptedAnswer: { text: string } }>;
    }>;
    const faq = graph.find((node) => node["@type"] === "FAQPage");
    expect(faq?.mainEntity).toHaveLength(POSITIONING_FAQ.length);
    expect(faq?.mainEntity?.[0]?.name).toBe(POSITIONING_FAQ[0].q);
    expect(faq?.mainEntity?.[0]?.acceptedAnswer.text).toBe(POSITIONING_FAQ[0].a);
  });

  it("escapes angle brackets so the inline script cannot break out", () => {
    const script = marketingJsonLdScript("launch");
    expect(script).not.toContain("</");
    expect(JSON.parse(script)["@context"]).toBe("https://schema.org");
  });
});
