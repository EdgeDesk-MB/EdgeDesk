import { cn } from "@/lib/utils";

export const BEGAMBLEAWARE_URL = "https://www.begambleaware.org";

/**
 * The reusable responsible-gambling line (EDGE-13): age mark + BeGambleAware
 * link. Rendered by the age gate, Settings → Help & about, and later the
 * marketing footer (EDGE-26) — one component, one wording.
 */
export function ResponsibleGamblingNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      18+ only. Betting involves risk, never stake what you can&apos;t afford to
      lose.{" "}
      <a
        href={BEGAMBLEAWARE_URL}
        target="_blank"
        rel="noreferrer"
        className="text-primary-text underline underline-offset-2"
      >
        BeGambleAware.org
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </p>
  );
}
