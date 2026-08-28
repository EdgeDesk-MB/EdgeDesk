import { describe, expect, it } from "vitest";
import {
  emailsOfExcludedAccounts,
  hiddenAccountsSub,
  hiddenExcludedSub,
  isExcludedStripeCustomer,
  parseExcludedAccountIds,
  scopeAdminUsers,
  serializeExcludedAccountIds,
  stripeSkipSets,
  uniqueClerkUserIds,
  withoutExcludedAccounts,
  withoutExcludedEmails,
  withoutExcludedFeedback,
} from "@/lib/admin/exclude-accounts";

describe("uniqueClerkUserIds", () => {
  it("trims, drops blanks and duplicates, and caps length", () => {
    expect(
      uniqueClerkUserIds(["user_a", " user_a ", "", "  ", 1, "user_b"])
    ).toEqual(["user_a", "user_b"]);
  });
});

describe("parseExcludedAccountIds", () => {
  it("reads clerkUserIds from stored JSON", () => {
    expect(parseExcludedAccountIds('{"clerkUserIds":["user_a"]}')).toEqual([
      "user_a",
    ]);
    expect(parseExcludedAccountIds("not-json")).toEqual([]);
    expect(parseExcludedAccountIds(undefined)).toEqual([]);
  });
});

describe("serializeExcludedAccountIds", () => {
  it("round-trips a clean list", () => {
    expect(parseExcludedAccountIds(serializeExcludedAccountIds([" user_a ", "user_a"]))).toEqual(
      ["user_a"]
    );
  });
});

describe("withoutExcludedAccounts", () => {
  const rows = [
    { clerkUserId: "user_a" },
    { clerkUserId: "user_b" },
  ];

  it("returns the same list when nothing is excluded", () => {
    expect(withoutExcludedAccounts(rows, [])).toBe(rows);
  });

  it("drops matching clerk ids", () => {
    expect(withoutExcludedAccounts(rows, ["user_a"])).toEqual([
      { clerkUserId: "user_b" },
    ]);
  });
});

describe("scopeAdminUsers", () => {
  const rows = [
    { clerkUserId: "admin_1", admin: true },
    { clerkUserId: "test_1", admin: false },
    { clerkUserId: "user_1", admin: false },
  ];

  it("applies both admin and test-account filters", () => {
    expect(
      scopeAdminUsers(rows, {
        excludeAdmins: true,
        excludedIds: ["test_1"],
      }).map((row) => row.clerkUserId)
    ).toEqual(["user_1"]);
  });
});

describe("emails and feedback", () => {
  const users = [
    { clerkUserId: "user_a", email: "A@Example.com" },
    { clerkUserId: "user_b", email: "b@example.com" },
    { clerkUserId: "user_c", email: null },
  ];

  it("collects lowercased emails for excluded accounts", () => {
    expect([...emailsOfExcludedAccounts(users, ["user_a", "user_c"])]).toEqual([
      "a@example.com",
    ]);
  });

  it("drops waitlist rows whose email is excluded", () => {
    expect(
      withoutExcludedEmails(
        [{ email: "a@example.com" }, { email: "other@example.com" }],
        new Set(["a@example.com"])
      )
    ).toEqual([{ email: "other@example.com" }]);
  });

  it("drops feedback that matches reply or signed-in email", () => {
    const reports = [
      {
        replyEmail: "a@example.com",
        diagnostics: { signedInEmail: null },
      },
      {
        replyEmail: null,
        diagnostics: { signedInEmail: "B@example.com" },
      },
      {
        replyEmail: "ok@example.com",
        diagnostics: { signedInEmail: null },
      },
    ];
    expect(
      withoutExcludedFeedback(reports, new Set(["a@example.com", "b@example.com"]))
    ).toEqual([reports[2]]);
  });
});

describe("stripe skip sets", () => {
  it("matches excluded customers by Stripe id or email", () => {
    const { skipCustomerIds, skipEmails } = stripeSkipSets(
      [
        {
          clerkUserId: "user_a",
          email: "a@example.com",
          stripeCustomerId: "cus_a",
        },
        {
          clerkUserId: "user_b",
          email: "b@example.com",
          stripeCustomerId: null,
        },
      ],
      ["user_a"]
    );
    expect(skipCustomerIds.has("cus_a")).toBe(true);
    expect(skipEmails.has("a@example.com")).toBe(true);
    expect(
      isExcludedStripeCustomer({
        customerId: "cus_a",
        email: null,
        skipCustomerIds,
        skipEmails,
      })
    ).toBe(true);
    expect(
      isExcludedStripeCustomer({
        customerId: "cus_other",
        email: "a@example.com",
        skipCustomerIds,
        skipEmails,
      })
    ).toBe(true);
    expect(
      isExcludedStripeCustomer({
        customerId: "cus_other",
        email: "b@example.com",
        skipCustomerIds,
        skipEmails,
      })
    ).toBe(false);
  });
});

describe("hidden copy", () => {
  it("names how many test accounts are hidden", () => {
    expect(hiddenExcludedSub(1)).toBe("1 test account hidden");
    expect(hiddenExcludedSub(2)).toBe("2 test accounts hidden");
    expect(hiddenExcludedSub(0)).toBeUndefined();
  });

  it("joins admin and test-account hiding", () => {
    expect(hiddenAccountsSub(2, true, 1)).toBe(
      "2 admins hidden · 1 test account hidden"
    );
    expect(hiddenAccountsSub(1, false, 1)).toBe("1 test account hidden");
    expect(hiddenAccountsSub(1, false, 0)).toBeUndefined();
  });
});
