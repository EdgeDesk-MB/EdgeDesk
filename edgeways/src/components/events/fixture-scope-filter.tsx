"use client";

import { useState, type ReactNode } from "react";
import { FavouriteStar } from "@/components/events/favourite-star";
import { HideScopeButton } from "@/components/events/hide-scope-button";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  filterScopeOptions,
  partitionHiddenScopeOptions,
} from "@/lib/events/fixture-scope";
import { toolbarSelectTriggerGhost } from "@/lib/ui/surface-styles";
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

function ScopeOptionRow({
  option,
  selected,
  favourite,
  hidden,
  onPick,
  onToggleFavourite,
  onToggleHidden,
}: {
  option: FixtureScopeOption;
  selected: boolean;
  favourite: boolean;
  hidden: boolean;
  onPick: () => void;
  onToggleFavourite: () => void;
  onToggleHidden: () => void;
}) {
  return (
    <CommandItem
      value={option.label}
      onSelect={onPick}
      className="[&_svg]:text-current"
    >
      <FavouriteStar
        size="menu"
        favourite={favourite}
        label={option.label}
        onToggle={onToggleFavourite}
      />
      <span
        aria-hidden
        className="flex size-4 shrink-0 items-center justify-center"
      >
        {option.icon}
      </span>
      <span className="min-w-0 flex-1 truncate" title={option.label}>{option.label}</span>
      {hidden || !favourite ? (
        <HideScopeButton
          size="menu"
          hidden={hidden}
          label={option.label}
          onToggle={onToggleHidden}
        />
      ) : (
        <span className="size-7 shrink-0" aria-hidden />
      )}
      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {option.count}
      </span>
      <span className="flex size-4 shrink-0 items-center justify-center">
        {selected ? <Check aria-hidden /> : null}
      </span>
    </CommandItem>
  );
}

export function FixtureScopeFilter({
  sport,
  options,
  value,
  onChange,
  favouriteIds,
  hiddenIds,
  onToggleFavourite,
  onToggleHidden,
  disabled = false,
}: {
  sport: "football" | "horse_racing";
  options: FixtureScopeOption[];
  value: string;
  onChange: (id: string) => void;
  favouriteIds: ReadonlySet<string>;
  hiddenIds: ReadonlySet<string>;
  onToggleFavourite: (id: string) => void;
  onToggleHidden: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const allLabel = sport === "football" ? "All competitions" : "All courses";
  const selected = options.find((option) => option.id === value);
  const triggerLabel = selected?.label ?? allLabel;
  const filterName = sport === "football" ? "Filter competitions" : "Filter courses";
  const matches = filterScopeOptions(
    options,
    query,
    sport === "football" ? "England" : null
  );
  const { visible, hidden } = partitionHiddenScopeOptions(matches, hiddenIds);
  const emptyCopy =
    sport === "football" ? "No matching competition." : "No matching course.";
  const idle = value === "all";

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
          size="default"
          disabled={disabled}
          data-empty={idle ? "true" : "false"}
          aria-label={idle ? filterName : `${filterName}, ${triggerLabel}`}
          title={triggerLabel}
          className={toolbarSelectTriggerGhost}
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
        className="w-80 max-w-[min(20rem,calc(100vw-var(--overlay-gutter)))] gap-0 p-0"
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
                  <CommandItem
                    value={allLabel}
                    onSelect={() => pick("all")}
                    className="[&_svg]:text-current"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center" />
                    <span className="min-w-0 flex-1 truncate">{allLabel}</span>
                    <span className="size-7 shrink-0" aria-hidden />
                    <span className="w-6 shrink-0" aria-hidden />
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      {idle ? <Check aria-hidden /> : null}
                    </span>
                  </CommandItem>
              )}
              {visible.map((option) => (
                <ScopeOptionRow
                  key={option.id}
                  option={option}
                  selected={value === option.id}
                  favourite={favouriteIds.has(option.id)}
                  hidden={false}
                  onPick={() => pick(option.id)}
                  onToggleFavourite={() => onToggleFavourite(option.id)}
                  onToggleHidden={() => onToggleHidden(option.id)}
                />
              ))}
            </CommandGroup>
            {hidden.length > 0 ? (
              <CommandGroup>
                {query.trim() ? null : (
                  <p className="px-2 pb-1 pt-2 text-xs font-semibold text-muted-foreground">
                    Hidden
                  </p>
                )}
                {hidden.map((option) => (
                  <ScopeOptionRow
                    key={option.id}
                    option={option}
                    selected={value === option.id}
                    favourite={favouriteIds.has(option.id)}
                    hidden
                    onPick={() => pick(option.id)}
                    onToggleFavourite={() => onToggleFavourite(option.id)}
                    onToggleHidden={() => onToggleHidden(option.id)}
                  />
                ))}
              </CommandGroup>
            ) : null}
            {visible.length === 0 && hidden.length === 0 && query.trim() ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyCopy}</p>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
