import { cookies } from "next/headers";
import { SignIn } from "@clerk/nextjs";
import { EDGEWAYS_CLERK_APPEARANCE } from "@/lib/clerk-appearance";
import {
  REFERRAL_COOKIE,
  resolveReferralCode,
} from "@/lib/referrals/persist";

function safeRedirect(value: string | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.startsWith("/login") || value.startsWith("/sign-up")) return null;
  return value;
}

function signUpHref(ref: string | null): string {
  if (!ref) return "/sign-up";
  return `/sign-up?ref=${encodeURIComponent(ref)}`;
}

/**
 * Auth entry. Path is /login so marketing CTAs stay clean.
 * Honours redirect_url for operator /admin after sign-in.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string; ref?: string }>;
}) {
  const params = await searchParams;
  const jar = await cookies();
  const ref = resolveReferralCode(
    params.ref,
    jar.get(REFERRAL_COOKIE)?.value
  );
  const next = safeRedirect(params.redirect_url) ?? "/desk?live=1";
  return (
    <SignIn
      routing="path"
      path="/login"
      signUpUrl={signUpHref(ref)}
      fallbackRedirectUrl={next}
      forceRedirectUrl={next}
      appearance={EDGEWAYS_CLERK_APPEARANCE}
    />
  );
}
