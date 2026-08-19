"use client";

import { SignUp } from "@clerk/nextjs";
import { SignUpWithAgeGate } from "@/components/compliance/auth-age-gate";
import { EDGEWAYS_CLERK_APPEARANCE } from "@/lib/clerk-appearance";

export function SignUpForm() {
  return (
    <SignUpWithAgeGate>
      {(ageConfirmedAt) => (
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/login"
          fallbackRedirectUrl="/desk"
          forceRedirectUrl="/desk"
          appearance={EDGEWAYS_CLERK_APPEARANCE}
          unsafeMetadata={{
            ageConfirmed: true,
            ageConfirmedAt,
            legalAccepted: true,
            legalAcceptedAt: ageConfirmedAt,
          }}
        />
      )}
    </SignUpWithAgeGate>
  );
}
