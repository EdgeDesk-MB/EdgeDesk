import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ChevronRight, CircleHelp } from "lucide-react";
import { cn } from "@/lib/utils";
import { sectionBar } from "@/lib/ui/layout-spacing";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const pageInsetX = "px-[var(--layout-page-x)]";

function TooltipBody({ children }: { children: React.ReactNode }) {
  if (typeof children === "string") {
    return (
      <span className="block whitespace-pre-line leading-relaxed">{children}</span>
    );
  }
  return <div className="flex w-full flex-col gap-1 leading-relaxed">{children}</div>;
}

const titleLinkClass =
  "inline text-inherit no-underline hover:text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm";

function SectionDescriptionTooltip({
  description,
  ariaLabel,
}: {
  description: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex shrink-0 items-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={ariaLabel ?? (typeof description === "string" ? description : "Section help")}
          >
            <CircleHelp className="size-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          sideOffset={6}
          className="max-w-[14rem] py-2 leading-relaxed"
        >
          <TooltipBody>{description}</TooltipBody>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SectionTitle({
  title,
  prominent,
  titleHref,
}: {
  title: string;
  prominent?: boolean;
  titleHref?: string;
}) {
  const titleClass = cn(
    "m-0 font-bold leading-snug text-foreground",
    prominent ? "text-lg" : "text-sm"
  );

  if (titleHref) {
    return (
      <h2 className={titleClass}>
        <Link href={titleHref} className={titleLinkClass}>
          {title}
          <ChevronRight
            className="ml-[10px] inline size-[0.9em] shrink-0 align-[-0.05em] opacity-70"
            aria-hidden
          />
        </Link>
      </h2>
    );
  }

  return <h2 className={titleClass}>{title}</h2>;
}

export function DashboardSectionHeader({
  icon: Icon,
  title,
  description,
  action,
  className,
  /** Match home overview bar / page shell horizontal inset */
  pageAlign,
  /** Larger title with description moved to a tooltip icon */
  prominent,
  /** Title links to a page - shows a trailing arrow, no link styling */
  titleHref,
  iconClassName,
  descriptionAriaLabel,
  /** Chip/badge rendered inline after the title with a 24 px gap — use for EV totals, counts, etc. */
  titleBadge,
}: {
  icon?: LucideIcon;
  title: string;
  description: React.ReactNode;
  /** Plain-text label for the help tooltip button when description is not a string */
  descriptionAriaLabel?: string;
  action?: React.ReactNode;
  className?: string;
  pageAlign?: boolean;
  prominent?: boolean;
  titleHref?: string;
  iconClassName?: string;
  titleBadge?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        pageAlign
          ? cn("border-b border-border/60 py-[var(--layout-section-y)]", pageInsetX)
          : sectionBar,
        "shrink-0 py-3",
        // Mobile deck / page scroll: keep the section title pinned while the body moves.
        "max-sm:sticky max-sm:top-0 max-sm:z-20 max-sm:bg-page",
        className
      )}
    >
      <div
        className={cn(
          "flex justify-between gap-2",
          prominent ? "items-center" : "items-start"
        )}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {Icon ? (
              <Icon
                className={cn(
                  "shrink-0",
                  prominent ? "size-5" : "size-4",
                  iconClassName ?? "text-primary-text"
                )}
                aria-hidden
              />
            ) : null}
            <SectionTitle title={title} prominent={prominent} titleHref={titleHref} />
            {titleBadge ? <div className="ml-4 flex items-center">{titleBadge}</div> : null}
          </div>
          {!prominent ? (
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {(action || (prominent && description)) && (
          <div className="flex shrink-0 items-center gap-4">
            {prominent && description ? (
              <SectionDescriptionTooltip
                description={description}
                ariaLabel={descriptionAriaLabel}
              />
            ) : null}
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
