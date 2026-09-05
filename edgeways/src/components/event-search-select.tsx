"use client";

/**
 * Shared searchable Events picker (Add bet, desk leg fields). Popover + cmdk
 * with an autofocused search field: typing filters the list 800ms after the
 * last keystroke (spinner in the field while the debounce runs), and idle
 * rendering is capped so a busy card of hundreds of races does not mount
 * every row on open. Fetching stays lazy via the `onOpen` callback.
 */

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { RemoveScroll } from "react-remove-scroll";
import { SportIcon } from "@/components/sport-icon";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  capEventSearchSections,
  EVENT_SEARCH_IDLE_PAGE,
  EVENT_SEARCH_SEARCH_PAGE,
  isLiveInAddBetEvents,
  matchesEventSearch,
  type EventSearchOption,
  type EventSearchSection,
} from "@/lib/add-bet-event-options";
import { effectiveEventStatus } from "@/lib/events";
import { useNow } from "@/hooks/use-now";
import { fieldControl } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

/** Pause after the last keystroke before the list filters. */
export const EVENT_SEARCH_DEBOUNCE_MS = 800;
const LOAD_MORE_PX = 96;

/** Hour chip on a centred rule (`—— [13:00] ——`). */
const hourTagClass =
  "shrink-0 rounded border border-border/70 bg-muted px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground";

/** Day pill on a centred rule (`—— Today ——`), WhatsApp-style date stamp. */
const dayTagClass =
  "shrink-0 rounded-full border border-border/70 bg-muted px-2.5 py-0.5 text-xs font-semibold tracking-wide text-foreground";

function EventListRule({
  label,
  kind,
  className,
}: {
  label: string;
  kind: "day" | "hour";
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-center gap-2 px-1.5", className)}
      role="separator"
      aria-label={label}
    >
      <span className="h-px min-w-8 flex-1 bg-border" aria-hidden />
      <span className={kind === "day" ? dayTagClass : hourTagClass}>{label}</span>
      <span className="h-px min-w-8 flex-1 bg-border" aria-hidden />
    </div>
  );
}

/**
 * cmdk calls `scrollIntoView({block:"nearest"})` whenever the highlighted
 * row changes, including pointer-under-cursor while the list is scrolling.
 * The menu is portaled, so that walks to Add bet / the desk and reads as a
 * page flash. Swallow it for nodes inside this picker.
 */
function containScrollIntoView(root: HTMLElement): () => void {
  const proto = Element.prototype;
  const original = proto.scrollIntoView;
  function contained(this: Element, arg?: boolean | ScrollIntoViewOptions) {
    if (!root.isConnected || !root.contains(this)) {
      original.call(this, arg as never);
    }
  }
  proto.scrollIntoView = contained;
  return () => {
    if (proto.scrollIntoView === contained) proto.scrollIntoView = original;
  };
}

/** Keep wheel / overscroll inside the list so Add bet does not shift. */
function trapListScroll(list: HTMLElement, onUserScroll: () => void): () => void {
  const previousOverscroll = list.style.overscrollBehavior;
  const previousAnchor = list.style.overflowAnchor;
  list.style.overscrollBehavior = "none";
  list.style.overflowAnchor = "none";
  const onWheel = (event: WheelEvent) => {
    onUserScroll();
    event.stopPropagation();
    const atTop = list.scrollTop <= 0;
    const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
    if ((atTop && event.deltaY < 0) || (atBottom && event.deltaY > 0)) {
      event.preventDefault();
    }
  };
  const onTouchMove = (event: TouchEvent) => {
    onUserScroll();
    event.stopPropagation();
  };
  list.addEventListener("wheel", onWheel, { passive: false, capture: true });
  list.addEventListener("touchmove", onTouchMove, { capture: true, passive: true });
  return () => {
    list.style.overscrollBehavior = previousOverscroll;
    list.style.overflowAnchor = previousAnchor;
    list.removeEventListener("wheel", onWheel, { capture: true });
    list.removeEventListener("touchmove", onTouchMove, { capture: true });
  };
}

