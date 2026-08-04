import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_TIME_FORMAT,
  formatClockString,
  formatClockTime,
  getDisplayTimeFormat,
  normalizeTimeFormat,
  setDisplayTimeFormat,
} from "./time-format";

afterEach(() => setDisplayTimeFormat(DEFAULT_TIME_FORMAT));

describe("normalizeTimeFormat", () => {
  it("defaults to 24h for anything except 12h", () => {
    expect(normalizeTimeFormat("12h")).toBe("12h");
    expect(normalizeTimeFormat("24h")).toBe("24h");
    expect(normalizeTimeFormat("12H")).toBe("24h");
    expect(normalizeTimeFormat("")).toBe("24h");
    expect(normalizeTimeFormat(null)).toBe("24h");
    expect(normalizeTimeFormat(undefined)).toBe("24h");
  });
});

describe("formatClockTime", () => {
  const fivePm = Date.UTC(2026, 0, 15, 17, 30); // winter: UTC == Europe/London

  it("renders 24h by default", () => {
    expect(formatClockTime(fivePm, { timeZone: "UTC" })).toBe("17:30");
  });

  it("renders 12h when the preference is set", () => {
    setDisplayTimeFormat("12h");
    expect(formatClockTime(fivePm, { timeZone: "UTC" })).toBe("5:30 pm");
  });

  it("explicit format overrides the active preference", () => {
    expect(formatClockTime(fivePm, { timeZone: "UTC", format: "12h" })).toBe("5:30 pm");
    setDisplayTimeFormat("12h");
    expect(formatClockTime(fivePm, { timeZone: "UTC", format: "24h" })).toBe("17:30");
  });

  it("respects the timezone option", () => {
    expect(formatClockTime(fivePm, { timeZone: "America/New_York" })).toBe("12:30");
  });

  it("includes seconds when asked", () => {
    const withSecs = Date.UTC(2026, 0, 15, 9, 5, 7);
    expect(formatClockTime(withSecs, { timeZone: "UTC", withSeconds: true })).toBe(
      "09:05:07"
    );
  });
});

describe("formatClockString", () => {
  it("normalises 24h strings and pads hours", () => {
    expect(formatClockString("17:10", "24h")).toBe("17:10");
    expect(formatClockString("9:05", "24h")).toBe("09:05");
  });

  it("converts to 12h with midnight and noon handled", () => {
    expect(formatClockString("17:10", "12h")).toBe("5:10 pm");
    expect(formatClockString("00:15", "12h")).toBe("12:15 am");
    expect(formatClockString("12:00", "12h")).toBe("12:00 pm");
    expect(formatClockString("09:05", "12h")).toBe("9:05 am");
  });

  it("follows the active preference when no format is given", () => {
    setDisplayTimeFormat("12h");
    expect(formatClockString("17:10")).toBe("5:10 pm");
    expect(getDisplayTimeFormat()).toBe("12h");
  });

  it("returns unparseable input unchanged", () => {
    expect(formatClockString("Off", "12h")).toBe("Off");
    expect(formatClockString("25:00", "12h")).toBe("25:00");
    expect(formatClockString("", "12h")).toBe("");
  });
});
