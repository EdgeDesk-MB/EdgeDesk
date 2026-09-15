"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/help/empty-state";
import { PageHeader } from "@/components/help/page-header";
import { PageLoading } from "@/components/page-loading";
import { PageShell } from "@/components/page-shell";
import { PlanLockEmpty } from "@/components/plan-lock-empty";
import { StatStrip, StatTile } from "@/components/layout/stat-strip";
import { FixtureBrowserContent } from "@/components/events/fixture-browser";
import { AddBetDialog } from "@/components/add-bet-dialog";
import { TwoUpActiveBets } from "@/components/twoup/two-up-active-bets";
import { TwoUpBookieDialog } from "@/components/twoup/two-up-bookie-dialog";
import { TwoUpPlaybookDialog, TwoUpWorkbench } from "@/components/twoup/two-up-workbench";
import { canDesk } from "@/lib/entitlements/effective-plan";
import { canUseTwoupScout } from "@/lib/entitlements/twoup-scout";
import {
  epDeskFixtureSearch,
  parseEpDeskFixtureQuery,
  TWOUP_DESK_PATH,
} from "@/lib/calc/ep/fixture-query";
import { api, useAppState } from "@/hooks/use-app-state";
import { useBookieAccounts } from "@/hooks/use-bookie-accounts";
import { useBookieScopes } from "@/hooks/use-bookie-scopes";
import type { BetRow, EventRow } from "@/lib/db/schema";
import type { Fixture } from "@/components/events/types";
import { footballBooksForLead } from "@/lib/twoup/bookie-offers";
import {
  canOpenFootballEpModel,
  isTwoUpBet,
  parseTwoUpDeskView,
  type TwoUpDeskViewId,
} from "@/lib/twoup/desk-view";
import { FootballIcon } from "@/components/sport-icon";
import { Flag, Settings2, Timer } from "lucide-react";

