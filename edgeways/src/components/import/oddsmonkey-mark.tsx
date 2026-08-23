import { cn } from "@/lib/utils";

export const ODDSMONKEY_MARK_SRC = "/brands/oddsmonkey.png";

/** Circular Oddsmonkey mark for import tiles and buttons. */
export function OddsmonkeyMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- circular third-party mark; size via className
    <img
      src={ODDSMONKEY_MARK_SRC}
      alt=""
      width={20}
      height={20}
      aria-hidden
      className={cn("size-5 shrink-0", className)}
    />
  );
}
