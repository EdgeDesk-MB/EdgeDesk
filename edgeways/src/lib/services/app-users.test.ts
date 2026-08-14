import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, appUsers } from "@/lib/db";
import {
  ensureAppUser,
  findAppUserByClerkId,
  normaliseAppUserEmail,
} from "@/lib/services/app-users";

describe("normaliseAppUserEmail", () => {
  it("trims and lowercases", () => {
    expect(normaliseAppUserEmail("  Sam@Edgeways.app ")).toBe(
      "sam@edgeways.app"
    );
    expect(normaliseAppUserEmail("")).toBeNull();
    expect(normaliseAppUserEmail(null)).toBeNull();
  });
});

describe("ensureAppUser", () => {
  it("inserts a Clerk-keyed row and refreshes email on the same id", async () => {
    const clerkUserId = `user_test_${Date.now()}`;

    const created = await ensureAppUser({
      clerkUserId,
      email: "First@Example.com",
    });
    expect(created.clerkUserId).toBe(clerkUserId);
    expect(created.email).toBe("first@example.com");

    const stored = db
      .select()
      .from(appUsers)
      .where(eq(appUsers.clerkUserId, clerkUserId))
      .get();
    expect(stored?.email).toBe("first@example.com");
    expect(stored?.createdAt).toBe(created.createdAt);

    const updated = await ensureAppUser({
      clerkUserId,
      email: "Second@Example.com",
    });
    expect(updated.email).toBe("second@example.com");
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);

    const found = await findAppUserByClerkId(clerkUserId);
    expect(found?.email).toBe("second@example.com");
    expect(found?.createdAt).toBe(created.createdAt);
  });

  it("keeps an existing email when the later sync has none", async () => {
    const clerkUserId = `user_test_keep_${Date.now()}`;
    await ensureAppUser({ clerkUserId, email: "keep@example.com" });
    const again = await ensureAppUser({ clerkUserId, email: null });
    expect(again.email).toBe("keep@example.com");
  });
});
