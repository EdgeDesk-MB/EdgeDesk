import { describe, expect, it } from "vitest";
import {
  buildFeedbackMailto,
  FEEDBACK_TO_EMAIL,
  formatFeedbackBody,
  formatFeedbackSubject,
  isFeedbackKind,
} from "./types";

const sample = {
  kind: "bug" as const,
  summary: "Lay stake blank after OCR",
  details: "Imported a Betfair slip and the lay stake stayed empty.",
  replyEmail: "tester@example.com",
  diagnostics: {
    appVersion: "1.1.0-dev",
    userAgent: "Mozilla/5.0",
    href: "http://localhost:3000/tracker",
    timezone: "Europe/London",
  },
};

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

  it("includes details and diagnostics in the body", () => {
    const body = formatFeedbackBody(sample);
    expect(body).toContain("Kind: Bug");
    expect(body).toContain("Lay stake blank after OCR");
    expect(body).toContain("Imported a Betfair slip");
    expect(body).toContain("App: 1.1.0-dev");
    expect(body).toContain("Reply-to: tester@example.com");
  });

  it("builds a mailto URL to the feedback inbox", () => {
    const href = buildFeedbackMailto(sample);
    expect(href.startsWith(`mailto:${FEEDBACK_TO_EMAIL}?`)).toBe(true);
    expect(href).toContain("subject=");
    expect(href).toContain("body=");
  });
});
