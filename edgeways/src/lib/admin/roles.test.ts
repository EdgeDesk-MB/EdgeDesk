import { describe, expect, it } from "vitest";
import { DEFAULT_BOOTSTRAP_ADMIN_EMAIL } from "./emails";
import { adminAccessLock, adminRoleChangeBlock } from "./roles";

describe("adminRoleChangeBlock", () => {
  it("allows granting admin", () => {
    expect(
      adminRoleChangeBlock({
        email: "ops@example.com",
        currentRole: "user",
        nextRole: "admin",
        adminCount: 1,
      })
    ).toBeNull();
  });

  it("blocks demoting the owner email", () => {
    expect(
      adminRoleChangeBlock({
        email: DEFAULT_BOOTSTRAP_ADMIN_EMAIL,
        currentRole: "user",
        nextRole: "user",
        adminCount: 3,
      })
    ).toBe("owner");
  });

  it("blocks demoting the last admin", () => {
    expect(
      adminRoleChangeBlock({
        email: "ops@example.com",
        currentRole: "admin",
        nextRole: "user",
        adminCount: 1,
      })
    ).toBe("last-admin");
  });

  it("allows demoting a spare admin", () => {
    expect(
      adminRoleChangeBlock({
        email: "ops@example.com",
        currentRole: "admin",
        nextRole: "user",
        adminCount: 2,
      })
    ).toBeNull();
  });
});

describe("adminAccessLock", () => {
  it("locks the owner row ahead of bootstrap", () => {
    expect(
      adminAccessLock({ admin: true, bootstrap: true, owner: true }, 3)
    ).toBe("owner");
  });

  it("locks a spare bootstrap operator", () => {
    expect(
      adminAccessLock({ admin: true, bootstrap: true, owner: false }, 3)
    ).toBe("bootstrap");
  });

  it("locks the last remaining admin", () => {
    expect(adminAccessLock({ admin: true, bootstrap: false }, 1)).toBe(
      "last-admin"
    );
  });

  it("lets a spare admin be revoked", () => {
    expect(adminAccessLock({ admin: true, bootstrap: false }, 2)).toBeNull();
  });
});