export function TwoUpDeskView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, refresh } = useAppState(5000);
  const { options: bookieWallets, accounts: bookieAccounts, loaded: walletsLoaded } =
    useBookieAccounts();
  const walletNames = useMemo(
    () => bookieWallets.map((wallet) => wallet.name),
    [bookieWallets]
  );
  const fixtureQuery = parseEpDeskFixtureQuery({
    home: searchParams?.get("home"),
    away: searchParams?.get("away"),
    start: searchParams?.get("start"),
    tab: searchParams?.get("tab"),
  });
  const viewFromUrl = searchParams?.get("view");
  const [deskTab, setDeskTab] = useState<TwoUpDeskViewId>(() =>
    fixtureQuery ? "model" : parseTwoUpDeskView(viewFromUrl)
  );
  const { setup: bookieSelection, persistSetup } = useBookieScopes({
    walletNames,
    walletsLoaded,
  });
  const [bookiesOpen, setBookiesOpen] = useState(false);
  const [playbookOpen, setPlaybookOpen] = useState(false);
  const [manualModel, setManualModel] = useState(false);
  const [picksCount, setPicksCount] = useState<number | null>(null);
  const [editingBet, setEditingBet] = useState<BetRow | null>(null);

  const deskEvents = useMemo(
    () =>
      (state?.events ?? []).filter(
        (event) => (event.sport ?? "football") !== "horse_racing"
      ),
    [state?.events]
  );
  const openTwoUpBets = useMemo(
    () =>
      (state?.bets ?? []).filter(
        (bet) => bet.status === "open" && isTwoUpBet(bet)
      ),
    [state?.bets]
  );
  const trackedCount = deskEvents.filter(
    (event) => event.status === "upcoming" || event.status === "live"
  ).length;
  const canScout = canUseTwoupScout(state?.settings);
  const showEdgeTwoUpPromo =
    state != null &&
    (!canDesk(state.settings, "push_alerts") ||
      !canDesk(state.settings, "exchange_lay"));

  function writeDeskUrl(next: {
    view?: TwoUpDeskViewId;
    fixture?: { home: string; away: string; startTime?: number; tab?: string };
    clearFixture?: boolean;
  }) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    const view = next.view ?? deskTab;
    if (view === "fixtures") params.delete("view");
    else params.set("view", view);
    if (next.clearFixture) {
      params.delete("home");
      params.delete("away");
      params.delete("start");
      params.delete("tab");
    } else if (next.fixture) {
      const search = new URLSearchParams(
        epDeskFixtureSearch({
          home: next.fixture.home,
          away: next.fixture.away,
          startTime: next.fixture.startTime,
          tab: next.fixture.tab,
        })
      );
      params.set("home", search.get("home") ?? next.fixture.home);
      params.set("away", search.get("away") ?? next.fixture.away);
      if (search.get("start")) params.set("start", search.get("start")!);
      if (search.get("tab")) params.set("tab", search.get("tab")!);
    }
    const qs = params.toString();
    router.replace(qs ? `${TWOUP_DESK_PATH}?${qs}` : TWOUP_DESK_PATH, {
      scroll: false,
    });
  }

  function selectTab(next: TwoUpDeskViewId) {
    setDeskTab(next);
    writeDeskUrl({ view: next });
  }

  function openFixture(fixture: Fixture) {
    setDeskTab("model");
    setManualModel(false);
    writeDeskUrl({
      view: "model",
      fixture: {
        home: fixture.homeTeam,
        away: fixture.awayTeam,
        startTime: fixture.startTime,
        tab: "dutch",
      },
    });
  }

  function openEvent(event: EventRow) {
    if (!canOpenFootballEpModel(event.sport)) return;
    setDeskTab("model");
    setManualModel(false);
    writeDeskUrl({
      view: "model",
      fixture: {
        home: event.homeTeam,
        away: event.awayTeam,
        startTime: event.startTime,
        tab: "dutch",
      },
    });
  }

  async function patchBet(id: number, json: Record<string, unknown>, message: string) {
    try {
      await api(`/api/bets/${id}`, { method: "PATCH", json });
      toast.success(message);
      refresh();
    } catch (e) {
      toast.error("Update failed", { description: String(e) });
    }
  }

  const showBoard =
    deskTab === "fixtures" || deskTab === "picks" || deskTab === "tracked";

  if (state == null) {
    return (
      <PageLoading
        label="Loading Early-payout Desk"
        description="Opening today's early-payout board…"
      />
    );
  }

  return (
    <PageShell
      fullHeight={showBoard}
      className={
        showBoard
          ? "gap-[var(--layout-stack-gap)] p-[var(--layout-page-x)]"
          : undefined
      }
    >
      <PageHeader
        helpId="twoup"
        icon={Timer}
        title="Early-payout Desk"
        description={
          <>
            Football 2UP is modelled here, other sports{" "}
            <Link
              href="/roadmap#roadmap-calc-ep-multi-sport"
              className="text-primary-text underline-offset-2 hover:underline"
            >
              coming soon
            </Link>
            .
          </>
        }
        action={
          <>
            <Button variant="outline" size="lg" onClick={() => setPlaybookOpen(true)}>
              <Flag className="size-4" />
              Scouting playbook
            </Button>
            <Button variant="outline" size="lg" onClick={() => setBookiesOpen(true)}>
              <Settings2 className="size-4" />
              Scope
            </Button>
          </>
        }
      />

      {showEdgeTwoUpPromo && deskTab !== "model" ? (
        <PlanLockEmpty promo="twoUp" />
      ) : null}

      <StatStrip columns={5} className="grid-cols-2 shrink-0">
        <StatTile
          label="Fixtures"
          value="Today"
          sub="And tomorrow"
          active={deskTab === "fixtures"}
          onClick={() => selectTab("fixtures")}
        />
        <StatTile
          label="2UP picks"
          value={canScout && picksCount != null ? String(picksCount) : "—"}
          sub={canScout ? "Pinned competitions" : "Edge plan"}
          active={deskTab === "picks"}
          onClick={() => selectTab("picks")}
        />
        <StatTile
          label="Tracked"
          value={String(trackedCount)}
          active={deskTab === "tracked"}
          onClick={() => selectTab("tracked")}
        />
        <StatTile
          label="Active"
          value={String(openTwoUpBets.length)}
          active={deskTab === "active"}
          onClick={() => selectTab("active")}
        />
        <StatTile
          label="Model"
          value={fixtureQuery ? "Open" : "—"}
          sub={
            fixtureQuery
              ? `${fixtureQuery.home} v ${fixtureQuery.away}`
              : "Pick a match"
          }
          active={deskTab === "model"}
          onClick={() => selectTab("model")}
        />
      </StatStrip>

      {showBoard ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <FixtureBrowserContent
            variant="page"
            sportLock="football"
            hideSportControl
            hideStatusPills
            pinDayControl
            persistView={false}
            statusOverride={deskTab === "picks" ? "picks" : undefined}
            trackedOnly={deskTab === "tracked"}
            twoUpActionLabel="Open model"
            onPicksCount={setPicksCount}
            onOpenTwoUp={openFixture}
          />
        </div>
      ) : null}

      {deskTab === "active" ? (
        <TwoUpActiveBets
          bets={openTwoUpBets}
          events={state.events}
          offers={state.offers}
          bookieSetup={bookieSelection}
          onBrowse={() => selectTab("fixtures")}
          onOpenMatch={openEvent}
          onPatch={patchBet}
          onEdit={setEditingBet}
        />
      ) : null}

      {deskTab === "model" && !fixtureQuery && !manualModel ? (
        <EmptyState
          icon={FootballIcon}
          title="Pick a match"
          description="Open a fixture from the board to load exchange prices into the model."
          action={{ label: "Browse fixtures", onClick: () => selectTab("fixtures") }}
          secondaryAction={{
            label: "Type a match",
            onClick: () => setManualModel(true),
            variant: "secondary",
          }}
        />
      ) : null}

      {deskTab === "model" && (fixtureQuery || manualModel) ? (
        <TwoUpWorkbench
          fixtureQuery={fixtureQuery}
          preferredTwoUpBooks={footballBooksForLead(bookieSelection, 2)}
          preferredOneUpBooks={footballBooksForLead(bookieSelection, 1)}
          playbookSlot={null}
        />
      ) : null}

      <TwoUpBookieDialog
        open={bookiesOpen}
        onOpenChange={setBookiesOpen}
        wallets={walletNames}
        walletAccounts={bookieAccounts}
        walletsLoaded={walletsLoaded}
        selection={bookieSelection}
        onChange={persistSetup}
      />

      <TwoUpPlaybookDialog
        open={playbookOpen}
        onClose={() => setPlaybookOpen(false)}
      />

      {editingBet != null ? (
        <AddBetDialog
          open
          onOpenChange={(next) => {
            if (!next) setEditingBet(null);
          }}
          editBet={editingBet}
          events={state.events}
          onSaved={() => {
            refresh();
            setEditingBet(null);
          }}
          onDeleted={() => {
            refresh();
            setEditingBet(null);
          }}
        />
      ) : null}
    </PageShell>
  );
}
