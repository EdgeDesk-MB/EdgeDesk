import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { pagePrimaryButtonProps, pageSecondaryButtonProps } from "@/components/layout/page-header-actions";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact,
}: {
  icon?: LucideIcon;
  title: string;
  description: React.ReactNode;
  action?: { label: string; href?: string; onClick?: () => void };
  secondaryAction?: { label: string; href: string };
  className?: string;
  compact?: boolean;
}) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent
        className={cn(
          "flex flex-col items-center gap-3 text-center",
          compact ? "py-6" : "py-10"
        )}
      >
        {Icon && (
          <div className="flex size-10 items-center justify-center rounded-full bg-selection-subtle text-muted-foreground">
            <Icon className="size-5" />
          </div>
        )}
        <div className="max-w-md space-y-1">
          <p className="text-base font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {(action || secondaryAction) && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {action &&
              (action.href ? (
                <Button asChild {...pagePrimaryButtonProps}>
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              ) : (
                <Button {...pagePrimaryButtonProps} onClick={action.onClick}>
                  {action.label}
                </Button>
              ))}
            {secondaryAction && (
              <Button variant="outline" {...pageSecondaryButtonProps} asChild>
                <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
