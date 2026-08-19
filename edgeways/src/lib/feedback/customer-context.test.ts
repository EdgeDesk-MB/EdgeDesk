import { describe, expect, it } from "vitest";
import {
  formatAccountAge,
  formatDeskSummary,
  formatFeedbackDate,
  formatSubscriptionLabel,
} from "./customer-context";

describe("feedback customer context", () => {
  it("formats British dates", () => {
    expect(formatFeedbackDate(Date.UTC(2026, 7, 16, 12))).toBe("16 Aug 2026");
  });

  it("states account age in plain units", () => {
    const now = Date.UTC(2026, 7, 16);
    expect(formatAccountAge(now - 3_600_000, now)).toBe("less than a day");
    expect(formatAccountAge(now - 3 * 86_400_000, now)).toBe("3 days");
    expect(formatAccountAge(now - 21 * 86_400_000, now)).toBe("3 weeks");
    expect(formatAccountAge(now - 120 * 86_400_000, now)).toBe("4 months");
    expect(formatAccountAge(now - 800 * 86_400_000, now)).toBe("2 years");
  });

  it("joins plan, billing status, and founding", () => {
    expect(
      formatSubscriptionLabel({
        plan: "edge",
        billingStatus: "trialing",
        founding: true,
      })
    ).toBe("Edge · Trial · Founding");
    expect(
      formatSubscriptionLabel({
        plan: "free",
        billingStatus: "none",
        founding: false,
      })
    ).toBe("Free");
    expect(
      formatSubscriptionLabel({
        plan: "core",
        billingStatus: "active",
        founding: false,
      })
    ).toBe("Core · Active");
  });

  it("summarises desk counts without money", () => {
    expect(
      formatDeskSummary({
        demo: false,
        bets: 1,
        offers: 2,
        bookies: 3,
        exchanges: 1,
        firstActivityMs: Date.UTC(2026, 3, 3, 12),
      })
    ).toBe("1 bet, 2 offers, 3 bookies, 1 exchange, first activity 3 Apr 2026");
    expect(
      formatDeskSummary({
        demo: true,
        bets: 99,
        offers: 99,
        bookies: 99,
        exchanges: 0,
        firstActivityMs: null,
      })
    ).toBe("Demo desk (seeded data, ignore counts)");
  });
});
