import { describe, expect, it } from "vitest";
import { createBookieScopesMigrateLock } from "./bookie-scopes-migrate";

describe("bookieScopes migrate lock", () => {
  it("does not re-arm after a failed persist", () => {
    const lock = createBookieScopesMigrateLock();
    expect(lock.tryStart()).toBe(true);
    // Failure path used to set migrateStarted = false. That re-armed the
    // effect and toasted /early-payout into an unbounded PATCH loop.
    expect(lock.tryStart()).toBe(false);
    expect(lock.tryStart()).toBe(false);
  });

  it("can start again only after an explicit reset", () => {
    const lock = createBookieScopesMigrateLock();
    expect(lock.tryStart()).toBe(true);
    lock.reset();
    expect(lock.tryStart()).toBe(true);
  });
});
