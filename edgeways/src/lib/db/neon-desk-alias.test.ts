import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  users: [] as Array<{ clerkUserId: string; createdAt: number }>,
  offerCounts: [] as Array<{ clerkUserId: string | null; n: number }>,
}));

vi.mock("@/lib/db/neon", () => ({
  getNeonDb: () => ({
    select: (shape: Record<string, unknown>) => ({
      from: () => ({
        where: () => {
          if ("createdAt" in shape) return Promise.resolve(mocks.users);
          return {
            groupBy: () => Promise.resolve(mocks.offerCounts),
          };
        },
      }),
    }),
  }),
}));

import {
  clearNeonDeskAliasCache,
  resolveCanonicalNeonClerkUserId,
} from "@/lib/db/neon-desk-alias";

describe("resolveCanonicalNeonClerkUserId", () => {
  const live = "user_3IT7V2FQfFhC2ZNg9Q4FjAbDEgQ";
  const local = "user_3HqzZ0vGHKdHGozq8a064YzgQWk";
  const ownerId = process.env.EDGEWAYS_DESK_OWNER_USER_ID;

  beforeEach(() => {
    clearNeonDeskAliasCache();
    mocks.users = [];
    mocks.offerCounts = [];
    delete process.env.EDGEWAYS_DESK_OWNER_USER_ID;
  });

  afterEach(() => {
    if (ownerId === undefined) delete process.env.EDGEWAYS_DESK_OWNER_USER_ID;
    else process.env.EDGEWAYS_DESK_OWNER_USER_ID = ownerId;
  });

  it("returns the signed-in id when email is missing", async () => {
    await expect(
      resolveCanonicalNeonClerkUserId({ clerkUserId: local, email: null })
    ).resolves.toBe(local);
  });

  it("follows the Live desk when the same email has two Clerk ids", async () => {
    mocks.users = [
      { clerkUserId: local, createdAt: 1 },
      { clerkUserId: live, createdAt: 2 },
    ];
    mocks.offerCounts = [
      { clerkUserId: local, n: 159 },
      { clerkUserId: live, n: 160 },
    ];
    await expect(
      resolveCanonicalNeonClerkUserId({
        clerkUserId: local,
        email: "samhayter.design@gmail.com",
      })
    ).resolves.toBe(live);
  });

  it("caches the alias so dashboard polls do not re-query", async () => {
    mocks.users = [
      { clerkUserId: local, createdAt: 1 },
      { clerkUserId: live, createdAt: 2 },
    ];
    mocks.offerCounts = [
      { clerkUserId: local, n: 159 },
      { clerkUserId: live, n: 160 },
    ];
    await resolveCanonicalNeonClerkUserId({
      clerkUserId: local,
      email: "samhayter.design@gmail.com",
    });
    mocks.users = [];
    mocks.offerCounts = [];
    await expect(
      resolveCanonicalNeonClerkUserId({
        clerkUserId: local,
        email: "samhayter.design@gmail.com",
      })
    ).resolves.toBe(live);
  });
});
