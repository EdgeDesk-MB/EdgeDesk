export const ADMIN_EXCLUDE_ADMINS_COOKIE = "ew_admin_exclude_admins";

export function parseExcludeAdminsFlag(
  value: string | null | undefined
): boolean {
  return value === "1";
}

export function withoutAdmins<T extends { admin?: boolean }>(
  rows: T[],
  exclude: boolean
): T[] {
  if (!exclude) return rows;
  return rows.filter((row) => !row.admin);
}

export function hiddenAdminsSub(
  count: number,
  exclude: boolean
): string | undefined {
  if (!exclude || count <= 0) return undefined;
  return `${count} admin${count === 1 ? "" : "s"} hidden`;
}

export function writeExcludeAdminsCookie(exclude: boolean): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ADMIN_EXCLUDE_ADMINS_COOKIE}=${exclude ? "1" : "0"};path=/admin;max-age=31536000;SameSite=Lax`;
}
