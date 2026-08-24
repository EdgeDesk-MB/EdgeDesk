/** Grant / revoke copy. Full operator role, no half-admin. */

export const ADMIN_GRANT_HEADLINE =
  "This is a full operator role. There is no half-admin in v1.";

export const ADMIN_GRANT_CAN_LABEL = "They will be able to";
export const ADMIN_GRANT_CANNOT_LABEL = "They will not be able to";
export const ADMIN_REVOKE_CAN_LABEL = "They lose";
export const ADMIN_REVOKE_CANNOT_LABEL = "They never had";

export const ADMIN_GRANT_CAN: string[] = [
  "Open /admin and see payments, subscribers, desk activity, feed health, and release flags",
  "Grant or revoke admin for other accounts (except the bootstrap operator and the last admin)",
  "Run feed connection tests and see provider budgets",
  "Toggle PostHog flags used for staged rollouts",
];

export const ADMIN_GRANT_CANNOT: string[] = [
  "Place refunds or charges (Stripe dashboard)",
  "Deploy (Vercel)",
  "Sign in as a customer or edit another desk",
  "See another customer’s bets, wallets, or P&L in full (activity is volume + links, not a full desk dump)",
];

export const ADMIN_REVOKE_HEADLINE =
  "Revoke operator access. They lose /admin on their next request.";

export function adminGrantLead(email: string): string {
  return `You are about to give ${email} operator admin access.`;
}