/** Events row: sport + title + LIVE/FT, clock flush right (old Select rows). */
function EventSearchOptionRow({
  option,
  now,
}: {
  option: Pick<
    EventSearchOption,
    "sport" | "parts" | "startTime" | "eventStatus" | "source"
  >;
  now: number;
}) {
  const live =
    isLiveInAddBetEvents(
      option.startTime,
      option.eventStatus,
      now,
      undefined,
      option.sport
    ) ||
    effectiveEventStatus(
      {
        sport: option.sport,
        status: option.eventStatus ?? "upcoming",
        source: option.source,
        startTime: option.startTime ?? undefined,
      },
      now
    ) === "live";
  const status = live
    ? "LIVE"
    : option.parts.status === "LIVE"
      ? ""
      : option.parts.status;
  return (
    <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <SportIcon
          sport={option.sport}
          size={14}
          className="shrink-0 text-muted-foreground"
        />
        <span className="truncate">{option.parts.title}</span>
        {status ? (
          <span
            className={cn(
              "shrink-0 text-xs font-semibold",
              status === "LIVE" ? "text-success" : "text-muted-foreground"
            )}
          >
            {status}
          </span>
        ) : null}
      </span>
      {option.parts.time ? (
        <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {option.parts.time}
        </span>
      ) : null}
    </span>
  );
}

function EventSearchItem({
  option,
  now,
  onPick,
  className,
}: {
  option: EventSearchOption;
  now: number;
  onPick: (value: string) => void;
  className?: string;
}) {
  return (
    <CommandItem
      value={option.value}
      onSelect={() => onPick(option.value)}
      className={cn("py-1", className)}
    >
      <EventSearchOptionRow option={option} now={now} />
    </CommandItem>
  );
}

