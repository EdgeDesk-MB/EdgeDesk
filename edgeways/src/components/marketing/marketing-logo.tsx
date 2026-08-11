import Link from "next/link";
import { EdgewaysLogo } from "@/components/edgeways-logo-icon";
import { cn } from "@/lib/utils";

/**
 * Same lockup + Beta chip as the desk top bar, coloured for the ink
 * marketing canvas (yellow mark, yellow Beta plate, ink type).
 */
export function MarketingLogo({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  const inner = (
    <>
      {/* Fixed slot + object-contain — stops flex shrink from warping the lockup */}
      <EdgewaysLogo
        onDark
        className="h-[2.1rem] w-[8.15rem] shrink-0 object-contain object-left"
      />
      <span className="inline-flex shrink-0 origin-left translate-y-[2px] scale-[0.625] -mr-[37.5%] items-center rounded-[3px] bg-[var(--marketing-brand,#FFC71E)] px-1.5 py-0.5 text-xs font-bold uppercase leading-none tracking-wide text-[var(--marketing-ink,#111111)]">
        Beta
      </span>
    </>
  );

  if (!href) {
    return (
      <span
        className={cn("inline-flex shrink-0 items-center gap-2", className)}
      >
        {inner}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 transition-opacity hover:opacity-90",
        className
      )}
      aria-label="Edgeways"
    >
      {inner}
    </Link>
  );
}
