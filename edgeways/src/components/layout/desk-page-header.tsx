import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHelp } from "@/components/help/page-help";
import type { PageHelpId } from "@/content/help/page-help";
import { PageHeaderActions } from "@/components/layout/page-header-actions";
import { pageSectionBar, pageSectionMeta } from "@/lib/ui/layout-spacing";
import { pageTitle } from "@/lib/ui/surface-styles";

export function DeskPageHeader({
  title,
  description,
  helpId,
  icon: Icon,
  action,
  toolbar,
  className,
  meta = false,
  /** When false, header sits flush inside a parent PageShell surface */
  bordered = false,
}: {
  title: string;
  description?: React.ReactNode;
  helpId?: PageHelpId;
  icon?: LucideIcon;
  action?: React.ReactNode;
  toolbar?: React.ReactNode;
  className?: string;
  /** Lighter meta bar instead of section bar */
  meta?: boolean;
  /** Standalone bordered shell (off when nested in PageShell surface) */
  bordered?: boolean;
}) {
  const band = (
    <>
      <div className={cn(meta ? pageSectionMeta : pageSectionBar)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start gap-2">
              {Icon && (
                <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <h1 className={pageTitle}>{title}</h1>
              {helpId && <PageHelp pageId={helpId} />}
            </div>
            {description && (
              <p className="mt-0.5 min-w-0 text-pretty break-words text-xs leading-snug text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {action && <PageHeaderActions>{action}</PageHeaderActions>}
        </div>
      </div>
      {toolbar}
    </>
  );

  if (!bordered) {
    return <div className={cn("shrink-0", className)}>{band}</div>;
  }

  return (
    <div className={cn("surface-lift overflow-hidden rounded-[var(--layout-page-radius)] ring-1 ring-border/40 dark:ring-0", className)}>
      {band}
    </div>
  );
}
