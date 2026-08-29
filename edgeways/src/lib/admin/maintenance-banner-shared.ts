import { normalizeOfferUrl } from "@/lib/offers/offer-url";
import {
  siteBannerPlate,
  siteBannerSwatch,
  type SiteBannerPlateKind,
} from "@/lib/ui/surface-styles";

/** Keep the banner to one readable line on every surface. */
export const MAX_BANNER_MESSAGE_LENGTH = 280;
export const MAX_BANNER_HREF_LENGTH = 500;
export const MAX_BANNER_LINK_LABEL_LENGTH = 40;
export const DEFAULT_BANNER_LINK_LABEL = "More";

export const SITE_BANNER_KINDS = [
  "maintenance",
  "notice",
  "offer",
] as const satisfies readonly SiteBannerPlateKind[];
export type SiteBannerKind = SiteBannerPlateKind;

export type MaintenanceBanner = {
  enabled: boolean;
  message: string;
  kind: SiteBannerKind;
  href: string | null;
  linkLabel: string | null;
};

export const DEFAULT_BANNER_MESSAGE: Record<SiteBannerKind, string> = {
  maintenance: "Edgeways is under maintenance. The desk will be back shortly.",
  notice: "A short notice from Edgeways.",
  offer: "A new offer is live on the desk.",
};

export const DEFAULT_BANNER: MaintenanceBanner = {
  enabled: false,
  message: DEFAULT_BANNER_MESSAGE.maintenance,
  kind: "maintenance",
  href: null,
  linkLabel: null,
};

export const SITE_BANNER_KIND_LABEL: Record<SiteBannerKind, string> = {
  maintenance: "Maintenance",
  notice: "Notice",
  offer: "Offer",
};

export const SITE_BANNER_KIND_HINT: Record<SiteBannerKind, string> = {
  maintenance: "Downtime and disruption",
  notice: "Informative, not an outage",
  offer: "Offer or promo related",
};

export function siteBannerPlateClass(kind: SiteBannerKind): string {
  return siteBannerPlate(kind);
}

export function siteBannerSwatchClass(kind: SiteBannerKind): string {
  return siteBannerSwatch(kind);
}

export function isSiteBannerKind(value: unknown): value is SiteBannerKind {
  return (
    typeof value === "string" &&
    (SITE_BANNER_KINDS as readonly string[]).includes(value)
  );
}

/** First cut stored Notice as `info`. Read it as `notice`. */
function readSiteBannerKind(value: unknown): SiteBannerKind {
  if (value === "info") return "notice";
  return isSiteBannerKind(value) ? value : DEFAULT_BANNER.kind;
}

/**
 * http(s) URLs, or an in-app path starting with `/`.
 * Empty → null. Rejects javascript:, protocol-relative, and junk.
 */
export function normalizeBannerHref(
  raw: string | null | undefined
): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  if (trimmed.length > MAX_BANNER_HREF_LENGTH) return null;
  if (trimmed.startsWith("//")) return null;
  if (trimmed.startsWith("/")) {
    if (trimmed.includes("\\") || /\s/.test(trimmed)) return null;
    return trimmed;
  }
  return normalizeOfferUrl(trimmed);
}

export function isInvalidBannerHrefInput(
  raw: string | null | undefined
): boolean {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return false;
  return normalizeBannerHref(trimmed) == null;
}

export function isExternalBannerHref(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

export function normalizeBannerLinkLabel(
  raw: string | null | undefined
): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_BANNER_LINK_LABEL_LENGTH);
}

export function bannerLinkText(linkLabel: string | null): string {
  return linkLabel?.trim() || DEFAULT_BANNER_LINK_LABEL;
}

export function normalizeMaintenanceBanner(
  input: Partial<MaintenanceBanner> | null | undefined
): MaintenanceBanner {
  const kind = readSiteBannerKind(input?.kind);
  const trimmed =
    typeof input?.message === "string" ? input.message.trim() : "";
  return {
    enabled: Boolean(input?.enabled),
    message: (trimmed || DEFAULT_BANNER_MESSAGE[kind]).slice(
      0,
      MAX_BANNER_MESSAGE_LENGTH
    ),
    kind,
    href: normalizeBannerHref(
      typeof input?.href === "string" ? input.href : null
    ),
    linkLabel: normalizeBannerLinkLabel(input?.linkLabel),
  };
}

export function parseMaintenanceBanner(
  raw: string | null | undefined
): MaintenanceBanner {
  if (!raw) return { ...DEFAULT_BANNER };
  try {
    const parsed = JSON.parse(raw) as Partial<MaintenanceBanner>;
    return normalizeMaintenanceBanner(parsed);
  } catch {
    return { ...DEFAULT_BANNER };
  }
}
