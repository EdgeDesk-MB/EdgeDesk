"use client";

import { ExcludeAdminsToggle } from "@/components/admin/exclude-admins-toggle";
import { ExcludedAccountsLink } from "@/components/admin/excluded-accounts-link";

export function AdminAccountFilters({
  excludeAdmins,
  adminCount,
  excludedCount,
  showExcludedLink = true,
}: {
  excludeAdmins: boolean;
  adminCount: number;
  excludedCount: number;
  showExcludedLink?: boolean;
}) {
  return (
    <>
      <ExcludeAdminsToggle active={excludeAdmins} hiddenCount={adminCount} />
      {showExcludedLink ? <ExcludedAccountsLink count={excludedCount} /> : null}
    </>
  );
}
