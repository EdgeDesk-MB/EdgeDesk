import { describe, expect, it } from "vitest";
import { buildInboxCharts } from "@/lib/admin/inbox-charts";
import type { FeedbackListItem } from "@/lib/feedback/types";

const NOW = new Date(Date.UTC(2026, 7, 27, 12, 0, 0));
const DAY = 24 * 60 * 60 * 1000;

function report(kind: FeedbackListItem["kind"], daysAgo: number): FeedbackListItem {
  return {
    id: 1,
    kind,
    summary: "s",
    details: "d",
    replyEmail: null,
    diagnostics: {
      appVersion: "1",
      userAgent: "ua",
      href: "/",
      timezone: "UTC",
      signedInEmail: null,
    },
    createdAt: NOW.getTime() - daysAgo * DAY,
    linearIssueId: null,
  };
}

describe("buildInboxCharts", () => {
  it("builds a 30-day submission series with quiet days kept", () => {
    const charts = buildInboxCharts([report("bug", 1), report("bug", 1)], NOW);
    expect(charts.submissions30).toHaveLength(30);
    const total = charts.submissions30.reduce((sum, p) => sum + p.used, 0);
    expect(total).toBe(2);
  });

  it("groups kind share by label", () => {
    const charts = buildInboxCharts(
      [report("bug", 1), report("bug", 2), report("idea", 3)],
      NOW
    );
    const bug = charts.kindShare.find((slice) => slice.label === "Bug");
    const idea = charts.kindShare.find((slice) => slice.label === "Idea");
    expect(bug?.value).toBe(2);
    expect(idea?.value).toBe(1);
  });

  it("compares the last 7 days with the 7 before", () => {
    const charts = buildInboxCharts(
      [report("bug", 1), report("idea", 10)],
      NOW
    );
    expect(charts.week.submissions.current).toBe(1);
    expect(charts.week.submissions.previous).toBe(1);
  });

  it("handles an empty inbox", () => {
    const charts = buildInboxCharts([], NOW);
    expect(charts.submissions30).toHaveLength(30);
    expect(charts.kindShare.every((slice) => slice.value === 0)).toBe(true);
    expect(charts.week.submissions.current).toBe(0);
  });
});
