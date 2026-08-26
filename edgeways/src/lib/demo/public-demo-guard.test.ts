import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_DEMO_COOKIE, publicDemoWriteMessage } from "./public-demo";
import { signPublicDemoCookieValue } from "./public-demo-cookie";

const cookieJar = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === PUBLIC_DEMO_COOKIE && cookieJar.value !== undefined
        ? { value: cookieJar.value }
        : undefined,
  }),
}));

import { denyPublicDemoWrite, isPublicDemoRequest } from "./public-demo-guard";

describe("public demo server guard (EDGE-106)", () => {
  beforeEach(() => {
    process.env.PUBLIC_DEMO_COOKIE_SECRET = "test-secret";
    cookieJar.value = undefined;
  });

  afterEach(() => {
    delete process.env.PUBLIC_DEMO_COOKIE_SECRET;
  });

  it("passes when no demo cookie is present", async () => {
    expect(await isPublicDemoRequest()).toBe(false);
    expect(await denyPublicDemoWrite()).toBeNull();
  });

  it("blocks writes with 403 when the signed demo cookie is active", async () => {
    cookieJar.value = (await signPublicDemoCookieValue())!;
    expect(await isPublicDemoRequest()).toBe(true);
    const res = await denyPublicDemoWrite();
    expect(res?.status).toBe(403);
    expect(await res?.json()).toEqual({ error: publicDemoWriteMessage() });
  });

  it("ignores a forged demo cookie", async () => {
    cookieJar.value = "1";
    expect(await isPublicDemoRequest()).toBe(false);
    expect(await denyPublicDemoWrite()).toBeNull();
  });
});
