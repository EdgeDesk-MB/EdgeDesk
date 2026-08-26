/**
 * Per-instance fixed-window rate limiting (EDGE-96). No external dependency:
 * Vercel Fluid Compute reuses instances, so an in-memory bucket still blunts
 * burst abuse of the public write endpoints (Resend quota is the real cost).
 * Not airtight across instances — if abuse appears, escalate to Turnstile or
 * Upstash rather than tuning this.
 */
import "server-only";

import { NextResponse } from "next/server";

export interface RateLimitRule {
  /** Max requests per window per key. */
  limit: number;
  windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Drop expired buckets so a spray of unique IPs cannot grow the map forever. */
function prune(now: number): void {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export function checkRateLimit(
  key: string,
  rule: RateLimitRule,
  now: number = Date.now()
): { ok: boolean; retryAfterSec: number } {
  prune(now);
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  if (bucket.count >= rule.limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Returns a 429 (with Retry-After) when the caller is over the rule, else
 * null. `scope` separates limits per endpoint so one hot endpoint cannot
 * exhaust another's allowance.
 */
export function rateLimitResponse(
  scope: string,
  req: Request,
  rule: RateLimitRule
): NextResponse | null {
  const { ok, retryAfterSec } = checkRateLimit(`${scope}:${clientIp(req)}`, rule);
  if (ok) return null;
  return NextResponse.json(
    { error: "Too many attempts. Please wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}
