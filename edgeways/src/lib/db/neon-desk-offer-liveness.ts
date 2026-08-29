/**
 * Hosted offer status tick: planned → active, complete, expire.
 * Skips recurrence twins and playbooks (still SQLite-only).
 */
import "server-only";

import { promoAwardsFromTransactions } from "@/lib/accounts/promo-awards";
import { fillNeonSettlementSnapshot, writeNeonEvLock } from "@/lib/db/neon-desk-ev-snapshots";
import { listNeonDeskBets } from "@/lib/db/neon-desk";
import { listNeonDeskBalanceTransactions } from "@/lib/db/neon-desk-accounts";
import { listNeonDeskOffers, patchNeonDeskOffer } from "@/lib/db/neon-desk-offers";
import { campaignBetsAreComplete } from "@/lib/offers/offer-complete";
import { computeOfferProfitBreakdown, summariseOffer } from "@/lib/offers/offer-profit";
import { effectiveOfferExpiryMs } from "@/lib/offers/offer-expiry";
import { localYmd } from "@/lib/offers/offer-recurrence-shared";
import { quietOfferAlerts } from "@/lib/services/quiet-alerts";
import type { BetRow, OfferRow } from "@/lib/db/schema";
import type { OfferProfitBreakdown } from "@/lib/services/offers.types";

function campaignComplete(linkedBets: BetRow[], profit: OfferProfitBreakdown): boolean {
  return campaignBetsAreComplete(
    linkedBets.length,
    linkedBets.some((b) => b.status === "open"),
    profit.freeBetStage
  );
}

export async function syncNeonOfferStatuses(): Promise<number> {
  const [allOffers, allBets, transactions] = await Promise.all([
    listNeonDeskOffers(),
    listNeonDeskBets(),
    listNeonDeskBalanceTransactions(),
  ]);
  const promoAwards = promoAwardsFromTransactions(transactions);
  const now = Date.now();
  const todayKey = localYmd(new Date(now));
  let changed = 0;

  for (const offer of allOffers) {
    const linkedBets = allBets.filter((b) => b.offerId === offer.id);
    const profit = computeOfferProfitBreakdown(linkedBets, promoAwards);

    if (offer.status === "expired") {
      const deadline = effectiveOfferExpiryMs(offer);
      if (deadline != null && deadline > now) {
        const notYetStarted = offer.startsOn != null && offer.startsOn > todayKey;
        await patchNeonDeskOffer(offer.id, {
          status: notYetStarted ? "planned" : "active",
        });
        changed += 1;
        continue;
      }
      if (linkedBets.length > 0 && campaignComplete(linkedBets, profit)) {
        await completeNeonOffer(offer, linkedBets, promoAwards, now);
        changed += 1;
      }
      continue;
    }

    if (offer.status === "completed") {
      if (
        profit.freeBetStage === "awarded" ||
        profit.freeBetStage === "in_use" ||
        profit.freeBetStage === "awaiting_result"
      ) {
        await patchNeonDeskOffer(offer.id, { status: "active", completedAt: null });
        changed += 1;
      }
      continue;
    }

    const readyToGoLive = offer.startsOn != null && offer.startsOn <= todayKey;
    if (offer.status === "planned" && (linkedBets.length > 0 || readyToGoLive)) {
      const updated = await patchNeonDeskOffer(offer.id, { status: "active" });
      if (updated) {
        await writeNeonEvLock(summariseOffer(updated, linkedBets, promoAwards), {
          onlyIfUnlocked: true,
        }).catch(() => null);
      }
      changed += 1;
    }

    const busy =
      linkedBets.some((b) => b.status === "open") ||
      profit.freeBetStage === "awarded" ||
      profit.freeBetStage === "in_use" ||
      profit.freeBetStage === "awaiting_result";
    const deadline = effectiveOfferExpiryMs(offer);
    if (!busy && deadline != null && deadline < now) {
      if (linkedBets.length === 0) {
        await patchNeonDeskOffer(offer.id, { status: "expired" });
        quietOfferAlerts(offer.id, now);
        changed += 1;
        continue;
      }
      if (campaignComplete(linkedBets, profit)) {
        await completeNeonOffer(offer, linkedBets, promoAwards, now);
        changed += 1;
        continue;
      }
    }

    if (offer.status === "planned" && linkedBets.length === 0) continue;
    if (campaignComplete(linkedBets, profit)) {
      await completeNeonOffer(offer, linkedBets, promoAwards, now);
      changed += 1;
    }
  }
  return changed;
}

async function completeNeonOffer(
  offer: OfferRow,
  linkedBets: BetRow[],
  promoAwards: ReturnType<typeof promoAwardsFromTransactions>,
  now: number
): Promise<void> {
  await patchNeonDeskOffer(offer.id, { status: "completed", completedAt: now });
  quietOfferAlerts(offer.id, now);
  const summary = summariseOffer({ ...offer, status: "completed" }, linkedBets, promoAwards);
  await fillNeonSettlementSnapshot(offer.id, summary.profit.totalProfit, 0).catch(() => {});
}
