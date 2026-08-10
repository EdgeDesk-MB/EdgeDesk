import { describe, expect, it } from "vitest";
import {
  ALERT_TOAST_AGE_FOOTER_MS,
  formatAlertHours,
  formatAlertMinutes,
  formatAlertToastAge,
} from "./toast-age";

describe("formatAlertMinutes", () => {
  it("singularises 1 minute", () => {
    expect(formatAlertMinutes(1)).toBe("1 minute");
    expect(formatAlertMinutes(0.4)).toBe("1 minute");
  });

  it("pluralises other counts", () => {
    expect(formatAlertMinutes(2)).toBe("2 minutes");
    expect(formatAlertMinutes(15)).toBe("15 minutes");
  });
});

describe("formatAlertHours", () => {
  it("singularises 1 hour", () => {
    expect(formatAlertHours(1)).toBe("1 hour");
  });

  it("pluralises other counts", () => {
    expect(formatAlertHours(2)).toBe("2 hours");
  });
});

describe("formatAlertToastAge", () => {
  const raisedAt = 1_000_000;

  it("hides age for the first five minutes", () => {
    expect(formatAlertToastAge(raisedAt, raisedAt + ALERT_TOAST_AGE_FOOTER_MS - 1)).toBeNull();
  });

  it("shows minutes with correct plural after the threshold", () => {
    expect(formatAlertToastAge(raisedAt, raisedAt + ALERT_TOAST_AGE_FOOTER_MS)).toBe(
      "5 minutes ago"
    );
    expect(formatAlertToastAge(raisedAt, raisedAt + 60_000)).toBeNull();
    expect(formatAlertToastAge(raisedAt, raisedAt + 5 * 60_000)).toBe("5 minutes ago");
    expect(formatAlertToastAge(raisedAt, raisedAt + 10 * 60_000)).toBe("10 minutes ago");
  });

  it("switches to hours, then days", () => {
    expect(formatAlertToastAge(raisedAt, raisedAt + 60 * 60_000)).toBe("1 hour ago");
    expect(formatAlertToastAge(raisedAt, raisedAt + 3 * 60 * 60_000)).toBe("3 hours ago");
    expect(formatAlertToastAge(raisedAt, raisedAt + 48 * 60 * 60_000)).toBe("2 days ago");
  });
});
