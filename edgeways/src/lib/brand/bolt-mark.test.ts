import { afterEach, describe, expect, it } from "vitest";
import {
  accentFaviconDataUrl,
  buildAccentFaviconSvg,
  setAccentFavicon,
} from "@/lib/brand/bolt-mark";

describe("buildAccentFaviconSvg", () => {
  it("paints the Amber plate and ink bolt by default", () => {
    const svg = buildAccentFaviconSvg("#FFC71E");
    expect(svg).toContain('fill="#FFC71E"');
    expect(svg).toContain('fill="#111111"');
    expect(svg).toContain("<path ");
  });

  it("flips the bolt to white on a dark plate", () => {
    const svg = buildAccentFaviconSvg("#2BB673");
    expect(svg).toContain('fill="#2BB673"');
    expect(svg).toContain('fill="#FFFFFF"');
  });

  it("builds a data URL for live favicon swaps", () => {
    const href = accentFaviconDataUrl("#3B82F6");
    expect(href.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(href)).toContain("#3B82F6");
  });
});

describe("setAccentFavicon", () => {
  const originalDocument = globalThis.document;

  afterEach(() => {
    if (originalDocument === undefined) {
      // @ts-expect-error restore missing document in node
      delete globalThis.document;
    } else {
      globalThis.document = originalDocument;
    }
  });

  it("does not detach Next/React HostHoistable icon links", () => {
    const headChildren: Array<{
      rel: string;
      type?: string;
      href: string;
      attrs: Record<string, string>;
      hasAttribute: (name: string) => boolean;
      setAttribute: (name: string, value: string) => void;
      remove: () => void;
    }> = [];

    const nextIcon = {
      rel: "icon",
      href: "/icon?abc",
      attrs: {} as Record<string, string>,
      hasAttribute(name: string) {
        return name in this.attrs;
      },
      setAttribute(name: string, value: string) {
        this.attrs[name] = value;
      },
      remove() {
        throw new Error("must not remove React-managed favicon links");
      },
    };
    headChildren.push(nextIcon);

    // Minimal document stub for the favicon swap path.
    // @ts-expect-error test stub
    globalThis.document = {
      head: {
        appendChild(node: (typeof headChildren)[number]) {
          headChildren.push(node);
          return node;
        },
      },
      querySelector(selector: string) {
        if (selector === 'link[data-edgeways-brand-favicon]') {
          return (
            headChildren.find((el) => el.hasAttribute("data-edgeways-brand-favicon")) ??
            null
          );
        }
        return null;
      },
      querySelectorAll(selector: string) {
        if (selector === 'link[rel="icon"]') {
          return headChildren.filter((el) => el.rel === "icon") as unknown as NodeListOf<HTMLLinkElement>;
        }
        return [] as unknown as NodeListOf<Element>;
      },
      createElement(tag: string) {
        if (tag !== "link") throw new Error(`unexpected tag ${tag}`);
        return {
          rel: "",
          type: "",
          href: "",
          attrs: {} as Record<string, string>,
          hasAttribute(name: string) {
            return name in this.attrs;
          },
          setAttribute(name: string, value: string) {
            this.attrs[name] = value;
          },
          remove() {
            throw new Error("brand favicon link should not self-remove");
          },
        };
      },
    };

    expect(() => setAccentFavicon("#3B82F6")).not.toThrow();
    expect(headChildren).toHaveLength(2);
    expect(nextIcon.href).toBe("/icon?abc");
    const brand = headChildren[1]!;
    expect(brand.hasAttribute("data-edgeways-brand-favicon")).toBe(true);
    expect(brand.href.startsWith("data:image/svg+xml")).toBe(true);
  });
});
