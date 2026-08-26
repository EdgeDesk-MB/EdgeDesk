import { describe, expect, it } from "vitest";
import { checkRateLimit, clientIp } from "./api-rate-limit";

const RULE = { limit: 3, windowMs: 60_000 };

describe("checkRateLimit", () => {
  it("allows up to the limit, then 429s with a retry delay", () => {
    const t0 = 1_000_000;
    expect(checkRateLimit("k1", RULE, t0).ok).toBe(true);
    expect(checkRateLimit("k1", RULE, t0 + 1).ok).toBe(true);
    expect(checkRateLimit("k1", RULE, t0 + 2).ok).toBe(true);
    const blocked = checkRateLimit("k1", RULE, t0 + 3);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("resets after the window", () => {
    const t0 = 2_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit("k2", RULE, t0);
    expect(checkRateLimit("k2", RULE, t0 + 1).ok).toBe(false);
    expect(checkRateLimit("k2", RULE, t0 + 61_000).ok).toBe(true);
  });

  it("isolates keys from each other", () => {
    const t0 = 3_000_000;
    for (let i = 0; i < 3; i++) checkRateLimit("k3", RULE, t0);
    expect(checkRateLimit("k3", RULE, t0).ok).toBe(false);
    expect(checkRateLimit("k4", RULE, t0).ok).toBe(true);
  });
});

describe("clientIp", () => {
  it("takes the first x-forwarded-for entry", () => {
    const req = new Request("http://x", {
      headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip, then unknown", () => {
    expect(
      clientIp(new Request("http://x", { headers: { "x-real-ip": "5.6.7.8" } }))
    ).toBe("5.6.7.8");
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});
