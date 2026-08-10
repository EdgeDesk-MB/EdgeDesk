import { UserCircle } from "lucide-react";
import { ChromeTab } from "@/components/chrome-tab";
import { cn } from "@/lib/utils";

/** Shared Login control — meta-nav tab (desktop) + mobile drawer header. */
const loginShell =
  "skeuo-solid flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-button)] border border-transparent px-2.5 text-[13px] font-extrabold uppercase tracking-wide transition-opacity sm:text-xs sm:hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-topbar-foreground/30";

/** Desktop / default: theme topbar accent (brand+contrast light, ink+white dark). */
const loginToneDefault =
  "topbar-accent-face bg-topbar-accent text-topbar-accent-foreground";

/**
 * Mobile drawer: inverted vs desktop dark/light — ink+white in light,
 * yellow+ink in dark. Ink plate always uses soft chip face.
 */
const loginToneMobileSwap =
  "topbar-accent-face-ink bg-[#111111] text-white dark:bg-highlight dark:text-[#111111]";

/** Matches inactive meta-nav Links in `AppTopBarMetaNav`. */
const loginMetaTab =
  "group/meta-tab relative z-[1] flex shrink-0 touch-manipulation items-center gap-1.5 px-2.5 pt-1.5 pb-2 text-[13px] font-semibold tracking-tight text-topbar-muted outline-none ring-0 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-0";

export function TopBarLoginButton({
  className,
  showLabel = true,
  mobileSwap = false,
  variant = "accent",
}: {
  className?: string;
  /** When false, icon-only (not used currently — label always on). */
  showLabel?: boolean;
  /** Invert light/dark fill vs the desktop top-bar Login. */
  mobileSwap?: boolean;
  /** `meta` = submenu tab chrome; `accent` = filled pill (mobile drawer). */
  variant?: "accent" | "meta";
}) {
  if (variant === "meta") {
    return (
      <button
        type="button"
        data-meta-nav="login"
        className={cn(loginMetaTab, className)}
        aria-label="Sign in - coming soon"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -bottom-px z-0 opacity-0 transition-opacity duration-100 group-hover/meta-tab:opacity-10 group-focus-visible/meta-tab:opacity-10 group-active/meta-tab:opacity-[0.14]"
        >
          <ChromeTab edge="rise" className="absolute inset-0" />
        </span>
        <UserCircle
          className="relative z-[1] size-3.5 shrink-0"
          strokeWidth={2.25}
          aria-hidden
        />
        {showLabel ? <span className="relative z-[1]">Login</span> : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        loginShell,
        mobileSwap ? loginToneMobileSwap : loginToneDefault,
        className
      )}
      aria-label="Sign in - coming soon"
    >
      <UserCircle className="size-4 shrink-0" strokeWidth={2} />
      {showLabel ? <span>Login</span> : null}
    </button>
  );
}
