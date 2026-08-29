/**
 * Who is an operator. Bootstrap emails cannot be demoted.
 * Extra addresses: EDGEWAYS_ADMIN_EMAILS (comma-separated).
 */

export const DEFAULT_BOOTSTRAP_ADMIN_EMAIL = "samhayter.design@gmail.com";
export const DEFAULT_OWNER_ADMIN_EMAIL = DEFAULT_BOOTSTRAP_ADMIN_EMAIL;

export type AppUserRole = "user" | "admin";

export function normaliseAdminEmail(
  email: string | null | undefined
): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export function bootstrapAdminEmails(
  env: Record<string, string | undefined> = process.env
): string[] {
  const extra = (env.EDGEWAYS_ADMIN_EMAILS ?? "")
    .split(",")
    .map((part) => normaliseAdminEmail(part))
    .filter((part): part is string => Boolean(part));
  return Array.from(
    new Set([DEFAULT_BOOTSTRAP_ADMIN_EMAIL, ...extra])
  );
}

export function isBootstrapAdminEmail(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env
): boolean {
  const normalised = normaliseAdminEmail(email);
  if (!normalised) return false;
  return bootstrapAdminEmails(env).includes(normalised);
}

export function parseAppUserRole(value: string | null | undefined): AppUserRole {
  return value === "admin" ? "admin" : "user";
}

export function isOperatorAdmin(input: {
  email: string | null | undefined;
  role: string | null | undefined;
}): boolean {
  return isBootstrapAdminEmail(input.email) || parseAppUserRole(input.role) === "admin";
}

/**
 * Master / owner: owner web push and live alerts. Not every bootstrap
 * operator. Extra addresses: EDGEWAYS_OWNER_EMAILS (comma-separated).
 */
export function ownerAdminEmails(
  env: Record<string, string | undefined> = process.env
): string[] {
  const extra = (env.EDGEWAYS_OWNER_EMAILS ?? "")
    .split(",")
    .map((part) => normaliseAdminEmail(part))
    .filter((part): part is string => Boolean(part));
  return Array.from(new Set([DEFAULT_OWNER_ADMIN_EMAIL, ...extra]));
}

export function isOwnerAdmin(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env
): boolean {
  const normalised = normaliseAdminEmail(email);
  if (!normalised) return false;
  return ownerAdminEmails(env).includes(normalised);
}
