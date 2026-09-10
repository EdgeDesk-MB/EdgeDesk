import { describe, expect, it } from "vitest";
import {
  attachActivityPins,
  buildActivityPinView,
  emptyActivityPinView,
  filterActivityPins,
  footballPinLabel,
} from "@/lib/admin/activity-pins";

describe("activity pins", () => {
  it("labels a country-scoped football pin", () => {
    expect(footballPinLabel("England::Premier League")).toBe(
      "ENGLAND - Premier League"
    );
  });

  it("joins emails to hosted pin ids and drops excluded desks", () => {
    const attached = attachActivityPins(
      [
        { clerkUserId: "user_a", email: "a@example.com", plan: "core" },
        { clerkUserId: "user_b", email: "b@example.com", plan: "edge" },
      ],
      [
        {
          clerkUserId: "user_a",
          football: ["England::Premier League"],
          racing: ["Ascot"],
        },
        { clerkUserId: "user_b", football: ["Spain::La Liga"], racing: [] },
      ]
    );
    expect(attached[0]?.football).toEqual(["England::Premier League"]);
    expect(filterActivityPins(attached, ["user_b"])).toHaveLength(1);
  });

  it("accepts chart rows with no plan", () => {
    const attached = attachActivityPins(
      [{ clerkUserId: "user_a", email: "a@example.com" }],
      [{ clerkUserId: "user_a", football: [], racing: [] }]
    );
    expect(attached[0]?.plan).toBe("unset");
  });

  it("summarises who pinned and which scopes are popular", () => {
    const view = buildActivityPinView([
      {
        clerkUserId: "user_a",
        email: "a@example.com",
        plan: "core",
        football: ["England::Premier League", "Spain::La Liga"],
        racing: ["Ascot"],
      },
      {
        clerkUserId: "user_b",
        email: "b@example.com",
        plan: "free",
        football: ["England::Premier League"],
        racing: [],
      },
      {
        clerkUserId: "user_c",
        email: "c@example.com",
        plan: "free",
        football: [],
        racing: [],
      },
    ]);
    expect(view.desks).toBe(3);
    expect(view.desksWithPins).toBe(2);
    expect(view.footballPinCount).toBe(3);
    expect(view.racingPinCount).toBe(1);
    expect(view.rows.map((row) => row.clerkUserId)).toEqual(["user_a", "user_b"]);
    expect(view.footballShare[0]?.label).toBe("ENGLAND - Premier League");
    expect(view.footballShare[0]?.value).toBe(2);
  });

  it("starts empty", () => {
    expect(emptyActivityPinView().desksWithPins).toBe(0);
  });
});
