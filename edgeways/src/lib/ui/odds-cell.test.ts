import { describe, expect, it } from "vitest";
import { darken, lighten } from "@/lib/brands/exchanges";
import { oddsCellClass, oddsCellStyle } from "./odds-cell";

describe("oddsCellStyle", () => {
  it("returns undefined when the hex is missing", () => {
    expect(oddsCellStyle()).toBeUndefined();
    expect(oddsCellStyle("")).toBeUndefined();
  });

  it("uses the 0.72 lighten/darken recipe", () => {
    expect(oddsCellStyle("#a6d8ff")).toEqual({
      "--odds-cell": lighten("#a6d8ff", 0.72),
      "--odds-cell-dark": darken("#a6d8ff", 0.72),
    });
  });
});

describe("oddsCellClass", () => {
  it("binds the shared plate variables", () => {
    expect(oddsCellClass).toContain("bg-[var(--odds-cell)]");
    expect(oddsCellClass).toContain("dark:bg-[var(--odds-cell-dark)]");
  });
});
