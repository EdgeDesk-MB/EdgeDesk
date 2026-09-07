"use client";

import { useState } from "react";
import { Activity } from "lucide-react";
import { AdminActivityDayStepper } from "@/components/admin/admin-activity-day-stepper";
import {
  AdminChartCard,
  AdminChartGrid,
  AdminDonutChart,
  AdminShareBars,
} from "@/components/admin/admin-charts";
import { AdminSection } from "@/components/admin/admin-section";
import { EmptyState } from "@/components/help/empty-state";
import { Button } from "@/components/ui/button";
import {
  londonYmd,
  resolveActivityMixDay,
} from "@/lib/admin/activity-day";
import type { ActivityMixCharts } from "@/lib/admin/activity-mix";
import { shareTotal } from "@/lib/admin/series";
import { sectionStack } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

const COUNTS_ONLY =
  "Rows created on this day. No selections, stakes, wallets, or P&L.";

function MixEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <EmptyState
      compact
      headingLevel={4}
      icon={Activity}
      title={title}
      description={description}
    />
  );
}

function BetHeadlineGrid({
  charts,
  sports = true,
}: {
  charts: ActivityMixCharts;
  sports?: boolean;
}) {
  return (
    <AdminChartGrid>
      <AdminChartCard
        title="Bet types"
        description="Qualifying, free bets, and the other desk types. Counts only."
      >
        <AdminDonutChart slices={charts.betTypes} label="Bet types" />
      </AdminChartCard>
      {sports ? (
        <AdminChartCard
          title="Sports on bets"
          description="From the linked event, then the bet, then the campaign, then the market. Counts only."
        >
          <AdminDonutChart slices={charts.betSports} label="Sports on bets" />
        </AdminChartCard>
      ) : (
        <AdminChartCard
          title="Bookmakers on bets"
          description="Bookie names on bet rows. Not wallets or balances."
        >
          <AdminShareBars
            slices={charts.betBookmakers}
            emptyTitle="No bookmakers yet"
            emptyDescription="Bookie names appear here after someone logs a bet."
          />
        </AdminChartCard>
      )}
    </AdminChartGrid>
  );
}

