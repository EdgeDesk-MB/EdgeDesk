import { describe, expect, it } from "vitest";
import {
  buildAttributionShare,
  buildExperienceShare,
  buildOnboardingAnswerRows,
  buildOnboardingCompletion,
  buildOnboardingCompletionShare,
  buildWaitlistFunnel,
  buildWhyHereShare,
  onboardingProfileSummary,
} from "@/lib/admin/funnel";
import type { OnboardingProfile } from "@/lib/onboarding-profile";
import type { AdminUserRow } from "@/lib/services/app-users";
import type { WaitlistRow } from "@/lib/services/waitlist-store";

function waitlistRow(email: string, overrides: Partial<WaitlistRow> = {}): WaitlistRow {
  return {
    email,
    createdAt: 1,
    confirmedAt: 2,
    unsubscribedAt: null,
    ...overrides,
  } as WaitlistRow;
}

function user(email: string, plan: string, attribution?: string): AdminUserRow {
  return {
    clerkUserId: email,
    email,
    plan,
    admin: false,
    onboardingProfile: attribution
      ? { attribution, attributionOther: null }
      : null,
  } as unknown as AdminUserRow;
}

function profile(
  overrides: Partial<OnboardingProfile> = {}
): OnboardingProfile {
  return {
    experience: "spreadsheet",
    whyHere: ["calculators"],
    whyHereOther: null,
    attribution: "reddit",
    attributionOther: null,
    savedAt: 1,
    ...overrides,
  };
}

function onboarded(
  email: string,
  overrides: Partial<OnboardingProfile> = {}
): AdminUserRow {
  return {
    clerkUserId: email,
    email,
    plan: "free",
    admin: false,
    onboardingProfile: profile(overrides),
  } as unknown as AdminUserRow;
}

describe("buildWaitlistFunnel", () => {
  it("counts joined, confirmed and paid as a narrowing funnel", () => {
    const waitlist = [
      waitlistRow("a@x.co"),
      waitlistRow("b@x.co"),
      waitlistRow("c@x.co", { confirmedAt: null }),
      waitlistRow("d@x.co", { unsubscribedAt: 3 }),
    ];
    const users = [user("a@x.co", "core"), user("b@x.co", "free")];
    const funnel = buildWaitlistFunnel(waitlist, users);
    expect(funnel).toEqual({ joined: 4, confirmed: 2, paid: 1 });
  });

  it("is zero on empty input", () => {
    expect(buildWaitlistFunnel([], [])).toEqual({ joined: 0, confirmed: 0, paid: 0 });
  });
});

describe("buildAttributionShare", () => {
  it("groups real answers by label and skips skipped/missing", () => {
    const users = [
      user("a@x.co", "free", "reddit"),
      user("b@x.co", "free", "reddit"),
      user("c@x.co", "free", "friend"),
      user("d@x.co", "free", "skipped"),
      user("e@x.co", "free"),
    ];
    const share = buildAttributionShare(users);
    const reddit = share.find((slice) => slice.label === "Reddit");
    const friend = share.find((slice) => slice.label === "A friend");
    expect(reddit?.value).toBe(2);
    expect(friend?.value).toBe(1);
    expect(share.find((slice) => slice.label === "skipped")).toBeUndefined();
  });

  it("is empty when nobody answered", () => {
    expect(buildAttributionShare([user("a@x.co", "free")])).toEqual([]);
  });
});

describe("buildOnboardingCompletion", () => {
  it("counts answered vs pending", () => {
    expect(
      buildOnboardingCompletion([
        onboarded("a@x.co"),
        user("b@x.co", "free"),
        user("c@x.co", "core"),
      ])
    ).toEqual({ answered: 1, pending: 2, total: 3 });
  });

  it("is empty on no accounts", () => {
    expect(buildOnboardingCompletion([])).toEqual({
      answered: 0,
      pending: 0,
      total: 0,
    });
    expect(buildOnboardingCompletionShare([])).toEqual([]);
  });
});

describe("buildExperienceShare", () => {
  it("groups by experience label and skips missing profiles", () => {
    const share = buildExperienceShare([
      onboarded("a@x.co", { experience: "spreadsheet" }),
      onboarded("b@x.co", { experience: "spreadsheet" }),
      onboarded("c@x.co", { experience: "beginner" }),
      user("d@x.co", "free"),
    ]);
    expect(share.find((slice) => slice.key === "spreadsheet")?.value).toBe(2);
    expect(share.find((slice) => slice.key === "beginner")?.value).toBe(1);
    expect(share.find((slice) => slice.key === "spreadsheet")?.label).toBe(
      "Spreadsheets"
    );
  });
});

describe("buildWhyHereShare", () => {
  it("counts each multi-select pick, not unique people", () => {
    const share = buildWhyHereShare([
      onboarded("a@x.co", { whyHere: ["calculators", "do_next"] }),
      onboarded("b@x.co", { whyHere: ["calculators"] }),
      user("c@x.co", "free"),
    ]);
    expect(share.find((slice) => slice.key === "calculators")?.value).toBe(2);
    expect(share.find((slice) => slice.key === "do_next")?.value).toBe(1);
    expect(share.find((slice) => slice.key === "calculators")?.label).toBe(
      "Calculators"
    );
  });
});

describe("buildOnboardingAnswerRows", () => {
  it("lists finished profiles newest first, with other text", () => {
    const rows = buildOnboardingAnswerRows([
      onboarded("old@x.co", { savedAt: 10, attribution: "friend" }),
      onboarded("new@x.co", {
        savedAt: 20,
        experience: "finder",
        whyHere: ["racing_live", "push_alerts"],
        attribution: "other",
        attributionOther: "Oddsmonkey Discord",
      }),
      user("skip@x.co", "free"),
    ]);
    expect(rows.map((row) => row.email)).toEqual(["new@x.co", "old@x.co"]);
    expect(rows[0]?.experienceLabel).toBe("Offer finder");
    expect(rows[0]?.whyHereLabels).toEqual(["Live racing cards", "2UP alerts"]);
    expect(rows[0]?.attributionLabel).toBe("Other: Oddsmonkey Discord");
    expect(rows[0]?.profile.experience).toBe("finder");
    expect(rows[0]?.profile.attributionOther).toBe("Oddsmonkey Discord");
  });

  it("summarises a profile for compact admin cells", () => {
    expect(
      onboardingProfileSummary(
        profile({
          experience: "beginner",
          whyHere: ["calculators", "bet_log"],
          attribution: "skipped",
        })
      )
    ).toBe("New to matched betting. Calculators and Bet log. Skipped.");
  });
});
