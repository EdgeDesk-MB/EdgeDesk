import { describe, expect, it } from "vitest";
import { resolveAlertsInboxMode } from "./inbox-access";

describe("resolveAlertsInboxMode", () => {
  it("serves the canned demo inbox while the public-demo cookie is on", () => {
    expect(resolveAlertsInboxMode({ publicDemo: true, neonDesk: false })).toBe("demo");
    expect(resolveAlertsInboxMode({ publicDemo: true, neonDesk: true })).toBe("demo");
  });

  it("keeps hosted logins off the shared memory inbox", () => {
    expect(resolveAlertsInboxMode({ publicDemo: false, neonDesk: true })).toBe(
      "hosted_empty"
    );
  });

  it("reads the scoped SQLite desk for local logins", () => {
    expect(resolveAlertsInboxMode({ publicDemo: false, neonDesk: false })).toBe("desk");
  });
});
