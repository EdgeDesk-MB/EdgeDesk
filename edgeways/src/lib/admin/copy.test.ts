import { describe, expect, it } from "vitest";
import { ADMIN_GRANT_HEADLINE, adminGrantLead } from "./copy";

describe("admin grant copy", () => {
  it("names the account in the lead line", () => {
    expect(adminGrantLead("ops@example.com")).toBe(
      "You are about to give ops@example.com operator admin access."
    );
  });

  it("states there is no half-admin", () => {
    expect(ADMIN_GRANT_HEADLINE).toContain("no half-admin");
  });
});
