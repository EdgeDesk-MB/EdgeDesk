import { describe, expect, it } from "vitest";
import { buildAccountGrowth } from "@/lib/admin/growth";
import { sumSeries } from "@/lib/admin/series";

const now = new Date("2026-08-26T12:00:00Z");

function utcNoon(day: string): number {
  return Date.parse(`${day}T12:00:00Z`);
}

describe("buildAccountGrowth", () => {
  it("splits plan, billing, recency and week-on-week signups", () => {
    const growth = buildAccountGrowth(
      [
        {
          createdAt: utcNoon("2026-08-25"),
          updatedAt: utcNoon("2026-08-26"),
          plan: "edge",
          billingStatus: "active",
          stripeCustomerId: null,
          admin: true,
        },
        {
          createdAt: utcNoon("2026-08-18"),
          updatedAt: utcNoon("2026-08-10"),
          plan: "free",
          billingStatus: "none",
          stripeCustomerId: null,
          admin: false,
        },
        {
          createdAt: utcNoon("2026-08-25"),
          updatedAt: utcNoon("2026-07-01"),
          plan: "core",
          billingStatus: "trialing",
          stripeCustomerId: "cus_1",
          admin: false,
        },
      ],
      [
        {
          createdAt: utcNoon("2026-08-24"),
          confirmedAt: utcNoon("2026-08-25"),
          unsubscribedAt: null,
        },
      ],
      now
    );

    expect(growth.signups30).toHaveLength(30);
    expect(growth.signups30.at(-2)).toEqual({ day: "2026-08-25", used: 2 });
    expect(growth.signupsCumulative30.at(-1)?.used).toBe(3);
    expect(sumSeries(growth.waitlist30)).toBe(1);
    expect(sumSeries(growth.confirmed30)).toBe(1);
    expect(sumSeries(growth.paidSignups30)).toBe(2);

    expect(growth.planShare.map((slice) => [slice.label, slice.value])).toEqual([
      ["Free", 1],
      ["Core", 1],
      ["Edge", 1],
    ]);
    expect(growth.billingShare.find((slice) => slice.label === "Complimentary")?.value).toBe(
      1
    );
    expect(growth.roleShare.find((slice) => slice.label === "Admins")?.value).toBe(1);
    expect(
      growth.recencyShare.find((slice) => slice.label === "Last 24 hours")?.value
    ).toBe(1);
    expect(growth.recencyShare.find((slice) => slice.label === "Older")?.value).toBe(1);

    expect(growth.week.signups.current).toBe(2);
    expect(growth.week.signups.previous).toBe(1);
    expect(growth.week.waitlist.current).toBe(1);
  });
});
