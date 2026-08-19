import { describe, expect, it } from "vitest";
import { buildFeedbackNotifyEmail, feedbackNotifyRecipients } from "./notify";

const customer = {
  email: "signed@example.com",
  subscription: "Edge · Trial · Founding",
  signedUpOn: "12 Mar 2026",
  accountAge: "5 months",
  subscriptionStartedOn: "2 Aug 2026",
  trialEndsOn: "16 Aug 2026",
  experience: "I have been doing this a long time",
  heardFrom: "Reddit",
  deskSummary: "48 bets, 11 offers, 6 bookies, first activity 3 Apr 2026",
};

describe("feedback notify", () => {
  it("prefers FEEDBACK_NOTIFY_TO over the waitlist list", () => {
    expect(
      feedbackNotifyRecipients({
        FEEDBACK_NOTIFY_TO: "sam@example.com",
        WAITLIST_NOTIFY_TO: "other@example.com",
      })
    ).toEqual(["sam@example.com"]);
  });

  it("falls back to WAITLIST_NOTIFY_TO", () => {
    expect(
      feedbackNotifyRecipients({
        WAITLIST_NOTIFY_TO: "Owner@Example.com, nope",
      })
    ).toEqual(["owner@example.com"]);
  });

  it("builds HTML with bold labels and customer facts", () => {
    const mail = buildFeedbackNotifyEmail({
      kind: "bug",
      summary: "Lay stake blank",
      details: "Imported a slip and the lay stake stayed empty.",
      replyEmail: "tester@example.com",
      signedInEmail: "signed@example.com",
      reportId: 12,
      diagnostics: {
        appVersion: "1.1.0-dev",
        userAgent: "vitest",
        href: "/feedback",
        timezone: "Europe/London",
      },
      customer,
    });

    expect(mail.subject).toBe("[Edgeways] Bug: Lay stake blank");
    expect(mail.replyTo).toBe("tester@example.com");
    expect(mail.text).toContain("Customer: signed@example.com");
    expect(mail.text).toContain("Subscription: Edge · Trial · Founding");
    expect(mail.text).toContain("Signed up: 12 Mar 2026 (5 months)");
    expect(mail.text).toContain("Subscription started: 2 Aug 2026");
    expect(mail.text).toContain("Experience: I have been doing this a long time");
    expect(mail.text).toContain("48 bets");
    expect(mail.html).toContain("<strong>Customer:</strong>");
    expect(mail.html).toContain("<strong>Subscription:</strong>");
    expect(mail.html).toContain("<strong>Details:</strong>");
    expect(mail.html).toContain("Imported a slip");
    expect(mail.html).not.toContain("<script>");
  });

  it("escapes HTML in the report body", () => {
    const mail = buildFeedbackNotifyEmail({
      kind: "other",
      summary: "Hello <b>there</b>",
      details: "<img src=x onerror=alert(1)>",
      diagnostics: {
        appVersion: "1.1.0-dev",
        userAgent: "vitest",
        href: "/feedback",
        timezone: "UTC",
      },
    });
    expect(mail.html).toContain("Hello &lt;b&gt;there&lt;/b&gt;");
    expect(mail.html).toContain("&lt;img src=x");
    expect(mail.html).not.toContain("<img src=x");
  });
});
