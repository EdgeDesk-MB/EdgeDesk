"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ThemeSelect } from "@/components/theme-select";
import { ADMIN_NAV, isAdminNavActive } from "@/lib/admin/nav";
import { appNavColumn } from "@/lib/ui/app-shell-layout";
import { captionHeading, navLinkState } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

export function AdminNav() {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "sticky top-[var(--layout-page-x)] hidden h-fit shrink-0 flex-col self-start pt-4 md:flex",
        appNavColumn
      )}
    >
      <nav className="flex flex-col px-0.5">
        <p className={cn(captionHeading, "px-3 pb-1 pt-1")}>Admin</p>
        <div className="flex flex-col gap-0.5">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const active = isAdminNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={navLinkState(active)}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
        <p className={cn(captionHeading, "px-3 pb-1 pt-8")}>Appearance</p>
        <div className="px-3 pb-0">
          <ThemeSelect className="w-full" />
        </div>
        <p className={cn(captionHeading, "px-3 pb-1 pt-8")}>Desk</p>
        <Link href="/desk" className={navLinkState(false)}>
          <ArrowLeft className="size-4 shrink-0" />
          <span className="truncate">Back to desk</span>
        </Link>
      </nav>
    </aside>
  );
}
