"use client";

/**
 * Season summary (G3) - the year, month by month. Pre-capture months show
 * their profit but a dash for EV columns, with the coverage window stated
 * plainly instead of implying a 100% capture that was never measured.
 */

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/help/empty-state";
import { MoneyFlow } from "@/components/money-flow";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { api } from "@/hooks/use-app-state";
import type { SeasonReport } from "@/lib/report/season-report";
import { formatGbp } from "@/lib/format-money";
import { FilterPill } from "@/components/ui/filter-pill";

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString("en-GB", { month: "short" });
}

function pct(v: number | null): string {
  return v != null ? `${Math.round(v * 100)}%` : "–";
}

export function SeasonView({ owner }: { owner?: string | null } = {}) {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [season, setSeason] = useState<SeasonReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const query = year != null ? `&year=${year}` : "";
    api<{ years: number[]; season: SeasonReport | null }>(`/api/report?view=year${query}${owner ? `&owner=${encodeURIComponent(owner)}` : ""}`)
      .then((r) => {
        if (cancelled) return;
        setYears(r.years);
        setSeason(r.season);
        if (year == null && r.season) setYear(r.season.year);
      })
      .catch(() => {
        if (!cancelled) setSeason(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, owner]);

  if (loading && !season) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Building season…</p>;
  }
  if (!season) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No settled season yet"
        description="Once bets settle, the year builds itself here, month by month."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {years.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {years.map((y) => (
            <FilterPill key={y} active={y === season.year} onClick={() => setYear(y)}>
              {y}
            </FilterPill>
          ))}
        </div>
      ) : null}

      <StatStrip columns={5}>
        <StatTile
          label="Profit"
          value={formatGbp(season.totals.profit)}
          sub={`${season.year} settled`}
        />
        <StatTile label="Expected" value={formatGbp(season.totals.expected)} />
        <StatTile label="Realised" value={formatGbp(season.totals.realized)} />
        <StatTile
          label="Capture rate"
          value={pct(season.totals.captureRate)}
          sub="realised ÷ expected"
        />
        <StatTile
          label="Commission drag"
          value={formatGbp(season.totals.commissionDrag)}
          sub="ex. comm. paid"
        />
      </StatStrip>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Month by month</CardTitle>
          <CardDescription>
            {season.captureFrom
              ? `EV capture measured from ${monthLabel(season.captureFrom)} ${season.captureFrom.slice(0, 4)} - earlier months show settled profit only.`
              : "No EV locks this year - the table shows settled profit only."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Mobile: card list (C2 - tables become cards < sm) */}
          <div className="sm:hidden">
            {season.months.map((m) => (
              <div key={m.month} className="border-b border-border/60 px-1 py-3">
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">
                    {monthLabel(m.month)} {m.month.slice(0, 4)}
                  </span>
                  <MoneyFlow
                    value={m.profit}
                    signColor
                    signDisplay
                    className="shrink-0 text-base font-semibold tabular-nums"
                  />
                </span>
                <span className="mt-1 block text-xs tabular-nums text-muted-foreground">
                  {m.expected != null
                    ? `Expected ${formatGbp(m.expected)} → realised ${formatGbp(m.realized ?? 0)} · ${pct(m.captureRate)} captured`
                    : "Pre-capture history"}
                  {m.retention ? ` · retention ${pct(m.retention.rate)}` : ""}
                </span>
              </div>
            ))}
          </div>

          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Realised</TableHead>
                  <TableHead className="text-right">Capture</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Retention</TableHead>
                  <TableHead className="text-right">Bets</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {season.months.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell className="font-medium font-semibold">
                      {monthLabel(m.month)} {m.month.slice(0, 4)}
                    </TableCell>
                     <TableCell className="text-right tabular-nums font-semibold">
                       <MoneyFlow value={m.profit} signColor signDisplay />
                     </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.expected != null ? formatGbp(m.expected) : "–"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.realized != null ? formatGbp(m.realized) : "–"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{pct(m.captureRate)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatGbp(m.commissionDrag)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.retention ? pct(m.retention.rate) : "–"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.settledBets}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {season.bestBookie ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bookmakers this year</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <span className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">
                Best · {season.bestBookie.bookmaker} ({season.bestBookie.settledBets} bet
                {season.bestBookie.settledBets === 1 ? "" : "s"})
              </span>
              <MoneyFlow value={season.bestBookie.profit} signColor signDisplay className="font-semibold" />
            </span>
            {season.worstBookie ? (
              <span className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">
                  Worst · {season.worstBookie.bookmaker} ({season.worstBookie.settledBets} bet
                  {season.worstBookie.settledBets === 1 ? "" : "s"})
                </span>
                <MoneyFlow value={season.worstBookie.profit} signColor signDisplay className="font-semibold" />
              </span>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
