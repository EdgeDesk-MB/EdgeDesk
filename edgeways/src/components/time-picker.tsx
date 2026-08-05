"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterPill } from "@/components/ui/filter-pill";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { filterPillGroup } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

/** Canonical end-of-day clock time used when expiry time is left blank. */
export const END_OF_DAY_HM = "23:59";

const ITEM_H = 36;
const VISIBLE = 5;
const WHEEL_H = ITEM_H * VISIBLE;
const PAD_COUNT = Math.floor(VISIBLE / 2);

function parseHm(value: string): { hour: string; minute: string } | null {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return {
    hour: String(hour).padStart(2, "0"),
    minute: String(minute).padStart(2, "0"),
  };
}

function indexOfValue(values: string[], value: string): number {
  const i = values.indexOf(value);
  return i >= 0 ? i : 0;
}

/**
 * iOS-style snap wheel column. Mouse can drag or use the wheel;
 * touch/pen keep native scrolling. Scroll is stopped from bubbling into dialogs.
 */
function WheelColumn({
  values,
  selected,
  onSelect,
  ariaLabel,
  active,
}: {
  values: string[];
  selected: string;
  onSelect: (value: string) => void;
  ariaLabel: string;
  /** When the popover opens, columns remount/reset scroll to selection. */
  active: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmatic = useRef(false);
  const dragRef = useRef<{ startY: number; startScroll: number } | null>(null);
  const draggedRef = useRef(false);

  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = "auto") => {
    const el = scrollerRef.current;
    if (!el) return;
    programmatic.current = true;
    el.scrollTo({ top: index * ITEM_H, behavior });
    window.setTimeout(() => {
      programmatic.current = false;
    }, behavior === "smooth" ? 280 : 0);
  }, []);

  useEffect(() => {
    if (!active) return;
    scrollToIndex(indexOfValue(values, selected), "auto");
    // Only when the popover opens / column activates — not on every selected change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional open-only sync
  }, [active, scrollToIndex, values]);

  const commitNearest = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollTop / ITEM_H)));
    const next = values[idx]!;
    if (Math.abs(el.scrollTop - idx * ITEM_H) > 0.5) {
      scrollToIndex(idx, "smooth");
    }
    if (next !== selected) onSelect(next);
  }, [onSelect, scrollToIndex, selected, values]);

  function onScroll() {
    if (programmatic.current) return;
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(commitNearest, 80);
  }

  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    // Keep wheel deltas on this column; dialogs/page must not steal them.
    e.stopPropagation();
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    dragRef.current = { startY: e.clientY, startScroll: scrollerRef.current?.scrollTop ?? 0 };
    draggedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const el = scrollerRef.current;
    if (!drag || !el) return;
    const dy = e.clientY - drag.startY;
    if (!draggedRef.current && Math.abs(dy) < 4) return;
    draggedRef.current = true;
    el.scrollTop = drag.startScroll - dy;
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (dragRef.current) {
      dragRef.current = null;
      if (draggedRef.current) {
        e.preventDefault();
        commitNearest();
      }
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  return (
    <div
      ref={scrollerRef}
      role="listbox"
      aria-label={ariaLabel}
      aria-activedescendant={`${ariaLabel}-${selected}`}
      tabIndex={0}
      onScroll={onScroll}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(e) => {
        const idx = indexOfValue(values, selected);
        if (e.key === "ArrowDown" || e.key === "PageDown") {
          e.preventDefault();
          const next = Math.min(values.length - 1, idx + 1);
          onSelect(values[next]!);
          scrollToIndex(next, "smooth");
        } else if (e.key === "ArrowUp" || e.key === "PageUp") {
          e.preventDefault();
          const next = Math.max(0, idx - 1);
          onSelect(values[next]!);
          scrollToIndex(next, "smooth");
        }
      }}
      className={cn(
        "w-12 touch-pan-y overflow-y-auto overscroll-contain",
        "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        "cursor-grab active:cursor-grabbing select-none",
        // Fade items toward the top/bottom edges (iOS wheel).
        "[mask-image:linear-gradient(to_bottom,transparent_0%,black_22%,black_78%,transparent_100%)]"
      )}
      style={{ height: WHEEL_H, scrollSnapType: "y mandatory" }}
    >
      {Array.from({ length: PAD_COUNT }).map((_, i) => (
        <div key={`pad-top-${i}`} aria-hidden style={{ height: ITEM_H }} />
      ))}
      {values.map((value) => {
        const activeItem = value === selected;
        return (
          <div
            key={value}
            id={`${ariaLabel}-${value}`}
            role="option"
            aria-selected={activeItem}
            onClick={() => {
              if (draggedRef.current) return;
              onSelect(value);
              scrollToIndex(indexOfValue(values, value), "smooth");
            }}
            className={cn(
              "flex items-center justify-center text-[15px] tabular-nums transition-colors",
              activeItem ? "font-semibold text-foreground" : "font-normal text-muted-foreground"
            )}
            style={{ height: ITEM_H, scrollSnapAlign: "center" }}
          >
            {value}
          </div>
        );
      })}
      {Array.from({ length: PAD_COUNT }).map((_, i) => (
        <div key={`pad-bot-${i}`} aria-hidden style={{ height: ITEM_H }} />
      ))}
    </div>
  );
}

