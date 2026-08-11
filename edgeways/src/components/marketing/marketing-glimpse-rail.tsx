"use client";

import { BOLT_PATH } from "@/lib/brand/bolt-mark";
import { moneyPositiveClass } from "@/components/money-flow";
import { ScrollFadeEdges } from "@/components/ui/scroll-fade-edges";
import { cn } from "@/lib/utils";

function GlimpseFrame({
  label,
  caption,
  children,
  className,
}: {
  label: string;
  caption: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "marketing-panel flex min-w-[280px] max-w-sm flex-1 flex-col rounded-[var(--radius-button)] sm:min-w-0 sm:max-w-none",
        className
      )}
    >
      <span className="marketing-panel-shine" aria-hidden />
      <div className="border-b border-white/10 px-4 py-2.5">
        <p className="text-xs font-medium uppercase tracking-wide text-white/55">
          {label}
        </p>
      </div>
      <div className="flex-1 px-4 py-4" aria-hidden>
        {children}
      </div>
      <figcaption className="border-t border-white/10 px-4 py-3 text-sm leading-snug text-white/55">
        {caption}
      </figcaption>
    </figure>
  );
}

function PipelineChip({
  label,
  active = false,
}: {
  label: string;
  active?: boolean;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium",
        active
          ? "bg-[var(--marketing-brand)] text-[var(--marketing-ink)]"
          : "bg-white/5 text-white/55"
      )}
    >
      {label}
    </span>
  );
}

function AlertBolt() {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--marketing-brand)]"
      aria-hidden
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className="size-5"
      >
        <path d={BOLT_PATH} fill="var(--marketing-ink)" />
      </svg>
    </span>
  );
}

/** Cropped product peeks, not full screens. Synced border shine via CSS. */
export function MarketingGlimpseRail() {
  return (
    <ScrollFadeEdges
      orientation="horizontal"
      dragToScroll
      className="marketing-glimpse-rail"
      fadeClassName="from-[var(--marketing-band)]"
      fadeSize={40}
      scrollClassName="flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3"
    >
      <GlimpseFrame
        label="Daily plan"
        caption="Offers, races, fixtures. One day, one list."
      >
        <ul className="space-y-2.5 text-left text-sm">
          {[
            { t: "13:05", line: "Sky Bet · £10 qualifier" },
            { t: "14:20", line: "Newbury · EW lay" },
            { t: "15:00", line: "Chelsea v Arsenal track" },
          ].map((row) => (
            <li
              key={row.t}
              className="flex items-baseline gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0"
            >
              <span className="w-12 shrink-0 font-sans text-xs tabular-nums text-white/55">
                {row.t}
              </span>
              <span className="min-w-0 flex-1 truncate text-white/85">
                {row.line}
              </span>
            </li>
          ))}
        </ul>
      </GlimpseFrame>

      <GlimpseFrame
        label="Offer pipeline"
        caption="Planned to settled. Free bets stop stalling."
      >
        <div className="flex flex-wrap gap-1.5">
          <PipelineChip label="Planned" />
          <PipelineChip label="Qualifying" active />
          <PipelineChip label="Awaiting" />
          <PipelineChip label="Free bet" />
          <PipelineChip label="Settled" />
        </div>
        <p className="mt-4 text-left text-sm text-white/70">
          Coral · Acca insurance
        </p>
        <p className="mt-1 text-left font-sans text-xs tabular-nums text-white/55">
          Next: place free bet by Fri 18:00
        </p>
      </GlimpseFrame>

      <GlimpseFrame
        label="Racing Desk"
        caption="Live, mixed or estimate. Confidence you can act on."
      >
        <div className="text-left">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-white">
              Newbury{" "}
              <span className="font-sans tabular-nums">14:20</span>
            </p>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
              Live
            </span>
          </div>
          <p className="mt-3 text-sm text-white/80">Thunder Path</p>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <span className="text-xs text-white/55">Lay stake</span>
            <span className="font-sans text-sm tabular-nums text-white">
              £18.40
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <span className="text-xs text-white/55">Confidence</span>
            <span className="text-xs font-medium text-[var(--marketing-brand)]">
              High
            </span>
          </div>
        </div>
      </GlimpseFrame>

      <GlimpseFrame
        label="Edge Report"
        caption="Expected versus realised. After commission."
      >
        <div className="space-y-3 text-left text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-white/55">Expected</span>
            <span
              className={cn(
                "font-sans font-bold tabular-nums text-emerald-400",
                moneyPositiveClass
              )}
            >
              +£14.00
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-white/55">Realised</span>
            <span
              className={cn(
                "font-sans font-bold tabular-nums text-emerald-400",
                moneyPositiveClass
              )}
            >
              +£12.40
            </span>
          </div>
          <div className="h-px bg-white/10" />
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-white/55">Captured</span>
            <span className="font-semibold tabular-nums text-white">83%</span>
          </div>
        </div>
      </GlimpseFrame>

      <GlimpseFrame
        label="Balances"
        caption="Top up before the edge expires."
      >
        <div className="space-y-3 text-left text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-white/70">Betfair</span>
            <span className="font-sans tabular-nums text-white">£42.10</span>
          </div>
          <div className="rounded-md border border-[color-mix(in_srgb,var(--marketing-brand)_35%,transparent)] bg-[color-mix(in_srgb,var(--marketing-brand)_10%,transparent)] px-3 py-2">
            <p className="text-xs font-medium text-[var(--marketing-brand)]">
              Needs £25
            </p>
            <p className="mt-0.5 text-xs text-white/55">
              Unlocks Sky Bet free bet convert
            </p>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-white/70">Sky Bet</span>
            <span className="font-sans tabular-nums text-white">£10.00 FB</span>
          </div>
        </div>
      </GlimpseFrame>

      <GlimpseFrame
        label="Alerts"
        caption="Exposure, 2UP, expiry. Push lands with the desk closed."
      >
        <div className="rounded-xl border border-white/10 bg-[var(--marketing-panel-inset)] p-3 text-left shadow-lg">
          <div className="flex items-start gap-3">
            <AlertBolt />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">
                Naked exposure
              </p>
              <p className="mt-0.5 text-xs leading-snug text-white/55">
                Sky Bet back is open. Lay still missing on Betfair.
              </p>
            </div>
          </div>
        </div>
      </GlimpseFrame>
    </ScrollFadeEdges>
  );
}
