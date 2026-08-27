"use client";

import { useRouter } from "next/navigation";
import { FilterPill } from "@/components/ui/filter-pill";
import { writeExcludeAdminsCookie } from "@/lib/admin/exclude-admins";
import { filterPillCountState } from "@/lib/ui/surface-styles";

export function ExcludeAdminsToggle({
  active,
  hiddenCount,
}: {
  active: boolean;
  hiddenCount: number;
}) {
  const router = useRouter();

  return (
    <FilterPill
      active={active}
      hasCount={hiddenCount > 0}
      aria-label={
        active
          ? `Exclude admins, on. ${hiddenCount} admin account${hiddenCount === 1 ? "" : "s"} hidden.`
          : `Exclude admins, off. ${hiddenCount} admin account${hiddenCount === 1 ? "" : "s"} on this page.`
      }
      onClick={() => {
        writeExcludeAdminsCookie(!active);
        router.refresh();
      }}
    >
      Exclude admins
      {hiddenCount > 0 ? (
        <span className={filterPillCountState(active)}>{hiddenCount}</span>
      ) : null}
    </FilterPill>
  );
}
