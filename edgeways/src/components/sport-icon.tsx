"use client";

import type { ReactNode } from "react";
import {
  Bike,
  Car,
  CircleHelp,
  Dog,
  Flag,
  Gamepad2,
  HandMetal,
  Shield,
  Snowflake,
  Target,
  Trophy,
  type LucideProps,
} from "lucide-react";
import { sportDisplayLabel } from "@/lib/sports";
import { cn } from "@/lib/utils";

export type SportId = string;

export function normalizeSport(sport?: string | null): string {
  const s = sport?.trim();
  return s || "football";
}

export function sportLabel(sport?: string | null): string {
  return sportDisplayLabel(sport);
}

type SvgIconProps = Pick<LucideProps, "className" | "size" | "strokeWidth">;

function svgProps({ className, size = 16, strokeWidth = 2 }: SvgIconProps) {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: cn("shrink-0", className),
    "aria-hidden": true as const,
  };
}

/** Association football — pentagon and five hexagonal panels, Lucide stroke. */
export function FootballIcon(props: SvgIconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7 16.76 10.45 14.94 16.05H9.06L7.24 10.45Z" />
      <path d="M12 7V2M16.76 10.45 21.51 8.91M7.24 10.45 2.49 8.91M14.94 16.05 17.88 20.09M9.06 16.05 6.12 20.09" />
    </svg>
  );
}

/**
 * Referee whistle — official Lucide artwork (not in lucide-react 1.23 yet).
 * https://github.com/lucide-icons/lucide/pull/3006
 */
export function WhistleIcon(props: SvgIconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M10 6v4" />
      <path d="M21 6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-5.675A7 7 0 1 1 9 6z" />
    </svg>
  );
}

/**
 * Horse racing - Lucide Lab `horse-head` (main Lucide has no horse icon).
 * https://lucide.dev/icons/lab/horse-head
 */
export function HorseRacingIcon(props: SvgIconProps) {
  return (
    <svg {...svgProps(props)}>
      <path d="M11.5 12H11" />
      <path d="M5 15a4 4 0 0 0 4 4h7.8l.3.3a3 3 0 0 0 4-4.46L12 7c0-3-1-5-1-5S8 3 8 7c-4 1-6 3-6 3" />
      <path d="M6.14 17.8S4 19 2 22" />
    </svg>
  );
}

/** Tennis ball - circle with seam curves. */
function TennisIcon(props: SvgIconProps) {
  return (
    <svg {...svgProps(props)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2c2.8 2.5 4.5 6.2 4.5 10s-1.7 7.5-4.5 10" />
      <path d="M12 2c-2.8 2.5-4.5 6.2-4.5 10s1.7 7.5 4.5 10" />
    </svg>
  );
}

function LucideSportIcon({
  icon: Icon,
  ...props
}: SvgIconProps & { icon: React.ComponentType<LucideProps> }) {
  const { className, size = 16 } = props;
  return <Icon className={cn("shrink-0", className)} size={size} aria-hidden />;
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
    case "cricket":
      icon = <LucideSportIcon icon={Trophy} {...props} />;
      break;
    case "rugby_union":
    case "rugby_league":
      icon = <LucideSportIcon icon={Shield} {...props} />;
      break;
    case "golf":
      icon = <LucideSportIcon icon={Flag} {...props} />;
      break;
    case "darts":
    case "snooker":
      icon = <LucideSportIcon icon={Target} {...props} />;
      break;
    case "basketball":
    case "volleyball":
    case "baseball":
      icon = <LucideSportIcon icon={Trophy} {...props} />;
      break;
    case "american_football":
      icon = <LucideSportIcon icon={Trophy} {...props} />;
      break;
    case "boxing":
    case "mma":
      icon = <LucideSportIcon icon={HandMetal} {...props} />;
      break;
    case "greyhounds":
      icon = <LucideSportIcon icon={Dog} {...props} />;
      break;
    case "motorsport":
      icon = <LucideSportIcon icon={Car} {...props} />;
      break;
    case "cycling":
      icon = <LucideSportIcon icon={Bike} {...props} />;
      break;
    case "ice_hockey":
      icon = <LucideSportIcon icon={Snowflake} {...props} />;
      break;
    case "esports":
      icon = <LucideSportIcon icon={Gamepad2} {...props} />;
      break;
    case "other":
      icon = <CircleHelp className={cn("shrink-0", className)} size={size} aria-hidden />;
      break;
    case "football":
      icon = <FootballIcon {...props} />;
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

/** Icon + stacked title/meta - single left edge for all lines. */
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
