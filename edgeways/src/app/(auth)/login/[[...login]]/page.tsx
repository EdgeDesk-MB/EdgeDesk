import { SignIn } from "@clerk/nextjs";
import { EDGEWAYS_CLERK_APPEARANCE } from "@/lib/clerk-appearance";

/**
 * Auth entry for future landing / desk handoff (EDGE-20).
 * Path is /login so marketing CTAs stay clean when wired later.
 */
export default function LoginPage() {
  return (
    <SignIn
      routing="path"
      path="/login"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/desk"
      forceRedirectUrl="/desk"
      appearance={EDGEWAYS_CLERK_APPEARANCE}
    />
  );
}
