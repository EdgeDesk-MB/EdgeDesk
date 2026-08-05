"use client";

/**
 * Owner chip filter (J8) - shared by Accounts, the league, Edge Report and
 * the season summary. Renders nothing while the household has one owner,
 * so single-operator desks never see it. Compliance framing (standing):
 * the copy is "operated by", never anything stronger.
 */

import { FilterPill } from "@/components/ui/filter-pill";
import { listOwners, type OwnedAccountLike } from "@/lib/accounts/owners";
import { cn } from "@/lib/utils";

export const ALL_OWNERS = "__all__";

export function OwnerFilter({
  accounts,
  value,
  onChange,
  className,
}: {
  accounts: OwnedAccountLike[];
  value: string;
  onChange: (owner: string) => void;
  className?: string;
}) {
  const owners = listOwners(accounts);
  if (owners.length <= 1) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} role="group" aria-label="Filter by account owner">
      {[ALL_OWNERS, ...owners].map((owner) => (
        <FilterPill
          key={owner}
          active={value === owner}
          onClick={() => onChange(owner)}
        >
          {owner === ALL_OWNERS ? "All owners" : owner === "me" ? "Me" : owner}
        </FilterPill>
      ))}
    </div>
  );
}
