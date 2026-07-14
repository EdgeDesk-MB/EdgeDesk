"use client";

/**
 * Monthly Edge Report (B8) - cumulative expected edge (A3 locks) vs realised
 * net P&L, plus capture rate, commission drag, conversion retention and the
 * mistake ledger (B7). Tracking together = edge captured; diverging = a leak.
 */

import { useEffect, useMemo, useState } from "react";
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
import { api } from "@/hooks/use-app-state";
import type { EdgeReport } from "@/lib/report/edge-report";
import { mistakeTagLabel } from "@/lib/offers/mistakes";
import { formatGbp } from "@/lib/format-money";
import { filterPillState } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

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
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState<string | null>(null);
  const [report, setReport] = useState<EdgeReport | null>(null);
  const [loading, setLoading] = useState(true);

  // Initial load shows the loading state; month switches keep the previous
  // report on screen until the new one arrives (no synchronous setState).
  useEffect(() => {
    let cancelled = false;
    const query = month ? `?month=${month}` : "";
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
  }, [month]);

  const dark = resolvedTheme === "dark";
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

  return (
    <PageShell className="gap-5">
      <PageHeader
        title="Edge Report"
        description="Cumulative expected edge vs realised P&L - tracking together means you're capturing your edge."
        icon={BarChart3}
        toolbar={
          months.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {months.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={cn(filterPillState(m === (month ?? report?.month)))}
                  onClick={() => setMonth(m)}
                >
                  {formatMonthLabel(m)}
                </button>
              ))}
            </div>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-4 px-[var(--layout-page-x)] pb-[var(--layout-page-x)] sm:px-0 sm:pb-0">
        {loading && !report ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Building report…</p>
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
                sub="exchange commission paid"
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
                  <div className="h-[18rem]">
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
                  <p className="text-sm text-muted-foreground">
                    No tagged mistakes this month - tag under-captured campaigns from their
                    post-mortem line to build this up.
                  </p>
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
