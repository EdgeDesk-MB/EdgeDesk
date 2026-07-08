"use client";

import type { ReactNode } from "react";
import { CircleHelp, type LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

export type SportId = "football" | "horse_racing" | "tennis" | "other" | (string & {});

export function normalizeSport(sport?: string | null): string {
  const s = sport?.trim();
  return s || "football";
}

export function sportLabel(sport?: string | null): string {
  switch (normalizeSport(sport)) {
    case "horse_racing":
      return "Horse racing";
    case "tennis":
      return "Tennis";
    case "other":
      return "Other";
    default:
      return "Football";
  }
}

type SvgIconProps = Pick<LucideProps, "className" | "size">;

function svgProps({ className, size = 16 }: SvgIconProps) {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: cn("shrink-0", className),
    "aria-hidden": true as const,
  };
}

/** Soccer ball — stroke style matched to Lucide. */
export function FootballIcon(props: SvgIconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7.2 14.6 12 12 16.8 9.4 12Z" />
      <path d="M12 2.5v4.7M12 16.8v4.7M4.8 8.2l4.1 2.4M15.1 13.4l4.1 2.4M4.8 15.8l4.1-2.4M15.1 10.6l4.1-2.4" />
    </svg>
  );
}

/** Horse racing — side-profile horse. */
function HorseRacingIcon(props: SvgIconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M4 19v-2.5c0-1 .8-2.5 2.2-3.2l2.3-1.2 1.8-3.5 2.2-.8 1.4 1.6 2.1-.3c.8-.1 1.5.3 1.8 1l.7 1.8" />
      <path d="M6 19h12" />
      <path d="M9.5 8.5 11 6l2.5 1" />
      <path d="M16.5 6.5c.5 1 .2 2.2-.8 3" />
      <circle cx="17.5" cy="5" r=".75" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Tennis ball — circle with seam curves. */
function TennisIcon(props: SvgIconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2c2.8 2.5 4.5 6.2 4.5 10s-1.7 7.5-4.5 10" />
      <path d="M12 2c-2.8 2.5-4.5 6.2-4.5 10s1.7 7.5 4.5 10" />
    </svg>
  );
}

export function SportIcon({
  sport,
  className,
  size = 16,
  title,
}: {
  sport?: string | null;
  className?: string;
  size?: number;
  /** Accessible name when the icon stands alone */
  title?: string;
}) {
  const id = normalizeSport(sport);
  const props = { className, size };
  let icon: ReactNode;
  switch (id) {
    case "horse_racing":
      icon = <HorseRacingIcon {...props} />;
      break;
    case "tennis":
      icon = <TennisIcon {...props} />;
      break;
    case "other":
      icon = <CircleHelp className={cn("shrink-0", className)} size={size} aria-hidden />;
      break;
    default:
      icon = <FootballIcon {...props} />;
  }
  if (title) {
    return (
      <span
        className={cn("inline-flex shrink-0", className)}
        role="img"
        aria-label={title}
      >
        {icon}
      </span>
    );
  }
  return icon;
}

/** Icon + human label inline (selects, filters). */
export function SportLabel({
  sport,
  className,
  iconClassName,
  size = 16,
}: {
  sport?: string | null;
  className?: string;
  iconClassName?: string;
  size?: number;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <SportIcon sport={sport} size={size} className={iconClassName} />
      <span>{sportLabel(sport)}</span>
    </span>
  );
}

/** Icon + stacked title/meta — single left edge for all lines. */
export function SportEventBlock({
  sport,
  title,
  titleClassName,
  children,
  className,
  iconSize = 16,
}: {
  sport?: string | null;
  title: ReactNode;
  titleClassName?: string;
  children?: ReactNode;
  className?: string;
  iconSize?: number;
}) {
  return (
    <div className={cn("flex items-start gap-2 text-left", className)}>
      <SportIcon sport={sport} size={iconSize} className="mt-0.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className={cn("font-medium leading-snug", titleClassName)}>{title}</div>
        {children}
      </div>
    </div>
  );
}

/** @deprecated Prefer SportEventBlock for multi-line rows */
export function SportEventTitle({
  sport,
  children,
  className,
  titleClassName,
  iconSize = 16,
}: {
  sport?: string | null;
  children: React.ReactNode;
  className?: string;
  titleClassName?: string;
  iconSize?: number;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <SportIcon sport={sport} size={iconSize} className="text-muted-foreground" />
      <span className={cn("min-w-0 truncate", titleClassName)}>{children}</span>
    </span>
  );
}
