import {
  FEED_WARNING_RATIO,
  feedThresholdState,
  type FeedUsageDayPoint,
} from "@/lib/admin/feed-monitor";
import { cn } from "@/lib/utils";

const WIDTH = 600;
const HEIGHT = 160;
const BAR_GAP = 3;

const STATE_BAR_CLASS = {
  ok: "fill-brand/70",
  warning: "fill-warning",
  critical: "fill-destructive",
} as const;

function dayLabel(day: string): string {
  // YYYY-MM-DD → "14 Aug" (UTC-safe: parse parts, never Date.parse)
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * 30-day daily request volume against the feed's cap. Server-rendered SVG —
 * the admin monitor needs no client JS. Bars colour by threshold state so a
 * glance shows how close each day ran to the ceiling; dashed lines mark the
 * 70% warning level and the cap itself.
 */
export function FeedUsageChart({
  history,
  cap,
  label,
  className,
}: {
  history: FeedUsageDayPoint[];
  cap: number;
  /** Accessible name, e.g. "Football". */
  label: string;
  className?: string;
}) {
  const maxUsed = Math.max(0, ...history.map((point) => point.used));
  const ceiling = Math.max(cap, maxUsed, 1) * 1.15;
  const barWidth = (WIDTH - BAR_GAP * (history.length - 1)) / history.length;
  const yFor = (value: number) => HEIGHT - (value / ceiling) * HEIGHT;
  const capY = yFor(cap);
  const warningY = yFor(cap * FEED_WARNING_RATIO);
  const today = history[history.length - 1]?.day;

  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label} daily requests, last ${history.length} days. Cap ${cap} per day.`}
        className="h-40 w-full rounded-md bg-muted/40"
      >
        {/* Warning band: 70% → cap */}
        <rect
          x={0}
          y={capY}
          width={WIDTH}
          height={Math.max(0, warningY - capY)}
          className="fill-warning/10"
        />
        {/* Critical band: cap → top */}
        <rect x={0} y={0} width={WIDTH} height={capY} className="fill-destructive/5" />
        {history.map((point, index) => {
          const state = feedThresholdState(point.used, cap);
          const barHeight = Math.max(point.used > 0 ? 2 : 0, HEIGHT - yFor(point.used));
          return (
            <rect
              key={point.day}
              x={index * (barWidth + BAR_GAP)}
              y={HEIGHT - barHeight}
              width={barWidth}
              height={barHeight}
              rx={1.5}
              className={cn(
                STATE_BAR_CLASS[state],
                point.day === today && "stroke-foreground/40"
              )}
            >
              <title>
                {dayLabel(point.day)}: {point.used.toLocaleString("en-GB")} requests
              </title>
            </rect>
          );
        })}
        {/* 70% warning line */}
        <line
          x1={0}
          x2={WIDTH}
          y1={warningY}
          y2={warningY}
          className="stroke-warning"
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.6}
        />
        {/* Cap line */}
        <line
          x1={0}
          x2={WIDTH}
          y1={capY}
          y2={capY}
          className="stroke-destructive"
          strokeWidth={1.5}
          strokeDasharray="6 3"
        />
      </svg>
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          {history.length > 0 ? dayLabel(history[0].day) : ""} –{" "}
          {history.length > 0 ? dayLabel(history[history.length - 1].day) : ""}
        </span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-warning" aria-hidden />
            Watch {Math.round(cap * FEED_WARNING_RATIO).toLocaleString("en-GB")}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 bg-destructive" aria-hidden />
            Cap {cap.toLocaleString("en-GB")}/day
          </span>
        </span>
      </figcaption>
    </figure>
  );
}
