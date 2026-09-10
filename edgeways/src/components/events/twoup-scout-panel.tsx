"use client";

import { EmptyState } from "@/components/help/empty-state";
import { TwoupEdgeMark } from "@/components/events/twoup-openness-meter";
import { FootballIcon } from "@/components/sport-icon";
import { DialogExplainer } from "@/components/ui/dialog";
import {
  TWOUP_TIER_SHORT,
  twoupFailIn,
  twoupIsEdgePick,
  twoupSideTierFromPct,
  type TwoupOpennessResult,
  type TwoupOpennessTier,
} from "@/lib/calc/ep/twoup-openness";
import { formatDecimalOdds as formatExchangeOdds } from "@/lib/racing/odds";
import {
  captionHeading,
  qualifyPanel,
  quietPanel,
  sectionTitle,
  TWOUP_FIT_WORD_TONE,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

function missingFigure(): string {
  return "–";
}

function displayOdds(odds: number | undefined): string {
  const formatted = formatExchangeOdds(odds);
  return formatted === "-" ? missingFigure() : formatted;
}

function failLabel(failIn?: number): string {
  return failIn != null ? `1 in ${failIn}` : missingFigure();
}

function pctLabel(value?: number): string {
  return value != null ? `${value}%` : missingFigure();
}

function CompareCell({
  value,
  take,
}: {
  value: string;
  take: boolean;
}) {
  return (
    <p
      className={cn(
        "min-w-0 text-pretty break-words text-sm tabular-nums",
        take ? "font-semibold text-foreground" : "text-muted-foreground"
      )}
    >
      {value}
    </p>
  );
}

function PriceCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className={cn(captionHeading, "min-w-0 text-pretty break-words")}>{label}</p>
      <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">{value}</p>
    </div>
  );
}

function ColHead({ side, take }: { side: string; take: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        captionHeading,
        "min-w-0 pb-2 text-left text-pretty break-words",
        take ? "text-primary-text" : null
      )}
    >
      {side}
    </th>
  );
}

function RowStub({ children }: { children: string }) {
  return (
    <th
      scope="row"
      className={cn(
        captionHeading,
        "min-w-0 py-1 pr-3 text-left align-baseline text-pretty break-words"
      )}
    >
      {children}
    </th>
  );
}

