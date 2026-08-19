import { SignUpForm } from "./sign-up-form";
import {
  parseCheckoutFrom,
  signUpRedirectForPlan,
} from "@/lib/billing/checkout-session";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; interval?: string; from?: string }>;
}) {
  const query = await searchParams;
  const after = signUpRedirectForPlan(
    query.plan,
    query.interval,
    parseCheckoutFrom(query.from)
  );
  return <SignUpForm afterUrl={after} />;
}
