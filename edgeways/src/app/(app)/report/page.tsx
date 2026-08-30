"use client";

/**
 * Monthly Edge Report (B8) - cumulative expected edge (A3 locks) vs realised
 * net P&L, plus capture rate, commission drag, conversion retention and the
 * mistake ledger (B7). Tracking together = edge captured; diverging = a leak.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Liveline } from "liveline";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/help/page-header";
import { PageShell } from "@/components/page-shell";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/help/empty-state";
import { PageLoading } from "@/components/page-loading";
import { SeasonView } from "@/components/report/season-view";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, useAppState } from "@/hooks/use-app-state";
import { ALL_OWNERS, OwnerFilter } from "@/components/accounts/owner-filter";
import type { EdgeReport } from "@/lib/report/edge-report";
import { mistakeTagLabel } from "@/lib/offers/mistakes";
import { formatGbp } from "@/lib/format-money";
import { FilterPill } from "@/components/ui/filter-pill";
import { useLivelineHoverOutline } from "@/lib/ui/liveline-tooltip-outline";

/** Realised follows the P&L chart greens; expected uses the "estimated" sky. */
const SERIES_COLORS = {
  light: { expected: "#0369a1", realized: "#059669" },
  dark: { expected: "#38bdf8", realized: "#34d399" },
} as const;

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

