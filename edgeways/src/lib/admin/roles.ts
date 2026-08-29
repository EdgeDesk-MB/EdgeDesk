import { isBootstrapAdminEmail, isOperatorAdmin, isOwnerAdmin } from "./emails";
import type { AppUserRole } from "./emails";

export type AdminRoleBlock = "owner" | "bootstrap" | "last-admin";

export function adminRoleChangeBlock(input: {
  email: string | null | undefined;
  currentRole: string | null | undefined;
  nextRole: AppUserRole;
  adminCount: number;
}): AdminRoleBlock | null {
  if (input.nextRole === "admin") return null;
  if (isOwnerAdmin(input.email)) return "owner";
  if (isBootstrapAdminEmail(input.email)) return "bootstrap";
  const currentlyAdmin = isOperatorAdmin({
    email: input.email,
    role: input.currentRole,
  });
  if (currentlyAdmin && input.adminCount <= 1) return "last-admin";
  return null;
}

/** UI lock for grant/revoke. Owner, bootstrap, and the last admin cannot be demoted. */
export function adminAccessLock(
  user: { admin: boolean; bootstrap: boolean; owner?: boolean },
  adminCount: number
): AdminRoleBlock | null {
  if (user.owner) return "owner";
  if (user.bootstrap) return "bootstrap";
  if (user.admin && adminCount <= 1) return "last-admin";
  return null;
}
