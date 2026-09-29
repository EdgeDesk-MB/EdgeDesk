import { captureServerEvent } from "@/lib/analytics/server-capture";

export const SIGN_UP_METHODS = [
  "email",
  "google",
  "apple",
  "other",
  "unknown",
] as const;
export type SignUpMethod = (typeof SIGN_UP_METHODS)[number];

type ClerkUserForMethod = {
  externalAccounts?: Array<{ provider?: string | null }> | null;
  emailAddresses?: unknown[] | null;
} | null;

/**
 * How the Clerk account was created, reduced to a fixed list. The raw
 * provider string never leaves this function, so no free text is sent.
 */
export function signUpMethodFromClerkUser(user: ClerkUserForMethod): SignUpMethod {
  if (!user) return "unknown";
  const provider = user.externalAccounts?.[0]?.provider
    ?.trim()
    .toLowerCase()
    .replace(/^oauth_/, "");
  if (provider === "google" || provider === "apple") return provider;
  if (provider) return "other";
  if (user.emailAddresses?.length) return "email";
  return "unknown";
}

export function signUpCompletedProperties(method: SignUpMethod | undefined) {
  return { method: method ?? "unknown" };
}

/**
 * Loop signal: a new account finished sign-up. Fired once, when the
 * `app_users` row is first created. Never send the email, name or any
 * Clerk profile field: the distinct id is the Clerk user id already
 * joined by `PostHogIdentify`, and `method` comes from a fixed list.
 */
export function captureSignUpCompleted(input: {
  clerkUserId: string;
  method?: SignUpMethod;
}): void {
  captureServerEvent(
    input.clerkUserId,
    "sign_up_completed",
    signUpCompletedProperties(input.method)
  );
}
