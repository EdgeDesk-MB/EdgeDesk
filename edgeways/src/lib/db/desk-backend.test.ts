import { afterEach, describe, expect, it } from "vitest";
import { isNeonDesk } from "@/lib/db/desk-backend";

describe("isNeonDesk", () => {
  const backend = process.env.EDGEWAYS_DESK_BACKEND;
  const databaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (backend === undefined) delete process.env.EDGEWAYS_DESK_BACKEND;
    else process.env.EDGEWAYS_DESK_BACKEND = backend;
    if (databaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = databaseUrl;
  });

  it("stays on the Mac file when only DATABASE_URL is set", () => {
    expect(
      isNeonDesk({
        DATABASE_URL: "postgres://example",
      })
    ).toBe(false);
  });

  it("stays off when the flag is set without a hosted URL", () => {
    expect(isNeonDesk({ EDGEWAYS_DESK_BACKEND: "neon" })).toBe(false);
  });

  it("turns on only when both the flag and DATABASE_URL are set", () => {
    expect(
      isNeonDesk({
        EDGEWAYS_DESK_BACKEND: " neon ",
        DATABASE_URL: " postgres://example ",
      })
    ).toBe(true);
  });

  it("ignores any other flag value", () => {
    expect(
      isNeonDesk({
        EDGEWAYS_DESK_BACKEND: "sqlite",
        DATABASE_URL: "postgres://example",
      })
    ).toBe(false);
  });
});
