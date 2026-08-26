"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { filterScopeOptions } from "@/lib/events/fixture-scope";
import { toolbarSelectTrigger } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";

export type FixtureScopeOption = {
  id: string;
  label: string;
  count: number;
  icon?: ReactNode;
  /** Canonical competition / course name for exact search. */
  name?: string;
  country?: string | null;
};

export function FixtureScopeFilter({
  sport,
  options,
  value,
  onChange,
  disabled = false,
}: {
  sport: "football" | "horse_racing";
  options: FixtureScopeOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const allLabel = sport === "football" ? "All competitions" : "All courses";
  const selected = options.find((option) => option.id === value);
  const triggerLabel = selected?.label ?? allLabel;
  const filterName = sport === "football" ? "Filter competitions" : "Filter courses";
  const visible = filterScopeOptions(
    options,
    query,
    sport === "football" ? "England" : null
  );
  const emptyCopy =
    sport === "football" ? "No matching competition." : "No matching course.";

  function pick(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          data-empty={value === "all"}
          aria-label={value === "all" ? filterName : `${filterName}, ${triggerLabel}`}
          title={triggerLabel}
          className={cn(toolbarSelectTrigger, "max-w-56 rounded-full")}
        >
          {value !== "all" && selected?.icon ? (
            <span aria-hidden className="inline-flex shrink-0">
              {selected.icon}
            </span>
          ) : null}
          <span className="min-w-0 truncate">{triggerLabel}</span>
          <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        aria-label={filterName}
        className="w-72 gap-0 p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            aria-label={
              sport === "football" ? "Search competitions" : "Search courses"
            }
            placeholder={sport === "football" ? "Search competitions…" : "Search courses…"}
          />
          <CommandList className="h-64 min-h-64 max-h-64">
            <CommandGroup>
              {query.trim() ? null : (
              <CommandItem value={allLabel} onSelect={() => pick("all")}>
                <span className="flex size-4 shrink-0 items-center justify-center" />
                <span className="min-w-0 flex-1 truncate">{allLabel}</span>
                <span className="w-6 shrink-0" aria-hidden />
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {value === "all" ? <Check aria-hidden /> : null}
                </span>
              </CommandItem>
              )}
              {visible.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.label}
                  onSelect={() => pick(option.id)}
                >
                  <span
                    aria-hidden
                    className="flex size-4 shrink-0 items-center justify-center"
                  >
                    {option.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate" title={option.label}>{option.label}</span>
                  <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {option.count}
                  </span>
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    {value === option.id ? <Check aria-hidden /> : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            {visible.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyCopy}</p>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
