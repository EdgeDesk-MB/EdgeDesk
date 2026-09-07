import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeskPageHeader } from "@/components/layout/desk-page-header";
import { ToolbarRow } from "@/components/layout/toolbar-row";
import type { PageHelpId } from "@/content/help/page-help";

export function PageHeader({
  title,
  description,
  helpId,
  icon,
  action,
  toolbar,
  className,
  rule = true,
  toolbarRule = true,
}: {
  title: string;
  description?: React.ReactNode;
  helpId?: PageHelpId;
  icon?: LucideIcon;
  action?: React.ReactNode;
  /** Filter pills / secondary controls below the title band */
  toolbar?: React.ReactNode;
  className?: string;
  /** Hairline under the title. Off when tabs or a toolbar follow. */
  rule?: boolean;
  /** Hairline under the toolbar. Off when a nested list scroll owns the seam. */
  toolbarRule?: boolean;
}) {
  return (
    <DeskPageHeader
      title={title}
      description={description}
      helpId={helpId}
      icon={icon}
      action={action}
      toolbar={
        toolbar ? (
          <ToolbarRow className={!toolbarRule ? "border-b-0" : undefined}>{toolbar}</ToolbarRow>
        ) : undefined
      }
      className={cn("shrink-0", className)}
      rule={rule}
    />
  );
}

export type { PageHelpId };
