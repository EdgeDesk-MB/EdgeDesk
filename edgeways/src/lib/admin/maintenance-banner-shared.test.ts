import { describe, expect, it } from "vitest";
import {
  DEFAULT_BANNER,
  DEFAULT_BANNER_LINK_LABEL,
  bannerLinkText,
  isExternalBannerHref,
  isInvalidBannerHrefInput,
  isSiteBannerKind,
  normalizeBannerHref,
  normalizeMaintenanceBanner,
  parseMaintenanceBanner,
  siteBannerPlateClass,
} from "./maintenance-banner-shared";

describe("parseMaintenanceBanner", () => {
  it("returns defaults for empty or junk JSON", () => {
    expect(parseMaintenanceBanner(null)).toEqual(DEFAULT_BANNER);
    expect(parseMaintenanceBanner("not-json").kind).toBe("maintenance");
    expect(parseMaintenanceBanner("not-json").href).toBeNull();
  });

  it("keeps a stored maintenance banner without kind or link", () => {
    const parsed = parseMaintenanceBanner(
      JSON.stringify({ enabled: true, message: "Back soon." })
    );
    expect(parsed).toEqual({
      enabled: true,
      message: "Back soon.",
      kind: "maintenance",
      href: null,
      linkLabel: null,
    });
  });

  it("reads kind, href and link label", () => {
    const parsed = parseMaintenanceBanner(
      JSON.stringify({
        enabled: true,
        message: "New Sky Bet reload.",
        kind: "offer",
        href: "/offers",
        linkLabel: "View offer",
      })
    );
    expect(parsed.kind).toBe("offer");
    expect(parsed.href).toBe("/offers");
    expect(parsed.linkLabel).toBe("View offer");
  });

  it("drops unknown kinds and unsafe hrefs", () => {
    const parsed = parseMaintenanceBanner(
      JSON.stringify({
        enabled: true,
        message: "Hello",
        kind: "rainbow",
        href: "javascript:alert(1)",
        linkLabel: "  Click  ",
      })
    );
    expect(parsed.kind).toBe("maintenance");
    expect(parsed.href).toBeNull();
    expect(parsed.linkLabel).toBe("Click");
  });

  it("reads a stored info kind as notice", () => {
    const parsed = parseMaintenanceBanner(
      JSON.stringify({ enabled: true, message: "Heads up.", kind: "info" })
    );
    expect(parsed.kind).toBe("notice");
  });
});

describe("normalizeBannerHref", () => {
  it("returns null for empty input", () => {
    expect(normalizeBannerHref(null)).toBeNull();
    expect(normalizeBannerHref("   ")).toBeNull();
  });

  it("keeps in-app paths", () => {
    expect(normalizeBannerHref("/offers")).toBe("/offers");
    expect(normalizeBannerHref("/help/guides")).toBe("/help/guides");
  });

  it("rejects protocol-relative and spaced paths", () => {
    expect(normalizeBannerHref("//evil.example")).toBeNull();
    expect(normalizeBannerHref("/foo bar")).toBeNull();
    expect(normalizeBannerHref("/foo\\bar")).toBeNull();
  });

  it("accepts http(s) and bare hosts", () => {
    expect(normalizeBannerHref("https://status.edgeways.app")).toBe(
      "https://status.edgeways.app/"
    );
    expect(normalizeBannerHref("www.skybet.com/promo")).toBe(
      "https://www.skybet.com/promo"
    );
  });

  it("rejects non-http schemes", () => {
    expect(normalizeBannerHref("javascript:alert(1)")).toBeNull();
    expect(normalizeBannerHref("ftp://example.com")).toBeNull();
  });
});

describe("isInvalidBannerHrefInput", () => {
  it("is false when blank", () => {
    expect(isInvalidBannerHrefInput("")).toBe(false);
  });

  it("is true when non-empty but unusable", () => {
    expect(isInvalidBannerHrefInput("javascript:x")).toBe(true);
  });
});

describe("normalizeMaintenanceBanner", () => {
  it("fills the default message for the chosen kind when the field is blank", () => {
    expect(normalizeMaintenanceBanner({ enabled: true, message: "  " }).message).toBe(
      DEFAULT_BANNER.message
    );
    expect(
      normalizeMaintenanceBanner({ enabled: true, message: "", kind: "offer" }).message
    ).toBe("A new offer is live on the desk.");
  });
});

describe("banner helpers", () => {
  it("labels a blank link More", () => {
    expect(bannerLinkText(null)).toBe(DEFAULT_BANNER_LINK_LABEL);
    expect(bannerLinkText("  ")).toBe(DEFAULT_BANNER_LINK_LABEL);
  });

  it("treats http(s) as external", () => {
    expect(isExternalBannerHref("https://example.com")).toBe(true);
    expect(isExternalBannerHref("/offers")).toBe(false);
  });

  it("maps kinds to token plates", () => {
    expect(isSiteBannerKind("notice")).toBe(true);
    expect(isSiteBannerKind("info")).toBe(false);
    expect(isSiteBannerKind("rainbow")).toBe(false);
    expect(siteBannerPlateClass("maintenance")).toContain("text-warning-foreground");
    expect(siteBannerPlateClass("notice")).toContain("bg-foreground");
    expect(siteBannerPlateClass("offer")).toContain("bg-edge");
  });
});
