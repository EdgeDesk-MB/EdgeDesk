import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  signPublicDemoCookieValue,
  verifyPublicDemoCookieValue,
} from "./public-demo-cookie";

const ORIGINAL = {
  demo: process.env.PUBLIC_DEMO_COOKIE_SECRET,
  clerk: process.env.CLERK_SECRET_KEY,
};

beforeEach(() => {
  process.env.PUBLIC_DEMO_COOKIE_SECRET = "test-demo-secret";
  delete process.env.CLERK_SECRET_KEY;
});

afterEach(() => {
  if (ORIGINAL.demo === undefined) delete process.env.PUBLIC_DEMO_COOKIE_SECRET;
  else process.env.PUBLIC_DEMO_COOKIE_SECRET = ORIGINAL.demo;
  if (ORIGINAL.clerk === undefined) delete process.env.CLERK_SECRET_KEY;
  else process.env.CLERK_SECRET_KEY = ORIGINAL.clerk;
});

describe("public demo cookie signing (EDGE-91)", () => {
  it("round-trips a signed value", async () => {
    const signed = await signPublicDemoCookieValue();
    expect(signed).toMatch(/^v1\.[0-9a-f]{64}$/);
    expect(await verifyPublicDemoCookieValue(signed)).toBe(true);
  });

  it("rejects the legacy forgeable value and tampering", async () => {
    expect(await verifyPublicDemoCookieValue("1")).toBe(false);
    const signed = await signPublicDemoCookieValue();
    expect(await verifyPublicDemoCookieValue(`${signed}x`)).toBe(false);
    expect(
      await verifyPublicDemoCookieValue(signed!.replace("v1.", "v2."))
    ).toBe(false);
    expect(await verifyPublicDemoCookieValue("")).toBe(false);
    expect(await verifyPublicDemoCookieValue(null)).toBe(false);
    expect(await verifyPublicDemoCookieValue(undefined)).toBe(false);
  });

  it("rejects values signed with a different secret", async () => {
    const signed = await signPublicDemoCookieValue();
    process.env.PUBLIC_DEMO_COOKIE_SECRET = "rotated-secret";
    expect(await verifyPublicDemoCookieValue(signed)).toBe(false);
  });

  it("falls back to CLERK_SECRET_KEY when no dedicated secret is set", async () => {
    delete process.env.PUBLIC_DEMO_COOKIE_SECRET;
    process.env.CLERK_SECRET_KEY = "clerk-test-secret";
    const signed = await signPublicDemoCookieValue();
    expect(signed).not.toBeNull();
    expect(await verifyPublicDemoCookieValue(signed)).toBe(true);
  });

  it("fails closed when no secret is configured at all", async () => {
    delete process.env.PUBLIC_DEMO_COOKIE_SECRET;
    delete process.env.CLERK_SECRET_KEY;
    expect(await signPublicDemoCookieValue()).toBeNull();
    expect(await verifyPublicDemoCookieValue("v1.whatever")).toBe(false);
  });
});
