import { SignIn } from "@clerk/nextjs";
import { EDGEWAYS_CLERK_APPEARANCE } from "@/lib/clerk-appearance";

function safeRedirect(value: string | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.startsWith("/login") || value.startsWith("/sign-up")) return null;
  return value;
}

/**
 * Auth entry. Path is /login so marketing CTAs stay clean.
 * Honours redirect_url for operator /admin after sign-in.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const params = await searchParams;
  const next = safeRedirect(params.redirect_url) ?? "/desk?live=1";
  return (
    <SignIn
      routing="path"
      path="/login"
      signUpUrl="/sign-up"
      fallbackRedirectUrl={next}
      forceRedirectUrl={next}
      appearance={EDGEWAYS_CLERK_APPEARANCE}
    />
  );
}
