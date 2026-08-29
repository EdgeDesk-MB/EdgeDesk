import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_DESK_OWNER_EMAIL,
  deskFileKind,
  deskFileToken,
  deskOwnerEmail,
  isDeskOwnerEmail,
  pickCanonicalNeonClerkUserId,
  resolveScopedDbPath,
  runWithDeskActor,
  getDeskActor,
} from "@/lib/db/desk-scope";

describe("desk-scope", () => {
  const owner = process.env.EDGEWAYS_DESK_OWNER_EMAIL;
  const ownerId = process.env.EDGEWAYS_DESK_OWNER_USER_ID;
  afterEach(() => {
    if (owner === undefined) delete process.env.EDGEWAYS_DESK_OWNER_EMAIL;
    else process.env.EDGEWAYS_DESK_OWNER_EMAIL = owner;
    if (ownerId === undefined) delete process.env.EDGEWAYS_DESK_OWNER_USER_ID;
    else process.env.EDGEWAYS_DESK_OWNER_USER_ID = ownerId;
  });

  it("defaults the owner email to the Edge dogfood account", () => {
    delete process.env.EDGEWAYS_DESK_OWNER_EMAIL;
    expect(deskOwnerEmail()).toBe(DEFAULT_DESK_OWNER_EMAIL);
    expect(isDeskOwnerEmail("SamHayter.Design@gmail.com")).toBe(true);
    expect(isDeskOwnerEmail("sonicactivity@gmail.com")).toBe(false);
  });

  it("honours EDGEWAYS_DESK_OWNER_EMAIL", () => {
    process.env.EDGEWAYS_DESK_OWNER_EMAIL = "  Other@Example.com ";
    expect(deskOwnerEmail()).toBe("other@example.com");
    expect(isDeskOwnerEmail("other@example.com")).toBe(true);
    expect(isDeskOwnerEmail(DEFAULT_DESK_OWNER_EMAIL)).toBe(false);
  });

  it("treats a matching Clerk user id as the owner when email is missing", () => {
    process.env.EDGEWAYS_DESK_OWNER_USER_ID = "user_owner";
    expect(
      deskFileKind({ clerkUserId: "user_owner", email: null })
    ).toBe("owner");
    expect(
      deskFileKind({ clerkUserId: "user_other", email: null })
    ).toBe("user");
  });

  it("classifies owner, other login, and unsigned", () => {
    expect(
      deskFileKind({
        clerkUserId: "user_owner",
        email: DEFAULT_DESK_OWNER_EMAIL,
      })
    ).toBe("owner");
    expect(
      deskFileKind({
        clerkUserId: "user_other",
        email: "sonicactivity@gmail.com",
      })
    ).toBe("user");
    expect(deskFileKind({ clerkUserId: null, email: null })).toBe("unsigned");
  });

  it("keeps the filled desk on edgeways.db for the owner", () => {
    const resolved = resolveScopedDbPath({
      dataDir: "/tmp/data",
      actor: {
        clerkUserId: "user_3HqzZ0vGHKdHGozq8a064YzgQWk",
        email: DEFAULT_DESK_OWNER_EMAIL,
      },
    });
    expect(resolved.kind).toBe("owner");
    expect(resolved.dbPath).toBe(path.join("/tmp/data", "edgeways.db"));
  });

  it("gives other logins their own file", () => {
    const resolved = resolveScopedDbPath({
      dataDir: "/tmp/data",
      actor: {
        clerkUserId: "user_3Hoeo8wWQhTXBAp61w3RLxMfe9i",
        email: "sonicactivity@gmail.com",
      },
    });
    expect(resolved.kind).toBe("user");
    expect(resolved.dbPath).toBe(
      path.join("/tmp/data", "desks", "user_3Hoeo8wWQhTXBAp61w3RLxMfe9i.db")
    );
  });

  it("does not leak the owner file when nobody is signed in", () => {
    const resolved = resolveScopedDbPath({
      dataDir: "/tmp/data",
      actor: { clerkUserId: null, email: null },
    });
    expect(resolved.kind).toBe("unsigned");
    expect(resolved.dbPath).toBe(path.join("/tmp/data", "desks", "unsigned.db"));
  });

  it("lets EDGEWAYS_DB_PATH and the demo marker win", () => {
    expect(
      resolveScopedDbPath({
        dataDir: "/tmp/data",
        actor: { clerkUserId: "user_x", email: "a@b.com" },
        override: "/tmp/vitest.db",
      }).kind
    ).toBe("override");
    expect(
      resolveScopedDbPath({
        dataDir: "/tmp/data",
        actor: {
          clerkUserId: "user_x",
          email: DEFAULT_DESK_OWNER_EMAIL,
        },
        demoMarker: true,
      })
    ).toEqual({
      kind: "demo",
      dbPath: path.join("/tmp/data", "edgeways-demo.db"),
    });
  });

  it("sanitises odd Clerk ids", () => {
    expect(deskFileToken("user/../x")).toBe("user____x");
    expect(deskFileToken("   ")).toBe("unknown");
  });

  it("exposes the actor only inside runWithDeskActor", () => {
    expect(getDeskActor()).toEqual({
      clerkUserId: null,
      email: null,
      neonClerkUserId: null,
    });
    const seen = runWithDeskActor(
      { clerkUserId: "user_1", email: "A@B.com" },
      () => getDeskActor()
    );
    expect(seen).toEqual({
      clerkUserId: "user_1",
      email: "a@b.com",
      neonClerkUserId: "user_1",
    });
    expect(getDeskActor()).toEqual({
      clerkUserId: null,
      email: null,
      neonClerkUserId: null,
    });
  });

  it("keeps the signed-in Clerk id when the Neon desk is aliased", () => {
    const seen = runWithDeskActor(
      {
        clerkUserId: "user_local",
        email: "a@b.com",
        neonClerkUserId: "user_live",
      },
      () => getDeskActor()
    );
    expect(seen).toEqual({
      clerkUserId: "user_local",
      email: "a@b.com",
      neonClerkUserId: "user_live",
    });
  });

  it("keeps the actor across awaits when the callback is async", async () => {
    const id = await runWithDeskActor(
      { clerkUserId: "user_1", email: "a@b.com" },
      async () => {
        await new Promise((r) => setTimeout(r, 5));
        return getDeskActor().clerkUserId;
      }
    );
    expect(id).toBe("user_1");
  });

  it("keeps the actor when a sync wrapper returns the handler promise", async () => {
    async function handler() {
      await new Promise((r) => setTimeout(r, 5));
      return getDeskActor().clerkUserId;
    }
    const id = await runWithDeskActor(
      { clerkUserId: "user_1", email: "a@b.com" },
      () => handler()
    );
    expect(id).toBe("user_1");
  });
});

