/**
 * Hosted weekly + daily inbox briefings. Same due windows and builders as
 * localhost; latch lives on the clerk desk-settings blob.
 */
import "server-only";

import { promoAwardsFromTransactions } from "@/lib/accounts/promo-awards";
import { computeBookmakerStats } from "@/lib/accounts/bookmaker-stats";
import { listNeonAccaRuns } from "@/lib/db/neon-desk-acca";
import { listNeonBetBuilderRuns } from "@/lib/db/neon-desk-bet-builder";
import { listNeonSystemRuns } from "@/lib/db/neon-desk-systems";
import { listNeonDeskBets } from "@/lib/db/neon-desk";
import {
  listNeonDeskAccounts,
  listNeonDeskBalanceTransactions,
} from "@/lib/db/neon-desk-accounts";
import { listNeonAllSnapshots } from "@/lib/db/neon-desk-ev-snapshots";
import { listNeonOpenFreeBetLots } from "@/lib/db/neon-desk-free-bet-lots";
import { listNeonDeskOffers } from "@/lib/db/neon-desk-offers";
import {
  getNeonDeskSettings,
  patchNeonDeskSettings,
} from "@/lib/db/neon-desk-settings";
import { indexOfferDeskProgress } from "@/lib/offers/offer-desk-progress";
import { summariseOffer } from "@/lib/offers/offer-profit";
import type { EvSnapshotRow } from "@/lib/offers/ev-capture";
import {
  buildDailyTasksDigest,
  reminderHorizonDays,
  selectExpiryDoNextTasks,
} from "@/lib/offers/daily-tasks-digest";
import { buildDoNextItems } from "@/lib/offers/do-next";
import { buildWeeklyDigest } from "@/lib/offers/weekly-digest-content";
import { recordAlertsAsync } from "@/lib/services/alerts-inbox";
import { dailyTasksDigestDueWindow } from "@/lib/services/daily-tasks-digest";
import { sendPush } from "@/lib/services/push";
import { weeklyDigestDueWindow } from "@/lib/services/weekly-digest";

async function hostedOfferSummaries() {
  const [offers, bets, transactions, acca, systems, betBuilder] = await Promise.all([
    listNeonDeskOffers(),
    listNeonDeskBets(),
    listNeonDeskBalanceTransactions(),
    listNeonAccaRuns().catch(() => []),
    listNeonSystemRuns().catch(() => []),
    listNeonBetBuilderRuns().catch(() => []),
  ]);
  const promoAwards = promoAwardsFromTransactions(transactions);
  const deskByOffer = indexOfferDeskProgress({
    acca: acca.map(({ run, legs }) => ({
      id: run.id,
      offerId: run.offerId,
      status: run.status,
      method: run.method,
      noLay: run.noLay,
      wholeLayStake: run.wholeLayStake,
      legs: legs.map((l) => ({
        seq: l.seq,
        label: l.label,
        result: l.result,
        layStake: l.layStake,
      })),
    })),
    betBuilder: betBuilder.map(({ run, selections }) => ({
      id: run.id,
      offerId: run.offerId,
      status: run.status,
      method: run.method,
      wholeLayStake: run.wholeLayStake,
      selectionCount: selections.length,
    })),
    systems: systems.map(({ run, legs }) => ({
      id: run.id,
      offerId: run.offerId,
      status: run.status,
      legs: legs.map((l) => ({
        seq: l.seq,
        label: l.label,
        result: l.result,
      })),
    })),
  });
  return offers
    .map((o) => ({
      ...summariseOffer(o, bets.filter((b) => b.offerId === o.id), promoAwards),
      deskProgress: deskByOffer.get(o.id) ?? null,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function maybeSendNeonWeeklyDigest(nowMs = Date.now()): Promise<boolean> {
  const settings = await getNeonDeskSettings();
  if (!settings.digestWeekly) return false;

  const window = weeklyDigestDueWindow(nowMs);
  if (settings.digestLastSentWeek === window.weekKey) return false;
  if (!window.due) return false;

  const [snapshots, bets, accounts, offers] = await Promise.all([
    listNeonAllSnapshots(),
    listNeonDeskBets(),
    listNeonDeskAccounts(),
    listNeonDeskOffers(),
  ]);
  const league = computeBookmakerStats({
    accounts,
    bets,
    offers,
    now: nowMs,
    droughtNudgeDays: settings.tuning.droughtNudgeDays,
  });
  const content = buildWeeklyDigest({
    snapshots: snapshots as EvSnapshotRow[],
    bets,
    league,
    weekStartMs: window.weekStartMs,
    weekEndMs: window.weekEndMs,
  });

  await patchNeonDeskSettings({ digestLastSentWeek: window.weekKey });
  if (!content) return false;

  const alert = {
    key: `digest:${window.weekKey}`,
    kind: "weekly_digest",
    title: content.title,
    body: content.body,
    href: "/report",
  };
  await recordAlertsAsync([alert]);
  void sendPush(alert).catch(() => {});
  return true;
}

export async function maybeSendNeonDailyTasksDigest(nowMs = Date.now()): Promise<boolean> {
  const settings = await getNeonDeskSettings();
  if (!settings.offerRemindersEnabled) return false;

  const window = dailyTasksDigestDueWindow(nowMs);
  if (settings.dailyTasksLastSentDay === window.dayKey) return false;
  if (!window.due) return false;

  const [offers, lots] = await Promise.all([
    hostedOfferSummaries(),
    listNeonOpenFreeBetLots(),
  ]);
  const items = buildDoNextItems(offers, lots, nowMs);
  const horizon = Math.min(reminderHorizonDays(settings.offerReminderDays), 3);
  const tasks = selectExpiryDoNextTasks(items, offers, horizon);
  const content = buildDailyTasksDigest(tasks);

  await patchNeonDeskSettings({ dailyTasksLastSentDay: window.dayKey });
  if (!content) return false;

  const alert = {
    key: `daily_tasks:${window.dayKey}`,
    kind: "daily_tasks",
    title: content.title,
    body: content.body,
    href: "/desk",
  };
  await recordAlertsAsync([alert]);
  void sendPush(alert).catch(() => {});
  return true;
}
