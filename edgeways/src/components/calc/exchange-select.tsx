"use client";

import { VenueBadge } from "@/components/venue-badge";
import { VenueSelect } from "@/components/venue-select";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExchangeRow } from "@/lib/db/schema";
import { exchangeBrandColor } from "@/lib/brands/exchanges";
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
  /** Add bet Lay header: compact ghost trigger, no field label */
  compact?: boolean;
  /** Compact header: brand tag instead of colour dot + name */
  tagTrigger?: boolean;
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
  compact,
  tagTrigger,
}: ExchangeSelectProps) {
  if (compact && tagTrigger) {
    return (
      <VenueSelect
        compact
        tagTrigger
        kinds={["exchange"]}
        allowCustom={false}
        persistCustom={false}
        value={value?.name ?? ""}
        onChange={(name) => {
          const ex = exchanges.find(
            (e) => e.name.toLowerCase() === name.trim().toLowerCase()
          );
          if (ex) onChange(ex);
        }}
        placeholder="Exchange"
        ariaLabel="Exchange"
        tagExtra={
          value != null && Number.isFinite(value.commissionPct)
            ? `${value.commissionPct}%`
            : undefined
        }
      />
    );
  }

  const picker =
    exchanges.length === 0 ? (
      <Link href="/accounts" className="text-xs text-primary-text underline-offset-2 hover:underline">
        Add your exchanges on Accounts →
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
          aria-label="Exchange"
          className={cn(
            compact
              ? "h-[33px] max-w-[220px] rounded-md border-0 bg-transparent px-2 text-xs font-bold text-black/85 shadow-none hover:bg-black/8 dark:text-white/95 dark:hover:bg-white/10"
              : "w-full",
            !compact &&
              onPanel &&
              "rounded-md border-0 bg-[var(--pi)] px-3 text-base font-bold text-black/85 shadow-none data-[size=default]:h-11 dark:bg-[var(--pi-dark)] dark:text-white/95 dark:hover:bg-[var(--pi-dark)]"
          )}
        >
          <SelectValue placeholder="Pick an exchange">
            {value ? (
              compact && tagTrigger ? (
                <VenueBadge
                  name={value.name}
                  brandColor={value.brandColor}
                  kind="exchange"
                  size="tag"
                  className="min-w-0"
                />
              ) : (
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="inline-block size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: exchangeBrandColor(value.name, value.brandColor) }}
                  />
                  <span className="truncate">{value.name}</span>
                </span>
              )
            ) : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {exchanges.map((exchange) => (
            <SelectItem key={exchange.id} value={String(exchange.id)}>
              <span className="flex items-center gap-2">
                <span
                  className="inline-block size-3 rounded-full"
                  style={{ backgroundColor: exchangeBrandColor(exchange.name, exchange.brandColor) }}
                />
                {exchange.name}
                <span className="text-muted-foreground">{exchange.commissionPct}%</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );

  if (compact) {
    return <div className="relative">{picker}</div>;
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center justify-between">
        <Label
          className={cn(
            "text-xs text-muted-foreground",
            onPanel && "text-xs font-semibold text-black/60 dark:text-white/70"
          )}
        >
          {label}
        </Label>
        {showCommission && value && (
          <span
            className="text-xs tabular-nums text-muted-foreground"
            title={`${value.commissionPct}% commission`}
          >
            {value.commissionPct}% comm
          </span>
        )}
      </span>
      {picker}
    </div>
  );
}
