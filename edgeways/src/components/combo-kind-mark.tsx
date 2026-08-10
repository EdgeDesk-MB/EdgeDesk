import { cn } from "@/lib/utils";

/**
 * Bet365-style product mark ahead of stake @ odds on Combo Desk cards.
 * Same size as the stake/odds row; caps + italic.
 * First word canvas type; further words use accent (BET BUILDER).
 * Optional `suffix` (e.g. Treble / Four-fold) joins with a single space.
 */
export function ComboKindMark({
  kind,
  suffix,
  className,
}: {
  kind: "bet_builder" | "accumulator" | "systems";
  /** Fold / structure after the product mark (Treble, Lucky 15, …). */
  suffix?: string | null;
  className?: string;
}) {
  const words =
    kind === "bet_builder"
      ? (["Bet", "Builder"] as const)
      : kind === "systems"
        ? (["System"] as const)
        : (["Accumulator"] as const);
  const trimSuffix = suffix?.trim() || null;

  return (
    <span
      className={cn(
        "mr-1.5 shrink-0 text-[length:inherit] font-bold italic uppercase leading-[inherit] tracking-wide",
        className
      )}
      aria-label={trimSuffix ? `${words.join(" ")} ${trimSuffix}` : words.join(" ")}
    >
      {words.map((word, i) => (
        <span key={word} className={i === 0 ? "text-foreground" : "text-primary-text"}>
          {i > 0 ? " " : null}
          {word}
        </span>
      ))}
      {trimSuffix ? <span className="text-primary-text"> {trimSuffix}</span> : null}
    </span>
  );
}
