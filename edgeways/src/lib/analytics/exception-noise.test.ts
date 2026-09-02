import { describe, expect, it } from "vitest";
import {
  isNoisyClientException,
  shouldDropPosthogException,
} from "@/lib/analytics/exception-noise";

describe("isNoisyClientException", () => {
  it("drops ResizeObserver loop errors", () => {
    expect(
      isNoisyClientException("ResizeObserver loop completed with undelivered notifications.")
    ).toBe(true);
  });

  it("drops Firefox extension frames", () => {
    expect(
      isNoisyClientException("undefined is not an object (evaluating 'window.__firefox__.reader')")
    ).toBe(true);
    expect(isNoisyClientException("Can't find variable: __firefox__")).toBe(true);
  });

  it("keeps real app exceptions", () => {
    expect(
      isNoisyClientException("Minified React error #418; visit https://react.dev/errors/418")
    ).toBe(false);
    expect(isNoisyClientException("Export quietFreeBetAlerts doesn't exist")).toBe(false);
  });
});

describe("shouldDropPosthogException", () => {
  it("only filters $exception events", () => {
    expect(
      shouldDropPosthogException({
        event: "$pageview",
        properties: { $exception_values: ["ResizeObserver loop"] },
      })
    ).toBe(false);
  });

  it("reads $exception_values", () => {
    expect(
      shouldDropPosthogException({
        event: "$exception",
        properties: {
          $exception_values: ["ResizeObserver loop completed with undelivered notifications."],
        },
      })
    ).toBe(true);
  });
});
