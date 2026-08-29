import { Activity } from "lucide-react";
import {
  AdminChartCard,
  AdminChartGrid,
  AdminDonutChart,
  AdminShareBars,
} from "@/components/admin/admin-charts";
import { AdminSection } from "@/components/admin/admin-section";
import { EmptyState } from "@/components/help/empty-state";
import type { ActivityMixCharts } from "@/lib/admin/activity-mix";
import { shareTotal } from "@/lib/admin/series";

const COUNTS_ONLY =
  "Lifetime row counts. No selections, stakes, wallets, or P&L.";

function MixEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <EmptyState compact icon={Activity} title={title} description={description} />
  );
}

function BetHeadlineGrid({ charts }: { charts: ActivityMixCharts }) {
  return (
    <AdminChartGrid>
      <AdminChartCard
        title="Bet types"
        description="Qualifying, free bets, and the other desk types. Counts only."
      >
        <AdminDonutChart slices={charts.betTypes} label="Bet types" />
      </AdminChartCard>
      <AdminChartCard title="Sports on bets" description={COUNTS_ONLY}>
        <AdminDonutChart slices={charts.betSports} label="Sports on bets" />
      </AdminChartCard>
    </AdminChartGrid>
  );
}

export function AdminActivityMix({
  charts,
  variant = "full",
}: {
  charts: ActivityMixCharts;
  variant?: "full" | "preview";
}) {
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
        <BetHeadlineGrid charts={charts} />
      </AdminSection>
    );
  }

  return (
    <>
      <AdminSection
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
            title="No bets yet"
            description="Bet types, sports, and bookmakers appear here after someone logs a bet."
          />
        )}
      </AdminSection>

      <AdminSection
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
            title="No offers yet"
            description="Offer types, sports, and bookmakers appear here after someone adds a campaign."
          />
        )}
      </AdminSection>

      {hasCasino ? (
        <AdminSection
          title="Casino"
          description="Casino campaign counts only. Not bonuses, wagering, or P&L."
        >
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
        </AdminSection>
      ) : null}
    </>
  );
}
