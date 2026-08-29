import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CALCULATOR_SECTIONS, calculatorCardHrefs } from "./catalog";

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function pageFileForHref(href: string): string {
  const route = href.replace(/^\//, "");
  return path.join(APP_DIR, route, "page.tsx");
}

describe("calculator catalog", () => {
  it("lists unique hrefs", () => {
    const hrefs = calculatorCardHrefs();
    expect(hrefs.length).toBeGreaterThan(0);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("every card href has a page.tsx", () => {
    for (const href of calculatorCardHrefs()) {
      expect(existsSync(pageFileForHref(href)), href).toBe(true);
    }
  });

  it("keeps section titles filled in", () => {
    for (const section of CALCULATOR_SECTIONS) {
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.calculators.length).toBeGreaterThan(0);
    }
  });

  it("gives each calculator a unique icon", () => {
    const icons = CALCULATOR_SECTIONS.flatMap((section) =>
      section.calculators.map((calc) => calc.icon)
    );
    expect(icons.every(Boolean)).toBe(true);
    expect(new Set(icons).size).toBe(icons.length);
  });
});
