/**
 * Exchange-cash forecast: given available wallet cash and an ordered list
 * of upcoming lay liabilities, how much must be funded now and after
 * earlier legs win. Acca sequential is the main consumer; a one-step list
 * is the Add-bet / combined-lay case.
 */

import { roundPence } from "./money";

export interface FundingStepInput {
  label: string;
  liability: number;
  /** Already deducted from `cash` (logged open lay). */
  reserved: boolean;
}

export interface FundingShortfall {
  /** Selections that must win before this lay is needed. Empty = needed now. */
  afterLabels: string[];
  nextLabel: string;
  liability: number;
  remaining: number;
  fund: number;
}

export interface ExchangeCashResolution {
  cash: number;
  /** Named when a single wallet was chosen; null means pooled exchanges. */
  walletName: string | null;
  accountId: number | null;
}

/**
 * Walk the all-win path. A reserved step is already in the wallet.
 * An unreserved step that exceeds remaining cash is a shortfall; after
 * placing it (topping up just enough) the remaining cash is £0, not a
 * negative hole that inflates later funds.
 */
export function exchangeFundingForecast(
  cash: number,
  steps: FundingStepInput[]
): FundingShortfall[] {
  let remaining = roundPence(Number.isFinite(cash) ? cash : 0);
  const afterLabels: string[] = [];
  const out: FundingShortfall[] = [];

  for (const step of steps) {
    const liability = roundPence(step.liability);
    if (!(liability > 0) || step.reserved) {
      afterLabels.push(step.label);
      continue;
    }

    const fund = roundPence(Math.max(0, liability - remaining));
    if (fund > 0.005) {
      out.push({
        afterLabels: [...afterLabels],
        nextLabel: step.label,
        liability,
        remaining,
        fund,
      });
    }
    remaining = roundPence(Math.max(0, remaining - liability));
    afterLabels.push(step.label);
  }

  return out;
}

type ExchangeCashAccount = {
  id: number;
  name: string;
  type: string;
  isActive: number;
  exchangeId: number | null;
  balance: number;
};

/** Prefer the wallet linked to `exchangeId`; otherwise sum active exchanges. */
export function resolveExchangeCash(
  accounts: ExchangeCashAccount[] | undefined,
  exchangeId?: number | null
): ExchangeCashResolution {
  const active = (accounts ?? []).filter(
    (a) => a.type === "exchange" && a.isActive === 1
  );
  if (exchangeId != null) {
    const match = active.find((a) => a.exchangeId === exchangeId);
    if (match) {
      return {
        cash: roundPence(match.balance),
        walletName: match.name,
        accountId: match.id,
      };
    }
  }
  const cash = roundPence(active.reduce((s, a) => s + a.balance, 0));
  if (active.length === 1) {
    return { cash, walletName: active[0]!.name, accountId: active[0]!.id };
  }
  return { cash, walletName: null, accountId: null };
}
