"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExchangeRow } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ExchangeSelectProps {
  exchanges: ExchangeRow[];
  value: ExchangeRow | null;
  onChange: (exchange: ExchangeRow) => void;
  label?: string;
  /** Show the selected exchange's commission next to the label */
  showCommission?: boolean;
  /** Styled to sit on a coloured bet panel: same height/tint as PanelInput */
  onPanel?: boolean;
}

/**
 * Exchange picker: selecting an exchange applies its commission automatically and
 * re-skins the lay panel in that exchange's colours (Betfair pink, Betdaq etc.).
 */
export function ExchangeSelect({
  exchanges,
  value,
  onChange,
  label = "Exchange",
  showCommission,
  onPanel,
}: ExchangeSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center justify-between">
        <Label
          className={cn(
            "text-xs text-muted-foreground",
            onPanel && "text-[11px] font-semibold text-black/60 dark:text-white/70"
          )}
        >
          {label}
        </Label>
        {showCommission && value && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {value.commissionPct}% commission
          </span>
        )}
      </span>
      {exchanges.length === 0 ? (
        <Link href="/settings" className="text-xs text-primary-text underline-offset-2 hover:underline">
          Add your exchanges in Settings →
        </Link>
      ) : (
        <Select
          value={value ? String(value.id) : undefined}
          onValueChange={(v) => {
            const ex = exchanges.find((e) => String(e.id) === v);
            if (ex) onChange(ex);
          }}
        >
          <SelectTrigger
            className={cn(
              "w-full",
              onPanel &&
                "rounded-md border-0 bg-[var(--pi)] px-3 text-base font-bold text-black/85 shadow-none data-[size=default]:h-11 dark:bg-[var(--pi-dark)] dark:text-white/95 dark:hover:bg-[var(--pi-dark)]"
            )}
          >
            <SelectValue placeholder="Pick an exchange">
              {value ? (
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: value.brandColor }}
                  />
                  {value.name}
                </span>
              ) : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {exchanges.map((exchange) => (
              <SelectItem key={exchange.id} value={String(exchange.id)}>
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: exchange.brandColor }}
                  />
                  {exchange.name}
                  <span className="text-muted-foreground">{exchange.commissionPct}%</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
