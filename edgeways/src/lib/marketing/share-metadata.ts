/**
 * Public share tags (Slack, iMessage, X, LinkedIn).
 * Title is the offer; description adds what the title does not say.
 * Brand name stays on og:site_name, not duplicated in the title.
 */
import type { Metadata } from "next";
import {
  PUBLIC_PLANS,
  TRIAL_DAYS,
  monthlyLabel,
} from "@/lib/billing/public-offer";
import { HERO_SHARE_LINE } from "@/lib/marketing/landing-faq";
import type { LandingVariant } from "@/lib/site-surface";

/** Apex is canonical; www redirects here. Do not use the Vercel *.vercel.app host. */
export const PUBLIC_SITE_ORIGIN = "https://edgeways.app";
export const SHARE_SITE_NAME = "Edgeways";
export const SHARE_LOCALE = "en_GB";
export const SHARE_IMAGE_PATH = "/og";

export const SHARE_IMAGE_ALT =
  "Edgeways desk: know what's next, see what paid, with today's Do Next qualifier";

export type ShareCopy = {
  title: string;
  description: string;
  eyebrow: string;
  imageLine: string;
};

export function publicSiteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || PUBLIC_SITE_ORIGIN;
  try {
    return new URL(raw);
  } catch {
    return new URL(PUBLIC_SITE_ORIGIN);
  }
}

export function marketingShareCopy(variant: LandingVariant): ShareCopy {
  if (variant === "launch") {
    const core = PUBLIC_PLANS.find((plan) => plan.id === "core");
    const edge = PUBLIC_PLANS.find((plan) => plan.id === "edge");
    const coreMo = core ? monthlyLabel(core) : "£9.99/mo";
    const edgeMo = edge ? monthlyLabel(edge) : "£24.99/mo";
    return {
      title: "Start free: matched betting without the faff",
      description: `One desk for what to do next, clean execution, and what you kept. Free, Core ${coreMo}, Edge ${edgeMo}. ${TRIAL_DAYS}-day Edge trial.`,
      eyebrow: `${TRIAL_DAYS}-day Edge trial`,
      imageLine: HERO_SHARE_LINE,
    };
  }

  return {
    title: "Join the waitlist: matched betting without the faff",
    description:
      "One desk for what to do next, clean execution, and what you kept. Early access for UK matched bettors.",
    eyebrow: "Waitlist open",
    imageLine: HERO_SHARE_LINE,
  };
}

export function shareImageUrl(): string {
  return `${PUBLIC_SITE_ORIGIN}${SHARE_IMAGE_PATH}`;
}

export function marketingShareMetadata(variant: LandingVariant): Metadata {
  const copy = marketingShareCopy(variant);
  const image = {
    url: shareImageUrl(),
    width: 2400,
    height: 1260,
    alt: SHARE_IMAGE_ALT,
    type: "image/png",
  };
  return {
    title: {
      absolute: `${copy.title} · ${SHARE_SITE_NAME}`,
    },
    description: copy.description,
    openGraph: {
      title: copy.title,
      description: copy.description,
      type: "website",
      siteName: SHARE_SITE_NAME,
      locale: SHARE_LOCALE,
      url: `${PUBLIC_SITE_ORIGIN}/`,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.description,
      images: [image],
    },
  };
}
