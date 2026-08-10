import { describe, expect, it } from "vitest";
import {
  createFeedbackReport,
  listFeedbackReports,
  listUntriagedFeedbackReports,
  markFeedbackReportFiled,
} from "./feedback";

describe("feedback service", () => {
  it("creates and lists a report", () => {
    const report = createFeedbackReport({
      kind: "idea",
      summary: "Dark mode for Racing Desk",
      details: "Keep the card plates, just invert the chrome.",
      replyEmail: "sam@example.com",
      diagnostics: {
        appVersion: "1.1.0-dev",
        userAgent: "vitest",
        href: "http://localhost:3000/feedback",
        timezone: "Europe/London",
      },
    });

    expect(report.id).toBeGreaterThan(0);
    expect(report.kind).toBe("idea");
    expect(report.summary).toBe("Dark mode for Racing Desk");
    expect(report.replyEmail).toBe("sam@example.com");
    expect(report.diagnostics.appVersion).toBe("1.1.0-dev");

    const listed = listFeedbackReports(5);
    expect(listed.some((r) => r.id === report.id)).toBe(true);
  });

  it("rejects empty summary", () => {
    expect(() =>
      createFeedbackReport({
        kind: "bug",
        summary: "   ",
        details: "something broke",
        diagnostics: {
          appVersion: "1.1.0-dev",
          userAgent: "vitest",
          href: "/",
          timezone: "UTC",
        },
      })
    ).toThrow(/summary/i);
  });

  it("tracks Linear triage via linear_issue_id", () => {
    const report = createFeedbackReport({
      kind: "bug",
      summary: "Acca leg stake not saving",
      details: "Enter a stake, navigate away, it resets.",
      diagnostics: {
        appVersion: "1.1.0-dev",
        userAgent: "vitest",
        href: "/acca",
        timezone: "Europe/London",
      },
    });

    expect(report.linearIssueId).toBeNull();
    expect(listUntriagedFeedbackReports().some((r) => r.id === report.id)).toBe(
      true
    );

    markFeedbackReportFiled(report.id, "EDGE-44");

    const filed = listFeedbackReports(100).find((r) => r.id === report.id);
    expect(filed?.linearIssueId).toBe("EDGE-44");
    expect(listUntriagedFeedbackReports().some((r) => r.id === report.id)).toBe(
      false
    );
  });

  it("rejects filing without an issue id", () => {
    expect(() => markFeedbackReportFiled(1, "   ")).toThrow(/issue id/i);
  });
});
