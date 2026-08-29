import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOOTSTRAP_ADMIN_EMAIL,
  DEFAULT_OWNER_ADMIN_EMAIL,
  bootstrapAdminEmails,
  isBootstrapAdminEmail,
  isOperatorAdmin,
  isOwnerAdmin,
  ownerAdminEmails,
  parseAppUserRole,
} from "./emails";

describe("admin emails", () => {
  it("always includes the bootstrap Gmail", () => {
    expect(bootstrapAdminEmails({})).toEqual([DEFAULT_BOOTSTRAP_ADMIN_EMAIL]);
    expect(isBootstrapAdminEmail("SamHayter.design@gmail.com")).toBe(true);
    expect(isBootstrapAdminEmail("other@example.com")).toBe(false);
  });

  it("merges extra env addresses", () => {
    const env = { EDGEWAYS_ADMIN_EMAILS: " Ops@Edgeways.app , other@x.com" };
    expect(bootstrapAdminEmails(env)).toEqual([
      DEFAULT_BOOTSTRAP_ADMIN_EMAIL,
      "ops@edgeways.app",
      "other@x.com",
    ]);
  });

  it("treats bootstrap as admin even when the row is still user", () => {
    expect(
      isOperatorAdmin({
        email: DEFAULT_BOOTSTRAP_ADMIN_EMAIL,
        role: "user",
      })
    ).toBe(true);
    expect(isOperatorAdmin({ email: "a@b.com", role: "admin" })).toBe(true);
    expect(isOperatorAdmin({ email: "a@b.com", role: "user" })).toBe(false);
  });

  it("parses roles conservatively", () => {
    expect(parseAppUserRole("admin")).toBe("admin");
    expect(parseAppUserRole("super")).toBe("user");
    expect(parseAppUserRole(null)).toBe("user");
  });

  it("treats only the owner email as master, not extra bootstrap operators", () => {
    expect(isOwnerAdmin(DEFAULT_OWNER_ADMIN_EMAIL)).toBe(true);
    expect(isOwnerAdmin("SamHayter.design@gmail.com")).toBe(true);
    const env = {
      EDGEWAYS_ADMIN_EMAILS: "ops@example.com",
      EDGEWAYS_OWNER_EMAILS: " co@edgeways.app ",
    };
    expect(ownerAdminEmails(env)).toEqual([
      DEFAULT_OWNER_ADMIN_EMAIL,
      "co@edgeways.app",
    ]);
    expect(isOwnerAdmin("ops@example.com", env)).toBe(false);
    expect(isBootstrapAdminEmail("ops@example.com", env)).toBe(true);
    expect(isOwnerAdmin("co@edgeways.app", env)).toBe(true);
  });
});
