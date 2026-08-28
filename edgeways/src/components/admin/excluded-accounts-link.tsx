import Link from "next/link";
import { hiddenExcludedSub } from "@/lib/admin/exclude-accounts";

export function ExcludedAccountsLink({ count }: { count: number }) {
  const label = hiddenExcludedSub(count);
  if (!label) return null;
  return (
    <Link
      href="/admin/users"
      className="rounded-sm text-xs font-medium text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {label}
    </Link>
  );
}
