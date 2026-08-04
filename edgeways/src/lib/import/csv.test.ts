import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parses plain rows and drops the trailing newline", () => {
    expect(parseCsv("a,b,c\n1,2,3\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted commas, escaped quotes and newlines in fields", () => {
    const text = '"Bet 365, qualifier","said ""go""","line1\nline2"\n';
    expect(parseCsv(text)).toEqual([['Bet 365, qualifier', 'said "go"', "line1\nline2"]]);
  });

  it("tolerates CRLF and skips fully empty rows", () => {
    expect(parseCsv("a,b\r\n1,2\r\n,\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps a final unterminated row", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});
