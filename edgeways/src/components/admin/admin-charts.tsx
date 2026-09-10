import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/help/empty-state";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatPeriodDelta,
  formatUtcDayLabel,
  shareTotal,
  type AdminChartTone,
  type ComparePeriod,
  type DayCount,
  type PeriodCompare,
  type ShareSlice,
} from "@/lib/admin/series";
import { sectionTitle } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

const WIDTH = 600;
const HEIGHT = 160;
const BAR_GAP = 3;
const DONUT_R = 34;
const DONUT_C = 2 * Math.PI * DONUT_R;

const FILL: Record<AdminChartTone, string> = {
  brand: "fill-brand/70",
  edge: "fill-edge/70",
  muted: "fill-muted-foreground/70",
  warning: "fill-warning",
  success: "fill-success",
  destructive: "fill-destructive",
  profit: "fill-profit/70",
};

const STROKE: Record<AdminChartTone, string> = {
  brand: "stroke-brand",
  edge: "stroke-edge",
  muted: "stroke-muted-foreground/70",
  warning: "stroke-warning",
  success: "stroke-success",
  destructive: "stroke-destructive",
  profit: "stroke-profit",
};

const SWATCH: Record<AdminChartTone, string> = {
  brand: "bg-brand/70",
  edge: "bg-edge/70",
  muted: "bg-muted-foreground/70",
  warning: "bg-warning",
  success: "bg-success",
  destructive: "bg-destructive",
  profit: "bg-profit/70",
};

const AREA: Record<AdminChartTone, string> = {
  brand: "fill-brand/20",
  edge: "fill-edge/20",
  muted: "fill-muted-foreground/20",
  warning: "fill-warning/20",
  success: "fill-success/20",
  destructive: "fill-destructive/20",
  profit: "fill-profit/20",
};

function defaultFormat(value: number): string {
  return value.toLocaleString("en-GB");
}

function seriesCaption(series: DayCount[]): string {
  if (series.length === 0) return "";
  return `${formatUtcDayLabel(series[0]!.day)} – ${formatUtcDayLabel(series[series.length - 1]!.day)}`;
}

export function AdminChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function AdminChartGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-[var(--layout-stack-gap)]">
      {children}
    </div>
  );
}

export function AdminBarChart({
  series,
  label,
  tone = "brand",
  formatValue = defaultFormat,
  className,
}: {
  series: DayCount[];
  label: string;
  tone?: AdminChartTone;
  formatValue?: (value: number) => string;
  className?: string;
}) {
  const maxUsed = Math.max(0, ...series.map((point) => point.used));
  const ceiling = Math.max(maxUsed, 1) * 1.15;
  const barWidth = series.length > 0
    ? (WIDTH - BAR_GAP * (series.length - 1)) / series.length
    : WIDTH;
  const yFor = (value: number) => HEIGHT - (value / ceiling) * HEIGHT;
  const today = series[series.length - 1]?.day;

  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}, last ${series.length} days.`}
        className="h-40 w-full rounded-md bg-muted/40"
      >
        {series.map((point, index) => {
          const barHeight = Math.max(
            point.used > 0 ? 2 : 0,
            HEIGHT - yFor(point.used)
          );
          return (
            <rect
              key={point.day}
              x={index * (barWidth + BAR_GAP)}
              y={HEIGHT - barHeight}
              width={barWidth}
              height={barHeight}
              rx={1.5}
              className={cn(
                FILL[tone],
                point.day === today && "stroke-foreground/40"
              )}
            >
              <title>{`${formatUtcDayLabel(point.day)}: ${formatValue(point.used)}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>{seriesCaption(series)}</span>
        <span>Peak {formatValue(maxUsed)}</span>
      </figcaption>
    </figure>
  );
}

export function AdminLineChart({
  series,
  label,
  tone = "brand",
  formatValue = defaultFormat,
  className,
}: {
  series: DayCount[];
  label: string;
  tone?: AdminChartTone;
  formatValue?: (value: number) => string;
  className?: string;
}) {
  const maxUsed = Math.max(0, ...series.map((point) => point.used));
  const ceiling = Math.max(maxUsed, 1) * 1.15;
  const last = series.length - 1;
  const xFor = (index: number) =>
    last <= 0 ? WIDTH / 2 : (index / last) * WIDTH;
  const yFor = (value: number) => HEIGHT - (value / ceiling) * HEIGHT;
  const line = series
    .map((point, index) => `${xFor(index).toFixed(2)},${yFor(point.used).toFixed(2)}`)
    .join(" ");
  const area =
    series.length === 0
      ? ""
      : `M 0 ${HEIGHT} L ${series
          .map((point, index) => `${xFor(index).toFixed(2)} ${yFor(point.used).toFixed(2)}`)
          .join(" L ")} L ${xFor(last)} ${HEIGHT} Z`;

  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}, last ${series.length} days.`}
        className="h-40 w-full rounded-md bg-muted/40"
      >
        {area ? <path d={area} className={AREA[tone]} /> : null}
        {line ? (
          <polyline
            fill="none"
            points={line}
            className={STROKE[tone]}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {series.map((point, index) => {
          const colWidth = series.length > 0 ? WIDTH / series.length : WIDTH;
          const x = Math.max(0, xFor(index) - colWidth / 2);
          return (
            <rect
              key={point.day}
              x={x}
              y={0}
              width={Math.min(colWidth, WIDTH - x)}
              height={HEIGHT}
              className="fill-transparent"
            >
              <title>{`${formatUtcDayLabel(point.day)}: ${formatValue(point.used)}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>{seriesCaption(series)}</span>
        <span>Now {formatValue(series[last]?.used ?? 0)}</span>
      </figcaption>
    </figure>
  );
}

