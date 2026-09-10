import { describe, expect, it } from "vitest";
import {
  SCROLL_BAR_REVEAL_IDLE_MS,
  scrollBarRevealsOnScroll,
} from "./scroll-bar-reveal";

describe("scrollBarRevealsOnScroll", () => {
  it("reveals page, nested, and floating scrollers", () => {
    expect(scrollBarRevealsOnScroll("app-scroll")).toBe(true);
    expect(scrollBarRevealsOnScroll("min-h-0 app-scroll-nested")).toBe(true);
    expect(scrollBarRevealsOnScroll("app-scroll-float overscroll-contain")).toBe(
      true
    );
  });

  it("skips overlay, always-on, and unmarked nodes", () => {
    expect(scrollBarRevealsOnScroll("app-scroll-nested app-scroll-overlay")).toBe(
      false
    );
    expect(scrollBarRevealsOnScroll("app-scroll-always")).toBe(false);
    expect(scrollBarRevealsOnScroll("flex flex-1")).toBe(false);
    expect(scrollBarRevealsOnScroll("")).toBe(false);
  });

  it("hides the thumb after a short idle", () => {
    expect(SCROLL_BAR_REVEAL_IDLE_MS).toBe(700);
  });
});
