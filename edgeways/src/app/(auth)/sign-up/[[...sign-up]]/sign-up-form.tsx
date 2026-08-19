"use client";

import { SignUp } from "@clerk/nextjs";
import { SignUpWithAgeGate } from "@/components/compliance/auth-age-gate";
import { EDGEWAYS_CLERK_APPEARANCE } from "@/lib/clerk-appearance";

export function SignUpForm({ afterUrl = "/desk" }: { afterUrl?: string }) {
  return (
    <SignUpWithAgeGate>
      {(ageConfirmedAt) => (
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/login"
          fallbackRedirectUrl={afterUrl}
          forceRedirectUrl={afterUrl}
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
