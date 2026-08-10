import { describe, expect, it } from "vitest";
import { canUseAccaDesk } from "./acca-desk";

describe("canUseAccaDesk", () => {
  it("defaults to unlocked when settings omit planPreview", () => {
    expect(canUseAccaDesk(null)).toBe(true);
    expect(canUseAccaDesk({})).toBe(true);
    expect(canUseAccaDesk({ planPreview: "unlocked" })).toBe(true);
  });

  it("allows Core and Edge preview", () => {
    expect(canUseAccaDesk({ planPreview: "core" })).toBe(true);
    expect(canUseAccaDesk({ planPreview: "edge" })).toBe(true);
  });

  it("denies Free preview", () => {
    expect(canUseAccaDesk({ planPreview: "free" })).toBe(false);
  });
});