export default function EdgeReportPage() {
  const { resolvedTheme } = useTheme();
  const { state } = useAppState(30_000);
  const [owner, setOwner] = useState(ALL_OWNERS);
  const [view, setView] = useState<"month" | "year">("month");
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState<string | null>(null);
  const [report, setReport] = useState<EdgeReport | null>(null);
  const [loading, setLoading] = useState(true);

  // Initial load shows the loading state; month switches keep the previous
  // report on screen until the new one arrives (no synchronous setState).
  useEffect(() => {
    let cancelled = false;
    const ownerQ = owner !== ALL_OWNERS ? `&owner=${encodeURIComponent(owner)}` : "";
    const query = `?${month ? `month=${month}` : ""}${ownerQ}`;
    api<{ months: string[]; report: EdgeReport | null }>(`/api/report${query}`)
      .then((r) => {
        if (cancelled) return;
        setMonths(r.months);
        setReport(r.report);
        if (!month && r.report) setMonth(r.report.month);
      })
      .catch(() => {
        if (!cancelled) setReport(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, owner]);

  const dark = resolvedTheme === "dark";
  const chartHostRef = useRef<HTMLDivElement>(null);
  useLivelineHoverOutline(chartHostRef, !dark);
  const colors = dark ? SERIES_COLORS.dark : SERIES_COLORS.light;

  const chart = useMemo(() => {
    if (report?.kind !== "ready" || report.cumulative.length === 0) return null;
    const expected = report.cumulative.map((p) => ({ time: p.t / 1000, value: p.expected }));
    const realized = report.cumulative.map((p) => ({ time: p.t / 1000, value: p.realized }));
    const first = report.cumulative[0]!.t / 1000;
    const last = report.cumulative.at(-1)!.t / 1000;
    return {
      expected,
      realized,
      windowSecs: Math.max(3600, Math.ceil((last - first) * 1.1)),
    };
  }, [report]);

  if (view === "month" && loading && !report) {
    return <PageLoading label="Loading Edge Report" />;
  }

  return (
    <PageShell className="gap-5">
      <PageHeader
        title="Edge Report"
        description="Expected edge versus actual profit."
        icon={BarChart3}
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <OwnerFilter
              accounts={state?.balances?.accounts ?? []}
              value={owner}
              onChange={setOwner}
            />
            <Tabs
              value={view}
              onValueChange={(v) => setView(v as "month" | "year")}
              activationMode="manual"
            >
              <TabsList variant="segmented">
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="year">Year</TabsTrigger>
              </TabsList>
            </Tabs>
            {view === "month" && months.length > 1 ? (
              <div className="flex flex-wrap gap-1.5">
                {months.map((m) => (
                  <FilterPill
                    key={m}
                    active={m === (month ?? report?.month)}
                    onClick={() => setMonth(m)}
                  >
                    {formatMonthLabel(m)}
                  </FilterPill>
                ))}
              </div>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-col gap-4 px-[var(--layout-page-x)] pb-[var(--layout-page-x)] sm:px-0 sm:pb-0">
        {view === "year" ? (
          <SeasonView owner={owner !== ALL_OWNERS ? owner : null} />
        ) : !report ? (
          <EmptyState
            icon={BarChart3}
            title="No settled campaigns yet"
            description="The Edge Report compares locked expected value against realised P&L. Settle a few offer campaigns and this page starts earning its keep."
            action={{ label: "View offers", href: "/offers" }}
          />
        ) : report.kind === "insufficient" ? (
          <EmptyState
            icon={BarChart3}
            title={`Not enough data for ${formatMonthLabel(report.month)}`}
            description={`${report.settledCampaigns} of ${report.minCampaigns} settled campaigns needed - a couple of noisy lines would mislead more than inform. Keep settling offers.`}
            action={{ label: "View offers", href: "/offers" }}
          />
        ) : report.kind === "profit_only" ? (
          <>
            <StatStrip columns={5}>
              <StatTile
                label="Profit"
                value={formatGbp(report.profit)}
                sub={`${report.settledBets} settled bet${report.settledBets === 1 ? "" : "s"}`}
              />
              <StatTile label="Expected" value="—" />
              <StatTile label="Realised" value="—" />
              <StatTile label="Capture rate" value="—" sub="realised ÷ expected" />
              <StatTile
                label="Commission drag"
                value={formatGbp(report.commissionDrag)}
                sub="ex. comm. paid"
              />
            </StatStrip>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Settled profit only</CardTitle>
                <CardDescription>
                  No EV locks in {formatMonthLabel(report.month)}, so capture cannot be
                  scored. The figure above is settled Profit Tracker P&L for the month,
                  the same number the year table uses.
                </CardDescription>
              </CardHeader>
            </Card>
          </>
        ) : (
          <>
            <StatStrip columns={5}>
              <StatTile
                label="Expected"
                value={formatGbp(report.totals.expected)}
                sub={`${report.settledCampaigns} campaigns`}
              />
              <StatTile label="Realised" value={formatGbp(report.totals.realized)} />
              <StatTile
                label="Capture rate"
                value={
                  report.totals.captureRate != null
                    ? `${Math.round(report.totals.captureRate * 100)}%`
                    : "-"
                }
                sub="realised ÷ expected"
              />
              <StatTile
                label="Commission drag"
                value={formatGbp(report.commissionDrag)}
                sub="ex. comm. paid"
              />
              <StatTile
                label="Retention"
                value={report.retention ? `${Math.round(report.retention.rate * 100)}%` : "-"}
                sub={
                  report.retention
                    ? `${report.retention.sampleSize} conversion${report.retention.sampleSize === 1 ? "" : "s"}`
                    : "no conversions this month"
                }
              />
            </StatStrip>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Expected vs realised</CardTitle>
                <CardDescription>
                  Expected steps up when a campaign locks; realised when it settles. A widening
                  gap is a leak - the mistake ledger below says which kind.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chart ? (
                  <div ref={chartHostRef} className="h-[18rem]">
                    <Liveline
                      key={resolvedTheme}
                      data={chart.realized}
                      value={chart.realized.at(-1)?.value ?? 0}
                      series={[
                        {
                          id: "expected",
                          data: chart.expected,
                          value: chart.expected.at(-1)?.value ?? 0,
                          color: colors.expected,
                          label: "Expected",
                        },
                        {
                          id: "realized",
                          data: chart.realized,
                          value: chart.realized.at(-1)?.value ?? 0,
                          color: colors.realized,
                          label: "Realised",
                        },
                      ]}
                      theme={dark ? "dark" : "light"}
                      color={colors.realized}
                      window={chart.windowSecs}
                      momentum={false}
                      pulse={false}
                      showValue={false}
                      referenceLine={{ value: 0 }}
                      formatValue={(v) => `£${v.toFixed(2)}`}
                      formatTime={(t) =>
                        new Date(t * 1000).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })
                      }
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Where the leak is</CardTitle>
                <CardDescription>
                  £ lost per mistake tag this month, from the one-tap post-mortem tags.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {report.mistakes.length === 0 ? (
                  <EmptyState
                    compact
                    icon={BarChart3}
                    title="No tagged mistakes this month"
                    description="Tag under-captured campaigns from their post-mortem line to build this up."
                    className="shadow-none"
                  />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {report.mistakes.map((m) => (
                      <li
                        key={`${m.month}-${m.tag}`}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{mistakeTagLabel(m.tag)}</span>
                        <span className="flex items-center gap-3 tabular-nums">
                          <span className="text-xs text-muted-foreground">
                            {m.count} campaign{m.count === 1 ? "" : "s"}
                          </span>
                          <span className="font-semibold text-negative">
                            −{formatGbp(m.lostGbp)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PageShell>
  );
}