function syncDayUrl(ymd: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (ymd === londonYmd()) url.searchParams.delete("day");
  else url.searchParams.set("day", ymd);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export function AdminActivityMix({
  charts: initialCharts,
  variant = "full",
  day: initialDay,
}: {
  charts: ActivityMixCharts;
  variant?: "full" | "preview";
  day?: string;
}) {
  const [day, setDay] = useState(() => resolveActivityMixDay(initialDay));
  const [charts, setCharts] = useState(initialCharts);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function selectDay(next: string) {
    const resolved = resolveActivityMixDay(next);
    setDay(resolved);
    syncDayUrl(resolved);
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/activity-mix?date=${resolved}`);
      if (!res.ok) throw new Error("Could not load this day.");
      const data = (await res.json()) as { charts?: ActivityMixCharts };
      if (!data.charts) throw new Error("Could not load this day.");
      setCharts(data.charts);
    } catch {
      setError("Could not load this day. Try again.");
    } finally {
      setPending(false);
    }
  }

  const hasBets = shareTotal(charts.betTypes) > 0;
  const hasOffers = shareTotal(charts.offerTypes) > 0;
  const hasCasino = shareTotal(charts.casinoStatuses) > 0;

  if (variant === "preview") {
    if (!hasBets) return null;
    return (
      <AdminSection
        title="Fleet mix"
        description="Lifetime category counts. No selections, stakes, wallets, or P&L."
      >
        <BetHeadlineGrid charts={charts} sports={false} />
      </AdminSection>
    );
  }

  return (
    <AdminSection
      title="Categories"
      description="Bet types, sports, bookmakers, and the rest of the desk mix for this day. Counts only."
      action={
        <AdminActivityDayStepper
          day={day}
          onChange={selectDay}
          disabled={pending}
        />
      }
    >
      <div
        className={cn(sectionStack, pending && "pointer-events-none opacity-60")}
        aria-busy={pending}
      >
        {error ? (
          <p className="text-sm text-destructive" role="status">
            {error}{" "}
            <Button
              type="button"
              variant="link"
              className="h-auto px-0 text-sm"
              onClick={() => void selectDay(day)}
            >
              Try again
            </Button>
          </p>
        ) : null}
      <AdminSection
        headingLevel={3}
        title="Bets"
        description="How logged bets break down across every visible desk."
      >
        {hasBets ? (
          <div className="flex flex-col gap-4">
            <BetHeadlineGrid charts={charts} />
            <AdminChartGrid>
              <AdminChartCard
                title="On a campaign"
                description="Whether the bet is linked to a sports offer. Counts only."
              >
                <AdminDonutChart
                  slices={charts.betCampaigns}
                  label="Bets on a campaign"
                />
              </AdminChartCard>
              <AdminChartCard
                title="Edge vs mug"
                description="Mug bets are camouflage. Counts only."
              >
                <AdminDonutChart slices={charts.betPurposes} label="Edge vs mug" />
              </AdminChartCard>
            </AdminChartGrid>
            <AdminChartGrid>
              <AdminChartCard
                title="Bet status"
                description="Open versus settled outcomes. Counts of rows, not money."
              >
                <AdminDonutChart slices={charts.betStatuses} label="Bet status" />
              </AdminChartCard>
              <AdminChartCard
                title="How bets were logged"
                description="Typed, mobile quick log, or spreadsheet import. Counts only."
              >
                <AdminDonutChart
                  slices={charts.betSources}
                  label="How bets were logged"
                />
              </AdminChartCard>
            </AdminChartGrid>
            <AdminChartCard
              title="Bookmakers on bets"
              description="Bookie names on bet rows. Not wallets or balances."
            >
              <AdminShareBars slices={charts.betBookmakers} />
            </AdminChartCard>
          </div>
        ) : (
          <MixEmpty
            title="No bets on this day"
            description="Bet types, sports, and bookmakers appear here after someone logs a bet on the selected day."
          />
        )}
      </AdminSection>

      <AdminSection
        headingLevel={3}
        title="Offers"
        description="How sports offers break down across every visible desk."
      >
        {hasOffers ? (
          <div className="flex flex-col gap-4">
            <AdminChartGrid>
              <AdminChartCard title="Sports on offers" description={COUNTS_ONLY}>
                <AdminDonutChart
                  slices={charts.offerSports}
                  label="Sports on offers"
                />
              </AdminChartCard>
              <AdminChartCard
                title="Offer types"
                description="Place refund, promo terms, or unset. Counts only."
              >
                <AdminDonutChart slices={charts.offerTypes} label="Offer types" />
              </AdminChartCard>
            </AdminChartGrid>
            <AdminChartGrid>
              <AdminChartCard
                title="Offer status"
                description="Planned, active, completed, expired. Counts only."
              >
                <AdminDonutChart slices={charts.offerStatuses} label="Offer status" />
              </AdminChartCard>
              <AdminChartCard
                title="How offers were added"
                description="Typed in the desk or landed from email intake. Counts only."
              >
                <AdminDonutChart
                  slices={charts.offerSources}
                  label="How offers were added"
                />
              </AdminChartCard>
            </AdminChartGrid>
            <AdminChartCard
              title="Bookmakers on offers"
              description="Bookie names on offer rows. Not wallets or balances."
            >
              <AdminShareBars slices={charts.offerBookmakers} />
            </AdminChartCard>
          </div>
        ) : (
          <MixEmpty
            title="No offers on this day"
            description="Offer types, sports, and bookmakers appear here after someone adds a campaign on the selected day."
          />
        )}
      </AdminSection>

      <AdminSection
        headingLevel={3}
        title="Casino"
        description="Casino campaign counts only. Not bonuses, wagering, or P&L."
      >
        {hasCasino ? (
          <AdminChartGrid>
            <AdminChartCard
              title="Casinos"
              description="Brand names on casino campaigns. Counts only."
            >
              <AdminShareBars slices={charts.casinoBrands} />
            </AdminChartCard>
            <AdminChartCard
              title="Casino status"
              description="Planned, active, completed, expired. Counts only."
            >
              <AdminDonutChart
                slices={charts.casinoStatuses}
                label="Casino status"
              />
            </AdminChartCard>
          </AdminChartGrid>
        ) : (
          <MixEmpty
            title="No casino campaigns on this day"
            description="Casino brands and status appear here after someone adds a campaign on the selected day."
          />
        )}
      </AdminSection>
      </div>
    </AdminSection>
  );
}