export function EventSearchSelect({
  id,
  value,
  onValueChange,
  onOpen,
  placeholder,
  disabled,
  className,
  ariaLabel,
  ariaDescribedBy,
  topRow,
  sections,
  loading = false,
  loadingLabel = "Loading events…",
  emptyLabel,
  searchPlaceholder = "Search events…",
  listClassName,
}: {
  id?: string;
  value: string;
  onValueChange: (next: string) => void;
  /** Lazy-load hook: fired each time the menu opens. */
  onOpen?: () => void;
  placeholder: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  /** Pinned first row (Manual entry / scope pending). Hidden while searching. */
  topRow?: { value: string; label: string; disabled?: boolean } | null;
  sections: EventSearchSection[];
  /** Fetch in flight: spinner row above the idle list. */
  loading?: boolean;
  loadingLabel?: string;
  /** Row shown when there is nothing to list and not loading. */
  emptyLabel?: string | null;
  searchPlaceholder?: string;
  listClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [idleLimit, setIdleLimit] = useState(EVENT_SEARCH_IDLE_PAGE);
  const [searchLimit, setSearchLimit] = useState(EVENT_SEARCH_SEARCH_PAGE);
  const [pointerSelect, setPointerSelect] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const plateRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLParagraphElement>(null);
  const moreRef = useRef({ idle: 0, search: 0 });
  const loadLockRef = useRef(false);
  const pointerSelectTimer = useRef<number>(0);
  const now = useNow(15_000);

  // Debounce: apply the typed query 800ms after the last keystroke. The list
  // keeps showing the previous results until then (no flicker), with the
  // spinner marking the pending search.
  useEffect(() => {
    if (input === query) return;
    const timer = setTimeout(() => setQuery(input), EVENT_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input, query]);

  const searching = input !== query;
  const queryActive = query.trim().length > 0;

  useEffect(() => {
    if (!open) {
      setIdleLimit(EVENT_SEARCH_IDLE_PAGE);
      setSearchLimit(EVENT_SEARCH_SEARCH_PAGE);
    }
  }, [open]);

  useEffect(() => {
    setSearchLimit(EVENT_SEARCH_SEARCH_PAGE);
  }, [query]);

  const allOptions = useMemo(
    () =>
      sections.flatMap((section) =>
        section.bands.flatMap((band) => band.hours.flatMap((hour) => hour.items))
      ),
    [sections]
  );
  const idleSource = useMemo(
    () => sections.filter((section) => section.listInIdle !== false),
    [sections]
  );

  const matches = useMemo(() => {
    if (!queryActive) return null;
    return allOptions.filter((option) => matchesEventSearch(option.keywords, query));
  }, [allOptions, query, queryActive]);

  // Idle view: keep the day / hour banding, mount a page at a time.
  const idle = useMemo(() => {
    const capped = capEventSearchSections(idleSource, idleLimit);
    const idleTotal = idleSource.reduce(
      (n, section) =>
        n +
        section.bands.reduce(
          (m, band) => m + band.hours.reduce((k, hour) => k + hour.items.length, 0),
          0
        ),
      0
    );
    return {
      sections: capped.sections,
      hidden: Math.max(idleTotal - capped.rendered, 0),
    };
  }, [idleSource, idleLimit]);

  const visibleMatches = matches?.slice(0, searchLimit) ?? null;
  const hiddenMatches =
    matches != null ? Math.max(matches.length - searchLimit, 0) : 0;
  moreRef.current = { idle: idle.hidden, search: hiddenMatches };

  function quietPointerSelect() {
    if (pointerSelectTimer.current) window.clearTimeout(pointerSelectTimer.current);
    setPointerSelect(false);
    pointerSelectTimer.current = window.setTimeout(() => {
      setPointerSelect(true);
      pointerSelectTimer.current = 0;
    }, 180);
  }

  function bumpListPage() {
    if (loadLockRef.current) return false;
    if (moreRef.current.search > 0) {
      loadLockRef.current = true;
      setSearchLimit((n) => n + EVENT_SEARCH_SEARCH_PAGE);
      return true;
    }
    if (moreRef.current.idle > 0) {
      loadLockRef.current = true;
      setIdleLimit((n) => n + EVENT_SEARCH_IDLE_PAGE);
      return true;
    }
    return false;
  }

  // Patch scrollIntoView + trap wheel once per open. Do not rebind when a
  // page of rows mounts: that tore the trap down and re-ran load-more.
  useLayoutEffect(() => {
    if (!open) {
      setPointerSelect(true);
      return;
    }
    let cancelled = false;
    let release: (() => void) | undefined;
    const bind = () => {
      if (cancelled) return false;
      const root = plateRef.current;
      const list =
        sentinelRef.current?.closest<HTMLElement>("[data-slot='command-list']") ??
        root?.querySelector<HTMLElement>("[data-slot='command-list']");
      if (!root || !list) return false;

      const releaseContain = containScrollIntoView(root);
      const releaseWheel = trapListScroll(list, quietPointerSelect);
      const nearEnd = () =>
        list.scrollHeight - list.scrollTop - list.clientHeight <= LOAD_MORE_PX;
      const onScroll = () => {
        quietPointerSelect();
        if (nearEnd()) bumpListPage();
      };
      list.addEventListener("scroll", onScroll, { passive: true });
      release = () => {
        list.removeEventListener("scroll", onScroll);
        releaseWheel();
        releaseContain();
      };
      return true;
    };

    if (!bind()) {
      const id = requestAnimationFrame(() => {
        if (!bind()) requestAnimationFrame(() => bind());
      });
      release = () => cancelAnimationFrame(id);
    }

    return () => {
      cancelled = true;
      release?.();
      if (pointerSelectTimer.current) window.clearTimeout(pointerSelectTimer.current);
    };
  }, [open]);

  useLayoutEffect(() => {
    loadLockRef.current = false;
  }, [idleLimit, searchLimit]);

  // Short lists cannot scroll to the sentinel. Keep appending until the
  // viewport fills or the card is exhausted.
  useLayoutEffect(() => {
    if (!open) return;
    const list =
      sentinelRef.current?.closest<HTMLElement>("[data-slot='command-list']") ??
      plateRef.current?.querySelector<HTMLElement>("[data-slot='command-list']");
    if (!list || list.clientHeight < 32) return;
    if (list.scrollHeight <= list.clientHeight + LOAD_MORE_PX) bumpListPage();
  }, [open, idle.hidden, hiddenMatches]);

  const selected = allOptions.find((option) => option.value === value) ?? null;
  const topRowActive = topRow != null && value === topRow.value;
  const selectedIdleValues = useMemo(
    () =>
      new Set(
        idle.sections.flatMap((section) =>
          section.bands.flatMap((band) =>
            band.hours.flatMap((hour) => hour.items.map((item) => item.value))
          )
        )
      ),
    [idle.sections]
  );
  const pinSelected =
    selected != null && !topRowActive && !selectedIdleValues.has(selected.value);

  function pick(next: string) {
    onValueChange(next);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          onOpen?.();
        } else {
          setInput("");
          setQuery("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-haspopup="dialog"
          className={cn(
            fieldControl,
            "flex h-8 w-full items-center justify-between gap-1.5 py-2 pr-2 pl-2.5 text-sm whitespace-nowrap outline-none select-none hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 max-sm:h-10 dark:hover:bg-input/50",
            className
          )}
        >
          {selected ? (
            <EventSearchOptionRow option={selected} now={now} />
          ) : (
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-left",
                !topRowActive && "text-muted-foreground"
              )}
            >
              {topRowActive ? topRow.label : placeholder}
            </span>
          )}
          <ChevronDown
            aria-hidden
            className="pointer-events-none size-4 shrink-0 text-muted-foreground"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        aria-label={ariaLabel ?? placeholder}
        className="max-h-(--radix-popover-content-available-height) w-(--radix-popover-trigger-width) min-w-64 max-w-[calc(100vw-var(--overlay-gutter))] gap-0 overflow-hidden p-0 animate-none data-open:animate-none data-closed:animate-none"
        onOpenAutoFocus={(e) => {
          // Skip Radix's plate focus: the cursor goes straight into search.
          e.preventDefault();
          inputRef.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Modal ancestors (Add bet dialog) lock wheel events outside their
            own content via react-remove-scroll, which freezes this portaled
            list. A nested lock lets wheel reach the list (newest lock wins).
            Do not hide the scrollbar or isolate the page again: that re-pads
            body and flashes the dimmed desk behind the dialog. */}
        <RemoveScroll
          ref={plateRef}
          allowPinchZoom
          noIsolation
          noRelative
          removeScrollBar={false}
        >
        <Command shouldFilter={false} disablePointerSelection={!pointerSelect}>
          <CommandInput
            ref={inputRef}
            value={input}
            onValueChange={setInput}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            icon={
              searching ? (
                <Loader2
                  role="img"
                  className="size-4 shrink-0 animate-spin text-muted-foreground"
                  aria-label="Searching"
                />
              ) : undefined
            }
          />
          <CommandList
            className={cn(
              idle.hidden > 0 ||
                hiddenMatches > 0 ||
                idleLimit > EVENT_SEARCH_IDLE_PAGE ||
                searchLimit > EVENT_SEARCH_SEARCH_PAGE
                ? "h-[min(36rem,calc(var(--radix-popover-content-available-height)-3rem))]"
                : "max-h-[min(36rem,calc(var(--radix-popover-content-available-height)-3rem))]",
              "[overflow-anchor:none]",
              listClassName
            )}
          >
            {matches ? (
              matches.length > 0 ? (
                <>
                  <CommandGroup>
                    {visibleMatches?.map((option) => (
                      <EventSearchItem
                        key={option.value}
                        option={option}
                        now={now}
                        onPick={pick}
                      />
                    ))}
                  </CommandGroup>
                  {hiddenMatches > 0 ? (
                    <p
                      ref={sentinelRef}
                      className="px-2 py-1.5 text-xs text-muted-foreground"
                    >
                      {hiddenMatches} more below.
                    </p>
                  ) : null}
                </>
              ) : (
                <CommandEmpty>No matching event.</CommandEmpty>
              )
            ) : (
              <>
                {topRow ? (
                  <CommandGroup>
                    <CommandItem
                      value={topRow.value}
                      disabled={topRow.disabled}
                      onSelect={() => pick(topRow.value)}
                    >
                      <span className="min-w-0 flex-1 truncate">{topRow.label}</span>
                      {topRowActive ? (
                        <Check aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                      ) : null}
                    </CommandItem>
                  </CommandGroup>
                ) : null}
                {pinSelected && selected ? (
                  <CommandGroup>
                    <EventSearchItem
                      option={selected}
                      now={now}
                      onPick={pick}
                    />
                  </CommandGroup>
                ) : null}
                {idle.sections.map((section, sectionIdx) => {
                  const tracked = section.key === "tracked";
                  const showHeading = section.showHeading !== false && Boolean(section.label);
                  const lastTracked =
                    tracked &&
                    !idle.sections
                      .slice(sectionIdx + 1)
                      .some((next) => next.key === "tracked");
                  return (
                  <Fragment key={section.key}>
                  <CommandGroup>
                    <div
                      className={cn(
                        (topRow || sectionIdx > 0) && "mt-1 border-t border-border/80",
                        tracked && "mb-6"
                      )}
                    >
                    {showHeading ? (
                    <div className="-mx-1 flex items-center gap-1.5 px-3 pb-0.5 pt-3 text-xs font-semibold text-foreground">
                      {section.label}
                      <span className="ml-auto font-normal tabular-nums text-muted-foreground">
                        {section.total}
                      </span>
                    </div>
                    ) : null}
                    {section.bands.map((band, bandIdx) => (
                      <div key={band.key}>
                        {band.label ? (
                          <EventListRule
                            kind="day"
                            label={band.label}
                            className={cn(
                              "pb-0.5",
                              tracked
                                ? "pt-1"
                                : bandIdx === 0
                                  ? "pt-3"
                                  : "pt-8"
                            )}
                          />
                        ) : null}
                        {band.hours.map((hour, hourIdx) => (
                          <div key={hour.key}>
                            {!tracked &&
                            hour.label &&
                            !(band.label && hourIdx === 0) ? (
                              <EventListRule
                                kind="hour"
                                label={hour.label}
                                className="py-1"
                              />
                            ) : null}
                            {hour.items.map((option) => (
                              <EventSearchItem
                                key={option.value}
                                option={option}
                                now={now}
                                onPick={pick}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                    </div>
                  </CommandGroup>
                  {loading && lastTracked ? (
                    <p className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      {loadingLabel}
                    </p>
                  ) : null}
                  </Fragment>
                  );
                })}
                {loading && !idle.sections.some((section) => section.key === "tracked") ? (
                  <p className="flex items-center gap-2 px-2 py-2 text-sm text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    {loadingLabel}
                  </p>
                ) : null}
                {idle.hidden > 0 ? (
                  <p
                    ref={sentinelRef}
                    className="px-2 py-1.5 text-xs text-muted-foreground"
                  >
                    {idle.hidden} more below.
                  </p>
                ) : null}
                {!loading && allOptions.length === 0 && emptyLabel ? (
                  <p className="px-2 py-2 text-sm text-muted-foreground">{emptyLabel}</p>
                ) : null}
              </>
            )}
          </CommandList>
        </Command>
        </RemoveScroll>
      </PopoverContent>
    </Popover>
  );
}
