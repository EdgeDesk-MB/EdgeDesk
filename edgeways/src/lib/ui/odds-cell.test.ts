import { describe, expect, it } from "vitest";
import { muteForDark } from "@/lib/brands/exchanges";
import { oddsCellClass, oddsCellStyle } from "./odds-cell";

describe("oddsCellStyle", () => {
  it("returns undefined when the hex is missing", () => {
    expect(oddsCellStyle()).toBeUndefined();
    expect(oddsCellStyle("")).toBeUndefined();
  });

  it("uses the light hex as-is and mutes it for dark", () => {
    expect(oddsCellStyle("#A7D8FF")).toEqual({
      "--odds-cell": "#A7D8FF",
      "--odds-cell-dark": muteForDark("#A7D8FF"),
    });
  });
});

describe("oddsCellClass", () => {
  it("binds the shared plate variables", () => {
    expect(oddsCellClass).toContain("bg-[var(--odds-cell)]");
    expect(oddsCellClass).toContain("dark:bg-[var(--odds-cell-dark)]");
  });
});
