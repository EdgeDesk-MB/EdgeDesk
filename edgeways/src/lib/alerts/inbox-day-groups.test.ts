import { afterEach, describe, expect, it, vi } from "vitest";
import type { AlertsInboxRow } from "@/lib/db/schema";
import { groupAlertsInboxByDay } from "./inbox-day-groups";

function alert(
  partial: Partial<AlertsInboxRow> & Pick<AlertsInboxRow, "id" | "updatedAt">
): AlertsInboxRow {
  return {
    dedupe: `k:${partial.id}`,
    kind: "user_reminder",
    title: `Alert ${partial.id}`,
    body: null,
    href: null,
    createdAt: partial.updatedAt,
    readAt: null,
    ...partial,
  };
}

describe("groupAlertsInboxByDay", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns no rows when there are no alerts", () => {
    expect(groupAlertsInboxByDay([], new Date("2026-09-27T12:00:00").getTime())).toEqual([]);
  });

  it("labels Today, Yesterday, then the full date, newest day first", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T12:00:00"));
    const now = Date.now();

    const todayLate = alert({
      id: 1,
      updatedAt: new Date("2026-09-27T09:15:00").getTime(),
    });
    const todayEarly = alert({
      id: 2,
      updatedAt: new Date("2026-09-27T08:00:00").getTime(),
    });
    const yesterday = alert({
      id: 3,
      updatedAt: new Date("2026-09-26T18:00:00").getTime(),
    });
    const older = alert({
      id: 4,
      updatedAt: new Date("2026-09-16T14:00:00").getTime(),
    });

    expect(
      groupAlertsInboxByDay([todayLate, todayEarly, yesterday, older], now)
    ).toEqual([
      { key: "2026-09-27", label: "Today", alerts: [todayLate, todayEarly] },
      { key: "2026-09-26", label: "Yesterday", alerts: [yesterday] },
      { key: "2026-09-16", label: "Wednesday 16th September", alerts: [older] },
    ]);
  });

  it("keeps within-day order and skips days with no alerts", () => {
    const now = new Date("2026-09-27T12:00:00").getTime();
    const first = alert({ id: 1, updatedAt: new Date("2026-09-27T10:00:00").getTime() });
    const second = alert({ id: 2, updatedAt: new Date("2026-09-27T11:00:00").getTime() });
    const older = alert({ id: 3, updatedAt: new Date("2026-09-24T09:00:00").getTime() });

    const groups = groupAlertsInboxByDay([first, second, older], now);

    expect(groups.map((group) => group.key)).toEqual(["2026-09-27", "2026-09-24"]);
    expect(groups[0]?.alerts.map((row) => row.id)).toEqual([1, 2]);
    expect(groups[1]?.label).toBe("Thursday 24th September");
  });

  it("puts the newest day first even when the inbox is not pre-sorted", () => {
    const now = new Date("2026-09-27T12:00:00").getTime();
    const older = alert({ id: 1, updatedAt: new Date("2026-09-16T14:00:00").getTime() });
    const today = alert({ id: 2, updatedAt: new Date("2026-09-27T09:00:00").getTime() });

    expect(groupAlertsInboxByDay([older, today], now).map((group) => group.label)).toEqual([
      "Today",
      "Wednesday 16th September",
    ]);
  });

  it("splits midnight on the local calendar, matching History", () => {
    const now = new Date("2026-09-27T12:00:00").getTime();
    const justToday = alert({
      id: 1,
      updatedAt: new Date("2026-09-27T00:00:00").getTime(),
    });
    const endOfYesterday = alert({
      id: 2,
      updatedAt: new Date("2026-09-26T23:59:59").getTime(),
    });

    expect(groupAlertsInboxByDay([justToday, endOfYesterday], now).map((group) => group.label)).toEqual([
      "Today",
      "Yesterday",
    ]);
  });
});
