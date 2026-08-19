"use client";

import { useAddBalance } from "@/components/add-balance-provider";
import { Button } from "@/components/ui/button";
import { WarningNotice } from "@/components/ui/warning-notice";
import { formatGbp } from "@/lib/format-money";
import type { AccaExchangeFundingModel } from "@/lib/acca/exchange-funding-model";
import type { FundingShortfall } from "@/lib/calc/exchange-funding";

function BoldName({ name }: { name: string }) {
  return <strong className="font-semibold text-foreground">{name}</strong>;
}

function SelectionList({ names }: { names: string[] }) {
  if (names.length === 1) return <BoldName name={names[0]!} />;
  if (names.length === 2) {
    return (
      <>
        <BoldName name={names[0]!} /> and <BoldName name={names[1]!} />
      </>
    );
  }
  return (
    <>
      {names.slice(0, -1).map((name, i) => (
        <span key={`${name}-${i}`}>
          {i > 0 ? ", " : null}
          <BoldName name={name} />
        </span>
      ))}{" "}
      and <BoldName name={names[names.length - 1]!} />
    </>
  );
}

function FundingLine({
  shortfall,
  wallet,
}: {
  shortfall: FundingShortfall;
  wallet: string;
}) {
  const fund = formatGbp(shortfall.fund);
  if (shortfall.afterLabels.length === 0) {
    return (
      <p>
        Fund {fund} in {wallet} to lay <BoldName name={shortfall.nextLabel} />.
      </p>
    );
  }
  const verb = shortfall.afterLabels.length === 1 ? "wins" : "win";
  return (
    <p>
      If <SelectionList names={shortfall.afterLabels} /> {verb}, you will need to
      fund {fund} in {wallet} to lay <BoldName name={shortfall.nextLabel} />.
    </p>
  );
}

export function ExchangeFundingNotice({
  model,
  className,
  compact = false,
}: {
  model: AccaExchangeFundingModel;
  className?: string;
  /** Run card: first shortfall only, so the header stays one warning. */
  compact?: boolean;
}) {
  const { openAddBalance } = useAddBalance();
  const wallet = model.walletName ?? "your exchanges";
  const lines = compact ? model.shortfalls.slice(0, 1) : model.shortfalls;
  const extra = compact && model.shortfalls.length > 1;
  const now = model.shortfalls.find((s) => s.afterLabels.length === 0);

  return (
    <WarningNotice
      title="Exchange funding"
      className={className}
      action={
        now ? (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 font-semibold text-primary-text"
            onClick={() =>
              openAddBalance({
                accountId: model.accountId ?? undefined,
                accountName: model.walletName ?? undefined,
                amount: now.fund,
              })
            }
          >
            Add balance ({formatGbp(now.fund)})
          </Button>
        ) : null
      }
    >
      <div className="space-y-1">
        {lines.map((s) => (
          <FundingLine
            key={`${s.afterLabels.join("|")}|${s.nextLabel}`}
            shortfall={s}
            wallet={wallet}
          />
        ))}
      </div>
      {extra ? (
        <p className="mt-1">Later legs may need another top-up if they win.</p>
      ) : null}
      {model.usedProxy ? (
        <p className={extra ? "mt-0.5" : "mt-1"}>Estimated at bookie prices.</p>
      ) : null}
    </WarningNotice>
  );
}
