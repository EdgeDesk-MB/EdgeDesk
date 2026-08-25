import Link from "next/link";
import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { pagePrimaryButtonProps, pageSecondaryButtonProps } from "@/components/layout/page-header-actions";
import { Card, CardContent } from "@/components/ui/card";
import { emptyStateCopyInset, emptyStateIconWell, emptyStatePlate } from "@/lib/ui/surface-styles";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact,
  oneLine,
  busy,
  bare,
}: {
  icon?: LucideIcon;
  title: string;
  description: React.ReactNode;
  action?: { label: string; href?: string; onClick?: () => void };
  secondaryAction?: { label: string; href: string };
  className?: string;
  compact?: boolean;
  /** Modal empty states: keep the description to a short wrap. Extra help belongs on DialogExplainer. */
  oneLine?: boolean;
  /** First-load / in-flight: spinner in the icon well, live status. */
  busy?: boolean;
  /** In-feed empties: icon + copy on the page, no plate or radius. */
  bare?: boolean;
}) {
  const WellIcon = busy ? Loader2 : Icon;
  const TitleTag = compact ? "h3" : "h2";
  const statusProps = {
    role: busy ? ("status" as const) : undefined,
    "aria-live": busy ? ("polite" as const) : undefined,
    "aria-busy": busy || undefined,
  };
  const body = (
    <>
      {WellIcon && (
        <div className={emptyStateIconWell} aria-hidden>
          <WellIcon className={cn("size-5", busy && "motion-safe:animate-spin")} />
        </div>
      )}
      <div
        className={cn(
          "space-y-1",
          compact || oneLine ? "max-w-md" : "w-full min-w-0",
          oneLine && "w-full min-w-0"
        )}
      >
        <TitleTag className="text-base font-semibold">{title}</TitleTag>
        <p className="text-pretty break-words text-sm leading-snug text-muted-foreground">
          {description}
        </p>
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
    </>
  );
  const bodyClass = cn(
    "flex flex-col items-center gap-3 text-center",
    compact ? "py-6" : cn("py-10", emptyStateCopyInset)
  );

  if (bare) {
    return (
      <div data-empty-state="" {...statusProps} className={cn(bodyClass, className)}>
        {body}
      </div>
    );
  }

  return (
    <Card
      data-empty-state=""
      {...statusProps}
      className={cn(emptyStatePlate, className)}
    >
      <CardContent className={bodyClass}>{body}</CardContent>
    </Card>
  );
}
