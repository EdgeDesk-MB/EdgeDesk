import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clerkUserId: "user_live" as string | null,
  deletedIds: [] as { id: number }[],
}));

vi.mock("@/lib/db/desk-scope", () => ({
  getDeskActor: () => ({ clerkUserId: mocks.clerkUserId, neonClerkUserId: mocks.clerkUserId }),
}));

vi.mock("@/lib/db/neon", () => ({
  getNeonDb: () => ({
    delete: () => ({
      where: () => ({
        returning: () => Promise.resolve(mocks.deletedIds),
      }),
    }),
  }),
}));

import { deleteNeonDeskBet } from "./neon-desk";

describe("deleteNeonDeskBet", () => {
  beforeEach(() => {
    mocks.clerkUserId = "user_live";
    mocks.deletedIds = [{ id: 42 }];
  });

  it("returns true when this login's bet is removed", async () => {
    await expect(deleteNeonDeskBet(42)).resolves.toBe(true);
  });

  it("returns false when the hosted row is missing", async () => {
    mocks.deletedIds = [];
    await expect(deleteNeonDeskBet(42)).resolves.toBe(false);
  });

  it("refuses to delete when signed out", async () => {
    mocks.clerkUserId = null;
    await expect(deleteNeonDeskBet(42)).rejects.toThrow("Sign in to delete a bet.");
  });
});
