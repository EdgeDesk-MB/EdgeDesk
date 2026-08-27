import { describe, expect, it } from "vitest";
import {
  hiddenAdminsSub,
  parseExcludeAdminsFlag,
  withoutAdmins,
} from "@/lib/admin/exclude-admins";

describe("parseExcludeAdminsFlag", () => {
  it("is on only for the cookie value 1", () => {
    expect(parseExcludeAdminsFlag("1")).toBe(true);
    expect(parseExcludeAdminsFlag("0")).toBe(false);
    expect(parseExcludeAdminsFlag(undefined)).toBe(false);
  });
});

describe("withoutAdmins", () => {
  const rows = [
    { id: "a", admin: true },
    { id: "b", admin: false },
    { id: "c" },
  ];

  it("returns the same list when the filter is off", () => {
    expect(withoutAdmins(rows, false)).toEqual(rows);
  });

  it("names how many admins are hidden", () => {
    expect(hiddenAdminsSub(1, true)).toBe("1 admin hidden");
    expect(hiddenAdminsSub(2, true)).toBe("2 admins hidden");
    expect(hiddenAdminsSub(2, false)).toBeUndefined();
  });

  it("drops rows marked admin", () => {
    expect(withoutAdmins(rows, true)).toEqual([
      { id: "b", admin: false },
      { id: "c" },
    ]);
  });
});