/**
 * Shared time field: shadcn Popover + iOS-style hour/minute wheels.
 * Value is always HH:mm (24h) or empty.
 */
export function TimePicker({
  value,
  onChange,
  placeholder = "12:00",
  className,
  id,
  disabled,
  /** Ending/expiry fields: End of day (23:59) chip under the wheels. */
  shortcuts,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  shortcuts?: "ending";
}) {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseHm(value), [value]);
  const [hour, setHour] = useState(parsed?.hour ?? "12");
  const [minute, setMinute] = useState(parsed?.minute ?? "00");
  const endOfDayActive = value.trim() === END_OF_DAY_HM || (hour === "23" && minute === "59");

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setHour(parsed?.hour ?? "12");
      setMinute(parsed?.minute ?? "00");
    });
  }, [open, parsed?.hour, parsed?.minute]);

  function commit(nextHour: string, nextMinute: string) {
    setHour(nextHour);
    setMinute(nextMinute);
    onChange(`${nextHour}:${nextMinute}`);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!parsed}
          className={cn(
            "w-full justify-start px-2.5 text-left font-normal tabular-nums data-[empty=true]:text-muted-foreground",
            className
          )}
        >
          <Clock className="size-3.5 shrink-0 text-muted-foreground" />
          {parsed ? `${parsed.hour}:${parsed.minute}` : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto gap-0 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onWheel={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-2">
          <div className="relative" style={{ height: WHEEL_H }}>
            {/* Selection lens — spans both columns like iOS */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-9 -translate-y-1/2 rounded-lg bg-muted"
            />
            <div className="relative z-10 flex h-full items-stretch justify-center gap-0.5">
              <WheelColumn
                ariaLabel="Hour"
                values={HOURS}
                selected={hour}
                active={open}
                onSelect={(h) => commit(h, minute)}
              />
              <div
                aria-hidden
                className="flex w-2.5 shrink-0 items-center justify-center text-sm font-semibold text-foreground"
              >
                :
              </div>
              <WheelColumn
                ariaLabel="Minute"
                values={MINUTES}
                selected={minute}
                active={open}
                onSelect={(m) => commit(hour, m)}
              />
            </div>
          </div>
        </div>
        {shortcuts === "ending" ? (
          <div className={cn(filterPillGroup, "justify-center border-t px-2 py-2")}>
            <FilterPill
              compact
              active={endOfDayActive}
              onClick={() => {
                commit("23", "59");
                setOpen(false);
              }}
            >
              End of day
            </FilterPill>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2 border-t px-2 py-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            Clear
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => {
              commit(hour, minute);
              setOpen(false);
            }}
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
