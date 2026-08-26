/**
 * EDGE-91: HMAC-signed public demo cookie. `ew_public_demo=1` was forgeable by
 * anyone, unlocking the proxy bypass list on the waitlist surface. The value is
 * now `v1.<hmac-sha256 hex>` keyed by PUBLIC_DEMO_COOKIE_SECRET (falling back to
 * CLERK_SECRET_KEY, which every environment already has). Web Crypto only, so
 * the edge proxy and Node route handlers share the same code.
 *
 * Client code must keep using the presence-only check in public-demo.ts — the
 * secret never ships to the browser, and every server gate verifies properly.
 */
import "server-only";

const COOKIE_VERSION = "v1";
const HMAC_MESSAGE = "edgeways-public-demo";

function signingSecret(): string | null {
  return (
    process.env.PUBLIC_DEMO_COOKIE_SECRET ?? process.env.CLERK_SECRET_KEY ?? null
  );
}

async function hmacSha256Hex(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(HMAC_MESSAGE));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Null when no secret is configured — the demo entry point should 503. */
export async function signPublicDemoCookieValue(): Promise<string | null> {
  const secret = signingSecret();
  if (!secret) return null;
  return `${COOKIE_VERSION}.${await hmacSha256Hex(secret)}`;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyPublicDemoCookieValue(
  value: string | null | undefined
): Promise<boolean> {
  if (!value) return false;
  const expected = await signPublicDemoCookieValue();
  if (!expected) return false;
  return timingSafeEqual(value, expected);
}
