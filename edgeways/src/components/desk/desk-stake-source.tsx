"use client";

import { Gift } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BackBookieBalanceStrip } from "@/components/add-bet/back-bookie-balance-strip";
import { useBookieAccounts } from "@/hooks/use-bookie-accounts";
import {
  isDeskFreeBetType,
  type DeskBackBetType,
} from "@/lib/desk/desk-back-bet-type";
import { cn } from "@/lib/utils";

const LABELS: Record<DeskBackBetType, string> = {
  qualifying: "Cash",
  free_snr: "Free bet (SNR)",
  free_sr: "Free bet (SR)",
};

/**
 * Cash / free-bet stake source for desk create/edit, with the same balance
 * strip as Add bet.
 */
export function DeskStakeSource({
  bookmaker,
  value,
  onChange,
  stake,
  disabled,
  onStakeFill,
  className,
}: {
  bookmaker: string;
  value: DeskBackBetType;
  onChange: (next: DeskBackBetType) => void;
  stake: number;
  disabled?: boolean;
  /** Fill stake from available free-bet balance when user taps Use free bet. */
  onStakeFill?: (amount: number) => void;
  className?: string;
}) {
  const { accounts } = useBookieAccounts();
  const account = accounts.find(
    (a) => a.name.toLowerCase() === bookmaker.trim().toLowerCase()
  );
  const freeAvailable = account?.freeBets ?? 0;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Stake source</Label>
        <Select
          value={value}
          onValueChange={(v) => onChange(v as DeskBackBetType)}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              <span className="flex items-center gap-1.5">
                {isDeskFreeBetType(value) ? (
                  <Gift
                    className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400"
                    aria-hidden
                  />
                ) : null}
                {LABELS[value]}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(LABELS) as DeskBackBetType[]).map((m) => (
              <SelectItem key={m} value={m}>
                <span className="flex items-center gap-1.5">
                  {isDeskFreeBetType(m) && freeAvailable > 0.001 ? (
                    <Gift
                      className="size-3.5 shrink-0 text-violet-600 dark:text-violet-400"
                      aria-hidden
                    />
                  ) : null}
                  {LABELS[m]}
                  {isDeskFreeBetType(m) && freeAvailable > 0.001 ? (
                    <span className="text-[11px] font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                      £{freeAvailable.toFixed(2)}
                    </span>
                  ) : null}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <BackBookieBalanceStrip
        bookmaker={bookmaker}
        betType={value}
        backStake={stake}
        accounts={accounts}
        onUseFreeBet={(amount) => {
          if (!isDeskFreeBetType(value)) onChange("free_snr");
          onStakeFill?.(amount);
        }}
        onUseCash={() => onChange("qualifying")}
      />
    </div>
  );
}
