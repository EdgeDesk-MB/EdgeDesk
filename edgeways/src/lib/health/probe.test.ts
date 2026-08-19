import { describe, expect, it } from "vitest";
import { healthDatabaseKind } from "./probe";

describe("healthDatabaseKind", () => {
  it("uses Neon when DATABASE_URL is set", () => {
    expect(healthDatabaseKind("postgres://neon.example/edgeways")).toBe("neon");
    expect(healthDatabaseKind("  postgres://neon.example/edgeways  ")).toBe("neon");
  });

  it("uses SQLite when no hosted URL is set", () => {
    expect(healthDatabaseKind(undefined)).toBe("sqlite");
    expect(healthDatabaseKind("")).toBe("sqlite");
    expect(healthDatabaseKind("   ")).toBe("sqlite");
  });
});
