import { hiddenAdminsSub, withoutAdmins } from "@/lib/admin/exclude-admins";

export const MAX_EXCLUDED_ACCOUNTS = 100;
export const MAX_EXCLUDED_ACCOUNT_ID_LENGTH = 128;

export function uniqueClerkUserIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (!id || id.length > MAX_EXCLUDED_ACCOUNT_ID_LENGTH || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    if (ids.length >= MAX_EXCLUDED_ACCOUNTS) break;
  }
  return ids;
}

export function parseExcludedAccountIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { clerkUserIds?: unknown };
    return uniqueClerkUserIds(parsed.clerkUserIds);
  } catch {
    return [];
  }
}

export function serializeExcludedAccountIds(ids: Iterable<string>): string {
  return JSON.stringify({ clerkUserIds: uniqueClerkUserIds([...ids]) });
}

export function excludedIdSet(ids: Iterable<string> = []): Set<string> {
  return new Set(uniqueClerkUserIds([...ids]));
}

export function withoutExcludedAccounts<T extends { clerkUserId: string }>(
  rows: T[],
  ids: Iterable<string>
): T[] {
  const skip = excludedIdSet(ids);
  if (skip.size === 0) return rows;
  return rows.filter((row) => !skip.has(row.clerkUserId));
}

export function scopeAdminUsers<T extends { clerkUserId: string; admin?: boolean }>(
  rows: T[],
  options: { excludeAdmins: boolean; excludedIds: Iterable<string> }
): T[] {
  return withoutExcludedAccounts(
    withoutAdmins(rows, options.excludeAdmins),
    options.excludedIds
  );
}

export function emailsOfExcludedAccounts<
  T extends { clerkUserId: string; email: string | null },
>(users: T[], ids: Iterable<string>): Set<string> {
  const skip = excludedIdSet(ids);
  const emails = new Set<string>();
  if (skip.size === 0) return emails;
  for (const user of users) {
    if (!skip.has(user.clerkUserId)) continue;
    const email = user.email?.trim().toLowerCase();
    if (email) emails.add(email);
  }
  return emails;
}

export function withoutExcludedEmails<T extends { email?: string | null }>(
  rows: T[],
  emails: Set<string>
): T[] {
  if (emails.size === 0) return rows;
  return rows.filter((row) => {
    const email = row.email?.trim().toLowerCase();
    return !email || !emails.has(email);
  });
}

export function withoutExcludedFeedback<
  T extends {
    replyEmail: string | null;
    diagnostics: { signedInEmail?: string | null };
  },
>(reports: T[], emails: Set<string>): T[] {
  if (emails.size === 0) return reports;
  return reports.filter((report) => {
    for (const value of [report.replyEmail, report.diagnostics.signedInEmail]) {
      const email = value?.trim().toLowerCase();
      if (email && emails.has(email)) return false;
    }
    return true;
  });
}

export function stripeSkipSets<
  T extends {
    clerkUserId: string;
    email: string | null;
    stripeCustomerId: string | null;
  },
>(
  users: T[],
  ids: Iterable<string>
): { skipCustomerIds: Set<string>; skipEmails: Set<string> } {
  const skip = excludedIdSet(ids);
  const skipCustomerIds = new Set<string>();
  const skipEmails = new Set<string>();
  if (skip.size === 0) return { skipCustomerIds, skipEmails };
  for (const user of users) {
    if (!skip.has(user.clerkUserId)) continue;
    if (user.stripeCustomerId) skipCustomerIds.add(user.stripeCustomerId);
    const email = user.email?.trim().toLowerCase();
    if (email) skipEmails.add(email);
  }
  return { skipCustomerIds, skipEmails };
}

export function isExcludedStripeCustomer(input: {
  customerId: string | null;
  email: string | null | undefined;
  skipCustomerIds: Set<string>;
  skipEmails: Set<string>;
}): boolean {
  if (input.customerId && input.skipCustomerIds.has(input.customerId)) return true;
  const email = input.email?.trim().toLowerCase();
  return Boolean(email && input.skipEmails.has(email));
}

export function hiddenExcludedSub(count: number): string | undefined {
  if (count <= 0) return undefined;
  return `${count} test account${count === 1 ? "" : "s"} hidden`;
}

export function hiddenAccountsSub(
  adminCount: number,
  excludeAdmins: boolean,
  excludedCount: number
): string | undefined {
  const parts = [
    hiddenAdminsSub(adminCount, excludeAdmins),
    hiddenExcludedSub(excludedCount),
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : undefined;
}
