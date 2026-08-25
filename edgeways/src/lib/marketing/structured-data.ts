/**
 * JSON-LD structured data for the marketing surface (EDGE-28).
 * Carries the high-intent search terms ("matched betting tracker",
 * "spreadsheet", "EV") without touching the approved share copy.
 */
import {
  PUBLIC_PLANS,
} from "@/lib/billing/public-offer";
import { POSITIONING_FAQ } from "@/lib/marketing/landing-faq";
import {
  PUBLIC_SITE_ORIGIN,
  SHARE_SITE_NAME,
  shareImageUrl,
} from "@/lib/marketing/share-metadata";
import type { LandingVariant } from "@/lib/site-surface";

const APP_DESCRIPTION =
  "Edgeways is the matched betting tracker and command centre that replaces the spreadsheet: an offers pipeline, Do Next plan, EV and profit tracking, settle prompts and full P&L history.";

function softwareApplicationJsonLd(variant: LandingVariant) {
  return {
    "@type": "SoftwareApplication",
    "@id": `${PUBLIC_SITE_ORIGIN}/#app`,
    name: SHARE_SITE_NAME,
    url: `${PUBLIC_SITE_ORIGIN}/`,
    description: APP_DESCRIPTION,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    image: shareImageUrl(),
    inLanguage: "en-GB",
    ...(variant === "launch"
      ? {
          offers: PUBLIC_PLANS.map((plan) => ({
            "@type": "Offer",
            name: `${SHARE_SITE_NAME} ${plan.name}`,
            price: (plan.monthlyPence / 100).toFixed(2),
            priceCurrency: "GBP",
            description: plan.blurb,
          })),
        }
      : {}),
  };
}

function faqJsonLd() {
  return {
    "@type": "FAQPage",
    "@id": `${PUBLIC_SITE_ORIGIN}/#faq`,
    mainEntity: POSITIONING_FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

function organizationJsonLd() {
  return {
    "@type": "Organization",
    "@id": `${PUBLIC_SITE_ORIGIN}/#org`,
    name: SHARE_SITE_NAME,
    url: `${PUBLIC_SITE_ORIGIN}/`,
  };
}

function websiteJsonLd() {
  return {
    "@type": "WebSite",
    "@id": `${PUBLIC_SITE_ORIGIN}/#site`,
    name: SHARE_SITE_NAME,
    url: `${PUBLIC_SITE_ORIGIN}/`,
    publisher: { "@id": `${PUBLIC_SITE_ORIGIN}/#org` },
  };
}

export function marketingJsonLd(variant: LandingVariant) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      websiteJsonLd(),
      organizationJsonLd(),
      softwareApplicationJsonLd(variant),
      faqJsonLd(),
    ],
  };
}

/** Safe for inline <script type="application/ld+json">. */
export function marketingJsonLdScript(variant: LandingVariant): string {
  return JSON.stringify(marketingJsonLd(variant)).replace(/</g, "\\u003c");
}