export function AdminDonutChart({
  slices,
  label,
  formatValue = defaultFormat,
  emptyTitle = "Nothing to show yet",
  emptyDescription = "This mix appears here once there is something to count.",
  className,
}: {
  slices: ShareSlice[];
  label: string;
  formatValue?: (value: number) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}) {
  const total = shareTotal(slices);
  const drawable = slices.filter((slice) => slice.value > 0);
  let offset = 0;

  if (drawable.length === 0) {
    return (
      <EmptyState
        compact
        bare
        icon={BarChart3}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <figure
      className={cn(
        "flex flex-col items-center gap-4 sm:flex-row sm:items-center",
        className
      )}
    >
      <svg
        viewBox="0 0 100 100"
        role="img"
        aria-label={`${label}. Total ${formatValue(total)}.`}
        className="size-40 shrink-0"
      >
        <circle
          cx="50"
          cy="50"
          r={DONUT_R}
          fill="none"
          className="stroke-muted/80"
          strokeWidth="12"
        />
        {drawable.map((slice) => {
          const len = (slice.value / total) * DONUT_C;
          const dashOffset = offset;
          offset += len;
          return (
            <circle
              key={slice.key}
              cx="50"
              cy="50"
              r={DONUT_R}
              fill="none"
              className={STROKE[slice.tone]}
              strokeWidth="12"
              strokeDasharray={`${len} ${DONUT_C - len}`}
              strokeDashoffset={-dashOffset}
              transform="rotate(-90 50 50)"
            >
              <title>{`${slice.label}: ${formatValue(slice.value)}`}</title>
            </circle>
          );
        })}
        <text
          x="50"
          y="53"
          textAnchor="middle"
          className="fill-foreground text-xs font-bold"
        >
          {formatValue(total)}
        </text>
      </svg>
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
        {slices.map((slice) => {
          const pct = total === 0 ? 0 : Math.round((slice.value / total) * 100);
          return (
            <li
              key={slice.key}
              className="flex min-w-0 items-center justify-between gap-3 text-xs"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={cn("size-2 shrink-0 rounded-sm", SWATCH[slice.tone])}
                  aria-hidden
                />
                <span className="min-w-0 text-pretty break-words" title={slice.label}>
                  {slice.label}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatValue(slice.value)} · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

export function AdminShareBars({
  slices,
  formatValue = defaultFormat,
  emptyTitle = "Nothing to rank yet",
  emptyDescription = "Desks appear here after they record bets, sports offers, or casino campaigns.",
  className,
}: {
  slices: ShareSlice[];
  formatValue?: (value: number) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}) {
  const max = Math.max(0, ...slices.map((slice) => slice.value));

  if (slices.length === 0) {
    return (
      <EmptyState
        compact
        bare
        icon={BarChart3}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <ul className={cn("flex flex-col gap-2.5", className)}>
      {slices.map((slice) => {
        const width = max === 0 ? 0 : (slice.value / max) * 100;
        return (
          <li key={slice.key} className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
              <span className="min-w-0 text-pretty break-all" title={slice.label}>
                {slice.label}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatValue(slice.value)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", SWATCH[slice.tone])}
                style={{ width: `${width}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminCompareStrip({
  heading,
  items,
}: {
  heading?: string;
  items: Array<{
    label: string;
    compare: PeriodCompare;
    period: ComparePeriod;
    formatValue?: (value: number) => string;
  }>;
}) {
  const columns = (items.length >= 4 ? 4 : items.length === 3 ? 3 : 2) as
    | 2
    | 3
    | 4;
  return (
    <section className="flex flex-col gap-3">
      {heading ? <h2 className={sectionTitle}>{heading}</h2> : null}
      <StatStrip columns={columns}>
        {items.map((item) => {
          const format = item.formatValue ?? defaultFormat;
          return (
            <StatTile
              key={item.label}
              label={item.label}
              value={format(item.compare.current)}
              sub={formatPeriodDelta(item.compare, item.period)}
            />
          );
        })}
      </StatStrip>
    </section>
  );
}
