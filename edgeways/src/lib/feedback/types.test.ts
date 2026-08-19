import { describe, expect, it } from "vitest";
import { formatFeedbackSubject, isFeedbackKind, parseDiagnostics } from "./types";

describe("feedback types", () => {
  it("accepts known kinds only", () => {
    expect(isFeedbackKind("bug")).toBe(true);
    expect(isFeedbackKind("idea")).toBe(true);
    expect(isFeedbackKind("other")).toBe(true);
    expect(isFeedbackKind("contact")).toBe(false);
    expect(isFeedbackKind(1)).toBe(false);
  });

  it("formats a compact subject", () => {
    expect(formatFeedbackSubject("bug", "  Lay stake blank  ")).toBe(
      "[Edgeways] Bug: Lay stake blank"
    );
    const long = "x".repeat(100);
    expect(formatFeedbackSubject("idea", long).length).toBeLessThanOrEqual(
      "[Edgeways] Idea: ".length + 80
    );
  });

  it("parses diagnostics and optional signed-in email", () => {
    expect(
      parseDiagnostics(
        JSON.stringify({
          appVersion: "1.1.0-dev",
          userAgent: "vitest",
          href: "/feedback",
          timezone: "Europe/London",
          signedInEmail: "tester@example.com",
        })
      )
    ).toMatchObject({
      appVersion: "1.1.0-dev",
      signedInEmail: "tester@example.com",
    });
  });
});
