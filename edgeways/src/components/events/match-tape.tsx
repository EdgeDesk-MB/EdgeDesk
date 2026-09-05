"use client";

import { ArrowLeftRight, Goal, RectangleVertical, Scale } from "lucide-react";
import { formatLineupsCaption, parseFootballLineups } from "@/lib/events/lineups";
import {
  formatTapeLine,
  parseMatchTape,
  type MatchTapeEvent,
} from "@/lib/events/match-tape";
import { cn } from "@/lib/utils";

function TapeIcon({ kind }: { kind: MatchTapeEvent["kind"] }) {
  const className = "size-3 shrink-0";
  if (kind === "goal") return <Goal className={className} />;
  if (kind === "card") return <RectangleVertical className={className} />;
  if (kind === "subst") return <ArrowLeftRight className={className} />;
  if (kind === "var") return <Scale className={className} />;
  return <Goal className={className} />;
}

export function FootballLiveMeta({
  event,
  className,
}: {
  event: {
    homeTeam: string;
    awayTeam: string;
    goals?: string | null;
    lineups?: string | null;
  };
  className?: string;
}) {
  const tape = parseMatchTape(event.goals);
  const lineups = parseFootballLineups(event.lineups);
  const xi = formatLineupsCaption(lineups);

  if (tape.length === 0 && !xi) return null;

  return (
    <div className={cn("mt-1 min-w-0 space-y-0.5 text-xs text-muted-foreground", className)}>
      {xi ? <div>{xi}</div> : null}
      {tape.length > 0 ? (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
          {tape.map((row, i) => (
            <span key={`${row.kind}-${row.minute}-${i}`} className="inline-flex items-center gap-0.5">
              <TapeIcon kind={row.kind} />
              {formatTapeLine(row, event)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
