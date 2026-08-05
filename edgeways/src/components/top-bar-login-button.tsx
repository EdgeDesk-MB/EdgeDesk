import { UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared Login control — desktop top bar + mobile drawer header. */
const loginShell =
  "skeuo-solid flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-button)] border border-transparent px-2.5 text-[13px] font-extrabold uppercase tracking-wide transition-opacity sm:text-[11px] sm:hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-topbar-foreground/30";

/** Desktop / default: theme topbar accent (brand+contrast light, ink+white dark). */
const loginToneDefault =
  "topbar-accent-face bg-topbar-accent text-topbar-accent-foreground";

/**
 * Mobile drawer: inverted vs desktop dark/light — ink+white in light,
 * yellow+ink in dark. Ink plate always uses soft chip face.
 */
const loginToneMobileSwap =
  "topbar-accent-face-ink bg-[#111111] text-white dark:bg-highlight dark:text-[#111111]";

export function TopBarLoginButton({
  className,
  showLabel = true,
  mobileSwap = false,
}: {
  className?: string;
  /** When false, icon-only (not used currently — label always on). */
  showLabel?: boolean;
  /** Invert light/dark fill vs the desktop top-bar Login. */
  mobileSwap?: boolean;
}) {
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
