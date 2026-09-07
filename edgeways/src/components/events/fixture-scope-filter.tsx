"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  filterScopeOptions,
  partitionHiddenScopeOptions,
  SCOPE_MENU_PAGE,
  takeScopeMenuPage,
} from "@/lib/events/fixture-scope";
import {
  toolbarControlH,
  toolbarIconBox,
  toolbarSelectTriggerGhost,
} from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ListFilter, Loader2 } from "lucide-react";

export type FixtureScopeOption = {
  id: string;
  label: string;
  count: number;
  icon?: ReactNode;
  /** Canonical competition / course name for exact search. */
  name?: string;
  country?: string | null;
  leagueFlag?: string | null;
};

function ScopeOptionRow({
  option,
  selected,
  favourite,
  hidden,
  icon,
  onPick,
  onToggleFavourite,
  onToggleHidden,
}: {
  option: FixtureScopeOption;
  selected: boolean;
  favourite: boolean;
  hidden: boolean;
  icon?: ReactNode;
  onPick: () => void;
  onToggleFavourite: () => void;
  onToggleHidden: () => void;
}) {
  return (
    <CommandItem
      value={`${option.label} ${option.name ?? ""}`}
      onSelect={onPick}
      className="[&_svg]:text-current"
    >
      <FavouriteStar
        size="menu"
        favourite={favourite}
        label={option.name ?? option.label}
        onToggle={onToggleFavourite}
      />
      <span
        aria-hidden
        className="flex size-4 shrink-0 items-center justify-center"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate" title={option.name ?? option.label}>
        {option.name ?? option.label}
      </span>
      {hidden || !favourite ? (
        <HideScopeButton
          size="menu"
          hidden={hidden}
          label={option.name ?? option.label}
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
  loading = false,
  loadingLabel,
  renderIcon,
  face = "ghost",
  align = "end",
  labelMode = "full",
  className,
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
  loading?: boolean;
  loadingLabel?: string;
  renderIcon?: (option: FixtureScopeOption) => ReactNode;
  face?: "ghost" | "outline";
  align?: "start" | "end";
  labelMode?: "full" | "filter" | "icon";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(SCOPE_MENU_PAGE);
  const sentinelRef = useRef<HTMLParagraphElement>(null);
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
  const catalogLabel =
    loadingLabel ??
    (sport === "football" ? "Loading competitions…" : "Loading courses…");
  const idle = value === "all";
  const iconOnly = face === "outline" && labelMode === "icon";
  const visibleLabel = iconOnly
    ? null
    : face !== "outline"
      ? triggerLabel
      : idle
        ? labelMode === "filter"
          ? "Filter"
          : triggerLabel
        : triggerLabel;
  const pinned = useMemo(() => {
    const ids = new Set<string>();
    if (value !== "all") ids.add(value);
    for (const id of favouriteIds) ids.add(id);
    return ids;
  }, [value, favouriteIds]);
  const visiblePage = takeScopeMenuPage(visible, page, pinned);
  const hiddenPage = takeScopeMenuPage(hidden, page, pinned);
  const moreHidden = visiblePage.hidden + hiddenPage.hidden;

  useEffect(() => {
    if (!open) setPage(SCOPE_MENU_PAGE);
  }, [open, query]);

  useLayoutEffect(() => {
    if (!open || moreHidden === 0) return;
    const node = sentinelRef.current;
    if (!node) return;
    const list = node.closest<HTMLElement>("[data-slot='command-list']");
    if (!list) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setPage((current) => current + SCOPE_MENU_PAGE);
        }
      },
      { root: list, rootMargin: "96px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [open, moreHidden, visiblePage.shown.length, hiddenPage.shown.length]);

  function pick(id: string) {
    onChange(id);
    setOpen(false);
  }

  function rowIcon(option: FixtureScopeOption) {
    return option.icon ?? renderIcon?.(option);
  }

  const trigger = (
    <Button
      type="button"
      variant={face === "outline" ? "outline" : "ghost"}
      size={iconOnly ? "icon" : "default"}
      disabled={disabled}
      data-empty={idle ? "true" : "false"}
      aria-busy={loading || undefined}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-pressed={!idle}
      aria-label={
        loading
          ? `${filterName}, ${catalogLabel}`
          : idle
            ? filterName
            : `${filterName}, ${triggerLabel}`
      }
      title={triggerLabel}
          className={cn(
            face === "outline"
              ? cn(
                  toolbarControlH,
                  iconOnly ? toolbarIconBox : "max-w-56 shrink-0",
                  iconOnly &&
                    !idle &&
                    "border-selection-subdued-border bg-selection-subdued text-foreground hover:bg-selection-subdued hover:text-foreground aria-expanded:bg-selection-subdued aria-expanded:text-foreground"
                )
              : toolbarSelectTriggerGhost,
            className
          )}
      onClick={
        face === "outline"
          ? () => {
              if (disabled) return;
              setOpen((current) => !current);
            }
          : undefined
      }
    >
      {face === "outline" ? (
        <ListFilter aria-hidden className="size-4 shrink-0" />
      ) : value !== "all" &&
        rowIcon(selected ?? { id: value, label: triggerLabel, count: 0 }) ? (
        <span aria-hidden className="inline-flex shrink-0">
          {rowIcon(selected ?? { id: value, label: triggerLabel, count: 0 })}
        </span>
      ) : null}
          {visibleLabel ? (
            <span className="min-w-0 truncate">{visibleLabel}</span>
          ) : null}
          {iconOnly ? null : loading ? (
            <Loader2
              aria-hidden
              className="size-4 shrink-0 animate-spin text-muted-foreground"
            />
          ) : (
            <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          )}
    </Button>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      {face === "outline" ? (
        <PopoverAnchor asChild>{trigger}</PopoverAnchor>
      ) : (
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      )}
      <PopoverContent
        align={align}
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
            icon={
              loading ? (
                <Loader2
                  role="img"
                  aria-label={catalogLabel}
                  className="size-4 shrink-0 animate-spin text-muted-foreground"
                />
              ) : undefined
            }
          />
          <CommandList className="h-[min(32rem,70dvh)] min-h-64 max-h-[min(32rem,70dvh)]">
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
              {visiblePage.shown.map((option) => (
                <ScopeOptionRow
                  key={option.id}
                  option={option}
                  selected={value === option.id}
                  favourite={favouriteIds.has(option.id)}
                  hidden={false}
                  icon={rowIcon(option)}
                  onPick={() => pick(option.id)}
                  onToggleFavourite={() => onToggleFavourite(option.id)}
                  onToggleHidden={() => onToggleHidden(option.id)}
                />
              ))}
            </CommandGroup>
            {hiddenPage.shown.length > 0 ? (
              <CommandGroup>
                {query.trim() ? null : (
                  <p className="px-2 pb-1 pt-2 text-xs font-semibold text-muted-foreground">
                    Hidden
                  </p>
                )}
                {hiddenPage.shown.map((option) => (
                  <ScopeOptionRow
                    key={option.id}
                    option={option}
                    selected={value === option.id}
                    favourite={favouriteIds.has(option.id)}
                    hidden
                    icon={rowIcon(option)}
                    onPick={() => pick(option.id)}
                    onToggleFavourite={() => onToggleFavourite(option.id)}
                    onToggleHidden={() => onToggleHidden(option.id)}
                  />
                ))}
              </CommandGroup>
            ) : null}
            {loading ? (
              <p
                role="status"
                aria-live="polite"
                className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground"
              >
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {catalogLabel}
              </p>
            ) : null}
            {moreHidden > 0 ? (
              <p
                ref={sentinelRef}
                className="px-2 py-1.5 text-xs text-muted-foreground"
              >
                {moreHidden} more below. Type to search.
              </p>
            ) : null}
            {visible.length === 0 && hidden.length === 0 && query.trim() && !loading ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyCopy}</p>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
