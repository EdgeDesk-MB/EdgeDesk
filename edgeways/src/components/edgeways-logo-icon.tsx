import { cn } from "@/lib/utils";

/**
 * Edgeways brand mark: yellow square with the pulse line knocked out, so the
 * pulse picks up the surface behind it (near-black on the dark top bar, as
 * designed). Derived from brand/edgeways-lockup.png - swap for a master SVG
 * when Sam supplies one; keep the API identical.
 */
export function EdgewaysLogoIcon({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- brand asset, no optimisation needed at 18px
    <img
      src="/brand/mark.png"
      alt=""
      aria-hidden
      className={cn("size-[18px] shrink-0 rounded-[4px]", className)}
    />
  );
}
