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
}: {
  title: string;
  description?: React.ReactNode;
  helpId?: PageHelpId;
  icon?: LucideIcon;
  action?: React.ReactNode;
  /** Filter pills / secondary controls below the title band */
  toolbar?: React.ReactNode;
  className?: string;
}) {
  return (
    <DeskPageHeader
      title={title}
      description={description}
      helpId={helpId}
      icon={icon}
      action={action}
        toolbar={toolbar ? <ToolbarRow>{toolbar}</ToolbarRow> : undefined}
      className={cn("shrink-0", className)}
    />
  );
}

export type { PageHelpId };
