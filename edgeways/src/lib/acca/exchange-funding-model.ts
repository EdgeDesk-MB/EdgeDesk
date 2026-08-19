import {
  sequentialLiabilityLadder,
  type AccaFundingMethod,
  type AccaLadderLeg,
} from "@/lib/calc/acca-workflow";
import {
  exchangeFundingForecast,
  resolveExchangeCash,
  type ExchangeCashResolution,
  type FundingShortfall,
} from "@/lib/calc/exchange-funding";
import { roundPence } from "@/lib/calc/money";

export type AccaExchangeFundingModel = ExchangeCashResolution & {
  shortfalls: FundingShortfall[];
  usedProxy: boolean;
  topUp: number;
};

export function accaExchangeFundingModel(input: {
  method: string;
  stake: number;
  commission: number;
  boostPct?: number | null;
  legs: AccaLadderLeg[];
  accounts?: Parameters<typeof resolveExchangeCash>[0];
  exchangeId?: number | null;
}): AccaExchangeFundingModel | null {
  if (input.method !== "sequential" && input.method !== "insurance_legs") {
    return null;
  }
  if (!(input.stake > 0)) return null;

  const steps = sequentialLiabilityLadder({
    stake: input.stake,
    commission: input.commission,
    boostPct: input.boostPct,
    method: input.method as AccaFundingMethod,
    legs: input.legs,
  });
  if (steps.length === 0) return null;

  const wallet = resolveExchangeCash(input.accounts, input.exchangeId);
  const shortfalls = exchangeFundingForecast(
    wallet.cash,
    steps.map((s) => ({
      label: s.label,
      liability: s.liability,
      reserved: s.reserved,
    }))
  );
  if (shortfalls.length === 0) return null;

  return {
    ...wallet,
    shortfalls,
    usedProxy: steps.some((s) => s.oddsProxy && !s.reserved),
    topUp: roundPence(shortfalls.reduce((a, s) => a + s.fund, 0)),
  };
}
