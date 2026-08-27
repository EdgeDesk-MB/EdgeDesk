import { cookies } from "next/headers";
import { SignUpForm } from "./sign-up-form";
import {
  parseCheckoutFrom,
  signUpRedirectForPlan,
} from "@/lib/billing/checkout-session";
import {
  REFERRAL_COOKIE,
  resolveReferralCode,
} from "@/lib/referrals/persist";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{
    plan?: string;
    interval?: string;
    from?: string;
    ref?: string;
  }>;
}) {
  const query = await searchParams;
  const jar = await cookies();
  const ref = resolveReferralCode(
    query.ref,
    jar.get(REFERRAL_COOKIE)?.value
  );
  const after = signUpRedirectForPlan(
    query.plan,
    query.interval,
    parseCheckoutFrom(query.from),
    ref
  );
  return <SignUpForm afterUrl={after} />;
}
