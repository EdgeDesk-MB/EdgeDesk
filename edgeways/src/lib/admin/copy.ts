/** Grant / revoke copy. Operator admin is not the owner (master) role. */

export const ADMIN_GRANT_HEADLINE =
  "There is no half-admin. This is operator admin. The owner stays a separate role.";

export const ADMIN_GRANT_CAN_LABEL = "They will be able to";
export const ADMIN_GRANT_CANNOT_LABEL = "They will not be able to";
export const ADMIN_REVOKE_CAN_LABEL = "They lose";
export const ADMIN_REVOKE_CANNOT_LABEL = "They never had";

export const ADMIN_GRANT_CAN: string[] = [
  "Open /admin and see payments, subscribers, desk activity, feed health, and release flags",
  "See live charts, in-app toasts, and the Live log while Admin is open",
  "Grant or revoke operator admin for other accounts (except the owner, bootstrap operators, and the last admin)",
  "Run feed connection tests and see provider budgets",
  "Toggle desk previews and PostHog flags used for staged rollouts",
];

export const ADMIN_GRANT_CANNOT: string[] = [
  "Receive owner web push",
  "Change live alerts",
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