export function TwoupScoutPanel({
  homeTeam,
  awayTeam,
  result,
  loading = false,
  error = false,
  onRetry,
}: {
  homeTeam: string;
  awayTeam: string;
  result?: TwoupOpennessResult | null;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  const openness = result ?? {
    tier: "unknown" as const,
    score01: 0,
    reasons: [],
    markets: {},
  };

  if (loading) {
    return (
      <EmptyState
        bare
        compact
        oneLine
        busy
        title="Loading 2UP take"
        description="Over 2.5, BTTS, and match odds from the exchange."
      />
    );
  }

  if (error) {
    return (
      <EmptyState
        bare
        compact
        oneLine
        icon={FootballIcon}
        title="Could not load 2UP take"
        description="Check the connection, then try again."
        action={
          onRetry
            ? {
                label: "Try again",
                onClick: onRetry,
              }
            : undefined
        }
      />
    );
  }

  const homeTier = twoupSideTierFromPct(openness.windfallHomePct);
  const awayTier = twoupSideTierFromPct(openness.windfallAwayPct);
  const hasSides = homeTier !== "unknown" || awayTier !== "unknown";

  if (openness.tier === "unknown" && !hasSides) {
    return (
      <EmptyState
        bare
        compact
        oneLine
        icon={FootballIcon}
        title="No exchange prices yet"
        description="Need Over 2.5 or BTTS on the exchange before we can score this."
      />
    );
  }

  const homeTake = openness.pick === "home";
  const awayTake = openness.pick === "away";
  const takeName = homeTake ? homeTeam : awayTake ? awayTeam : null;
  const takeTier: TwoupOpennessTier = homeTake ? homeTier : awayTake ? awayTier : "unknown";
  const takeWindfall = homeTake
    ? openness.windfallHomePct
    : awayTake
      ? openness.windfallAwayPct
      : undefined;
  const takeFit = TWOUP_TIER_SHORT[takeTier];
  const edgeTake = Boolean(takeName && twoupIsEdgePick(takeTier));
  const skipMatch = !takeName || takeTier === "skip";
  const takeLine = [
    takeFit && takeFit !== "Skip" ? `${takeFit} take` : null,
    takeWindfall != null ? `Pays in ${takeWindfall}% of matches` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const homeFailIn =
    openness.twoUpHomePct != null && openness.windfallHomePct != null
      ? twoupFailIn(openness.twoUpHomePct, openness.windfallHomePct) ?? undefined
      : undefined;
  const awayFailIn =
    openness.twoUpAwayPct != null && openness.windfallAwayPct != null
      ? twoupFailIn(openness.twoUpAwayPct, openness.windfallAwayPct) ?? undefined
      : undefined;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col justify-between gap-3">
      <div className={cn(edgeTake ? qualifyPanel : quietPanel, "min-w-0 px-3 py-2.5")}>
        <div className="flex min-w-0 items-start gap-1">
          <p className={cn(sectionTitle, "flex-1")}>
            {skipMatch ? "Skip this match" : `Take 2UP on ${takeName}`}
          </p>
          {edgeTake ? <TwoupEdgeMark /> : null}
          <DialogExplainer title="2UP verdict" label="What the verdict means">
            2UP pays when that side goes two ahead and then fails to win. That is the only result that pays the bookie and the lay. Win prices sit under the team names at the top. The take is the team in the verdict, and the heavier column. Strong and Fair are Edge picks. Weak means it rarely pays. Skip means leave it.
          </DialogExplainer>
        </div>
        {takeLine ? (
          <p
            className={cn(
              "mt-1 text-pretty break-words text-sm font-medium",
              TWOUP_FIT_WORD_TONE[takeTier]
            )}
          >
            {takeLine}
          </p>
        ) : null}
      </div>

      <table className="w-full min-w-0 table-fixed border-collapse">
        <caption className="sr-only">
          Home {homeTeam} against away {awayTeam}
        </caption>
        <colgroup>
          <col className="w-[38%]" />
          <col className="w-[31%]" />
          <col className="w-[31%]" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="min-w-0 pb-2 pr-3 text-left">
              <span className="sr-only">Rate</span>
            </th>
            <ColHead side="Home" take={homeTake} />
            <ColHead side="Away" take={awayTake} />
          </tr>
        </thead>
        <tbody>
          <tr>
            <RowStub>2UP pays</RowStub>
            <td className="min-w-0 py-1 align-baseline">
              <CompareCell value={pctLabel(openness.windfallHomePct)} take={homeTake} />
            </td>
            <td className="min-w-0 py-1 align-baseline">
              <CompareCell value={pctLabel(openness.windfallAwayPct)} take={awayTake} />
            </td>
          </tr>
          <tr>
            <RowStub>Go two ahead</RowStub>
            <td className="min-w-0 py-1 align-baseline">
              <CompareCell value={pctLabel(openness.twoUpHomePct)} take={homeTake} />
            </td>
            <td className="min-w-0 py-1 align-baseline">
              <CompareCell value={pctLabel(openness.twoUpAwayPct)} take={awayTake} />
            </td>
          </tr>
          <tr>
            <RowStub>Fail from 2 up</RowStub>
            <td className="min-w-0 py-1 align-baseline">
              <CompareCell value={failLabel(homeFailIn)} take={homeTake} />
            </td>
            <td className="min-w-0 py-1 align-baseline">
              <CompareCell value={failLabel(awayFailIn)} take={awayTake} />
            </td>
          </tr>
        </tbody>
      </table>

      <div>
        <div className="flex min-w-0 items-center gap-1">
          <p className={cn(captionHeading, "min-w-0 flex-1")}>Markets</p>
          <DialogExplainer title="Markets" label="What the markets mean">
            Over 2.5 and BTTS (both teams to score) should be short, about 1.50 or under, if the game is open enough for 2UP. Win prices sit under the team names at the top. A take usually sits around 1.70 to 2.30. xG is the model total, not an exchange price.
          </DialogExplainer>
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-x-3 gap-y-2">
          <PriceCell label="Over 2.5" value={displayOdds(openness.markets.over25)} />
          <PriceCell label="BTTS" value={displayOdds(openness.markets.btts)} />
          <PriceCell
            label="xG"
            value={
              openness.modelXg != null ? openness.modelXg.toFixed(1) : missingFigure()
            }
          />
        </div>
      </div>
    </div>
  );
}