describe("pickCanonicalNeonClerkUserId", () => {
  const live = "user_3IT7V2FQfFhC2ZNg9Q4FjAbDEgQ";
  const local = "user_3HqzZ0vGHKdHGozq8a064YzgQWk";

  it("keeps the signed-in id when there is no other account", () => {
    expect(
      pickCanonicalNeonClerkUserId({
        signedInUserId: local,
        candidates: [],
      })
    ).toBe(local);
    expect(
      pickCanonicalNeonClerkUserId({
        signedInUserId: local,
        candidates: [{ clerkUserId: local, createdAt: 1, offerCount: 0 }],
      })
    ).toBe(local);
  });

  it("prefers an explicit owner id when it is one of the accounts", () => {
    expect(
      pickCanonicalNeonClerkUserId({
        signedInUserId: local,
        preferredUserId: live,
        candidates: [
          { clerkUserId: local, createdAt: 2, offerCount: 200 },
          { clerkUserId: live, createdAt: 1, offerCount: 1 },
        ],
      })
    ).toBe(live);
  });

  it("picks the desk with more offers so localhost follows Live", () => {
    expect(
      pickCanonicalNeonClerkUserId({
        signedInUserId: local,
        candidates: [
          { clerkUserId: local, createdAt: 1, offerCount: 159 },
          { clerkUserId: live, createdAt: 2, offerCount: 160 },
        ],
      })
    ).toBe(live);
  });

  it("breaks a tie with the newer account row", () => {
    expect(
      pickCanonicalNeonClerkUserId({
        signedInUserId: local,
        candidates: [
          { clerkUserId: local, createdAt: 1, offerCount: 10 },
          { clerkUserId: live, createdAt: 9, offerCount: 10 },
        ],
      })
    ).toBe(live);
  });
});
