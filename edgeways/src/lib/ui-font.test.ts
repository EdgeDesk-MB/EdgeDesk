import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_UI_FONT,
  isUiFontId,
  normalizeUiFont,
  readStoredUiFont,
  UI_FONT_OPTIONS,
  UI_FONT_STORAGE_KEY,
  writeStoredUiFont,
} from "@/lib/ui-font";

describe("ui-font", () => {
  it("accepts known ids", () => {
    expect(isUiFontId("default")).toBe(true);
    expect(isUiFontId("figtree")).toBe(true);
    expect(isUiFontId("comic-sans")).toBe(false);
    expect(isUiFontId(undefined)).toBe(false);
  });

  it("normalises unknown values to default", () => {
    expect(normalizeUiFont("figtree")).toBe("figtree");
    expect(normalizeUiFont("nope")).toBe(DEFAULT_UI_FONT);
    expect(normalizeUiFont(null)).toBe("default");
  });

  it("exposes Default and Figtree options", () => {
    expect(UI_FONT_OPTIONS.map((o) => o.id)).toEqual(["default", "figtree"]);
  });
});

describe("ui-font storage", () => {
  const store = new Map<string, string>();
  let cookie = "";

  beforeEach(() => {
    store.clear();
    cookie = "";
    const localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    };
    vi.stubGlobal("localStorage", localStorage);
    vi.stubGlobal("window", { localStorage });
    vi.stubGlobal("document", {});
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => cookie,
      set: (value: string) => {
        cookie = value;
      },
    });
  });

  it("clears storage when writing the default face", () => {
    writeStoredUiFont("figtree");
    expect(readStoredUiFont()).toBe("figtree");
    writeStoredUiFont("default");
    expect(store.has(UI_FONT_STORAGE_KEY)).toBe(false);
    expect(cookie).toContain("max-age=0");
  });
});
