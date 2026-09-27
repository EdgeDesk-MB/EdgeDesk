import { describe, expect, it } from "vitest";
import {
  CHUNK_RELOAD_COOLDOWN_MS,
  CHUNK_RELOAD_KEY,
  UPDATE_RELOAD_COOLDOWN_MS,
  UPDATE_RELOAD_KEY,
  claimReloadGuard,
  isChunkLoadError,
  isNextChunkAssetUrl,
  quietReloadLinkTarget,
  reloadGuardOpen,
  type ReloadGuardStore,
} from "./quiet-reload";

function memoryStore(): ReloadGuardStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const MIN = 60_000;

describe("claimReloadGuard", () => {
  it("allows one update reload per 10 minutes", () => {
    const store = memoryStore();
    const t0 = 1_000_000;
    expect(claimReloadGuard(store, UPDATE_RELOAD_KEY, UPDATE_RELOAD_COOLDOWN_MS, t0)).toBe(true);
    // Second deploy two minutes later: still cooling down.
    expect(
      claimReloadGuard(store, UPDATE_RELOAD_KEY, UPDATE_RELOAD_COOLDOWN_MS, t0 + 2 * MIN)
    ).toBe(false);
    expect(
      claimReloadGuard(store, UPDATE_RELOAD_KEY, UPDATE_RELOAD_COOLDOWN_MS, t0 + 10 * MIN - 1)
    ).toBe(false);
    expect(
      claimReloadGuard(store, UPDATE_RELOAD_KEY, UPDATE_RELOAD_COOLDOWN_MS, t0 + 10 * MIN)
    ).toBe(true);
  });

  it("allows one chunk reload per 5 minutes, so a broken chunk cannot loop", () => {
    const store = memoryStore();
    const t0 = 5_000_000;
    expect(claimReloadGuard(store, CHUNK_RELOAD_KEY, CHUNK_RELOAD_COOLDOWN_MS, t0)).toBe(true);
    expect(claimReloadGuard(store, CHUNK_RELOAD_KEY, CHUNK_RELOAD_COOLDOWN_MS, t0 + 1)).toBe(false);
    expect(
      claimReloadGuard(store, CHUNK_RELOAD_KEY, CHUNK_RELOAD_COOLDOWN_MS, t0 + 5 * MIN)
    ).toBe(true);
  });

  it("keeps update and chunk slots separate", () => {
    const store = memoryStore();
    expect(claimReloadGuard(store, CHUNK_RELOAD_KEY, CHUNK_RELOAD_COOLDOWN_MS, 10)).toBe(true);
    expect(claimReloadGuard(store, UPDATE_RELOAD_KEY, UPDATE_RELOAD_COOLDOWN_MS, 11)).toBe(true);
  });

  it("never reloads without somewhere to store the guard", () => {
    expect(claimReloadGuard(null, CHUNK_RELOAD_KEY, CHUNK_RELOAD_COOLDOWN_MS, 1)).toBe(false);
    const throwing: ReloadGuardStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(claimReloadGuard(throwing, CHUNK_RELOAD_KEY, CHUNK_RELOAD_COOLDOWN_MS, 1)).toBe(false);
    const dropping: ReloadGuardStore = { getItem: () => null, setItem: () => {} };
    expect(claimReloadGuard(dropping, CHUNK_RELOAD_KEY, CHUNK_RELOAD_COOLDOWN_MS, 1)).toBe(false);
  });

  it("treats a junk stamp as open", () => {
    const store = memoryStore();
    store.setItem(UPDATE_RELOAD_KEY, "nope");
    expect(reloadGuardOpen(store, UPDATE_RELOAD_KEY, UPDATE_RELOAD_COOLDOWN_MS, 1)).toBe(true);
  });
});

describe("isChunkLoadError", () => {
  it("matches webpack, Turbopack and native import failures", () => {
    const named = new Error("Loading chunk 123 failed.");
    named.name = "ChunkLoadError";
    expect(isChunkLoadError(named)).toBe(true);
    expect(isChunkLoadError(new Error("Loading CSS chunk app-layout failed."))).toBe(true);
    expect(
      isChunkLoadError(new Error("Failed to load chunk /_next/static/chunks/abc.js from module 1"))
    ).toBe(true);
    expect(
      isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: /x.js"))
    ).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError("Uncaught ChunkLoadError: Loading chunk 9 failed.")).toBe(true);
  });

  it("ignores ordinary errors", () => {
    expect(isChunkLoadError(new Error("Network request failed"))).toBe(false);
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(42)).toBe(false);
  });
});

describe("isNextChunkAssetUrl", () => {
  it("matches Next static JS and CSS chunks only", () => {
    expect(isNextChunkAssetUrl("https://app.test/_next/static/chunks/app/page-1.js")).toBe(true);
    expect(isNextChunkAssetUrl("/_next/static/css/abc.css")).toBe(true);
    expect(isNextChunkAssetUrl("/_next/image?url=x")).toBe(false);
    expect(isNextChunkAssetUrl("https://cdn.test/widget.js")).toBe(false);
    expect(isNextChunkAssetUrl(null)).toBe(false);
  });
});

describe("quietReloadLinkTarget", () => {
  const here = "https://app.test/desk?tab=today";

  it("hard-navigates same-origin links to another page", () => {
    expect(quietReloadLinkTarget({ href: "/history" }, here)).toBe(
      "https://app.test/history"
    );
    expect(quietReloadLinkTarget({ href: "https://app.test/offers?x=1" }, here)).toBe(
      "https://app.test/offers?x=1"
    );
  });

  it("leaves same-page, external, new-tab and download links to the browser", () => {
    expect(quietReloadLinkTarget({ href: "/desk?tab=week" }, here)).toBeNull();
    expect(quietReloadLinkTarget({ href: "#top" }, here)).toBeNull();
    expect(quietReloadLinkTarget({ href: "https://other.test/history" }, here)).toBeNull();
    expect(quietReloadLinkTarget({ href: "/history", target: "_blank" }, here)).toBeNull();
    expect(quietReloadLinkTarget({ href: "/export.csv", download: true }, here)).toBeNull();
    expect(quietReloadLinkTarget({ href: "mailto:hi@app.test" }, here)).toBeNull();
  });

  it("allows an explicit same-tab target", () => {
    expect(quietReloadLinkTarget({ href: "/history", target: "_self" }, here)).toBe(
      "https://app.test/history"
    );
  });
});
