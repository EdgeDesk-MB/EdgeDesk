import { SignUpForm } from "./sign-up-form";
import {
  parseCheckoutFrom,
  signUpRedirectForPlan,
} from "@/lib/billing/checkout-session";

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
  const after = signUpRedirectForPlan(
    query.plan,
    query.interval,
    parseCheckoutFrom(query.from),
    query.ref
  );
  return <SignUpForm afterUrl={after} />;
}
