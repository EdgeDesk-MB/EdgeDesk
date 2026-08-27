/**
 * Persist a landing ?ref= so the homepage can be the share target.
 * The referee browses, then signs up; claim still fires on /sign-up →
 * /subscribe or /setup. Query string wins over the cookie (last click).
 */
import {
  isReferralCodeFormat,
  normalizeReferralCode,
} from "@/lib/referrals/code";

export const REFERRAL_COOKIE = "ew_ref";
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function referralCookieOptions() {
  return {
    path: "/",
    sameSite: "lax" as const,
    httpOnly: true,
    maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
  };
}

export function parseStoredReferralCode(
  raw: string | null | undefined
): string | null {
  const code = normalizeReferralCode(raw);
  return isReferralCodeFormat(code) ? code : null;
}

export function resolveReferralCode(
  query: string | null | undefined,
  cookie: string | null | undefined
): string | null {
  return parseStoredReferralCode(query) ?? parseStoredReferralCode(cookie);
}

export type ReferralCookieWriter = {
  set(
    name: string,
    value: string,
    options: ReturnType<typeof referralCookieOptions>
  ): unknown;
};

/** Stamp ew_ref when the request URL carries a valid ?ref=. */
export function stampReferralCookie(
  rawQueryRef: string | null | undefined,
  cookies: ReferralCookieWriter
): string | null {
  const code = parseStoredReferralCode(rawQueryRef);
  if (!code) return null;
  cookies.set(REFERRAL_COOKIE, code, referralCookieOptions());
  return code;
}
