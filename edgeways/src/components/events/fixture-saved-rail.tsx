"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import type { FixtureScopeOption } from "@/components/events/fixture-scope-filter";
import { captionHeading, listRowSelected } from "@/lib/ui/surface-styles";
import { cn } from "@/lib/utils";

function RailRow({
  active,
  onClick,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onKeyDown,
  dragging,
  dropTarget,
  grabbed,
  children,
}: {
  active: boolean;
  onClick: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: () => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
  dragging?: boolean;
  dropTarget?: boolean;
  grabbed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-current={active ? "true" : undefined}
      aria-grabbed={grabbed || undefined}
      draggable={draggable}
      onKeyDown={onKeyDown}
      onDragStart={
        draggable
          ? (event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", "pin");
              onDragStart?.();
            }
          : undefined
      }
      onDragOver={
        draggable
          ? (event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              onDragOver?.();
            }
          : undefined
      }
      onDrop={
        draggable
          ? (event) => {
              event.preventDefault();
              onDrop?.();
            }
          : undefined
      }
      onDragEnd={draggable ? onDragEnd : undefined}
      className={cn(
        listRowSelected(active),
        "flex w-full min-w-0 items-center gap-3 px-2 py-1.5 text-left text-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        draggable && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-50",
        dropTarget && "bg-muted ring-1 ring-inset ring-border"
      )}
    >
      {children}
    </button>
  );
}

export function FixtureSavedRail({
  sport,
  pinned,
  scopeFilter,
  favouritesOnly,
  backedOnly,
  backedCount,
  onSelectAll,
  onSelectSaved,
  onSelectBacked,
  onSelectScope,
  onReorderPinned,
  showScopes = true,
  hydrated = true,
  className,
}: {
  sport: "football" | "horse_racing";
  pinned: FixtureScopeOption[];
  scopeFilter: string;
  favouritesOnly: boolean;
  backedOnly: boolean;
  backedCount: number;
  onSelectAll: () => void;
  onSelectSaved: () => void;
  onSelectBacked: () => void;
  onSelectScope: (id: string) => void;
  onReorderPinned?: (sourceId: string, targetId: string) => void;
  showScopes?: boolean;
  hydrated?: boolean;
  className?: string;
}) {
  const allActive = !favouritesOnly && !backedOnly && scopeFilter === "all";
  const noun = sport === "horse_racing" ? "courses" : "competitions";
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const skipClickRef = useRef(false);
  const canReorder = Boolean(onReorderPinned) && pinned.length > 1;

  function finishDrag() {
    setDragId(null);
    setDropId(null);
  }

  return (
    <nav
      className={cn("min-w-0", className)}
      aria-label={
        showScopes
          ? sport === "horse_racing"
            ? "Courses"
            : "Competitions"
          : sport === "horse_racing"
            ? "Pinned courses"
            : "Pinned competitions"
      }
    >
      {showScopes ? (
        <div className="flex flex-col gap-0.5">
          <RailRow active={allActive} onClick={onSelectAll}>
            <span className="min-w-0 flex-1 truncate">All</span>
          </RailRow>
          <RailRow active={favouritesOnly} onClick={onSelectSaved}>
            <span className="min-w-0 flex-1 truncate">Pinned only</span>
            {hydrated ? (
              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                {pinned.length}
              </span>
            ) : null}
          </RailRow>
          {hydrated && backedCount > 0 ? (
            <RailRow active={backedOnly} onClick={onSelectBacked}>
              <span className="min-w-0 flex-1 truncate">Backed only</span>
              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                {backedCount}
              </span>
            </RailRow>
          ) : null}
        </div>
      ) : null}
      {!hydrated ? null : (
        <div className={cn(showScopes && "mt-4")}>
          <p className={cn(captionHeading, "px-2 pb-1.5")}>
            {sport === "horse_racing" ? "Courses" : "Competitions"}
          </p>
          {pinned.length > 0 ? (
        <ul className="flex flex-col gap-0.5">
          {pinned.map((option, index) => {
            const selected = !favouritesOnly && !backedOnly && scopeFilter === option.id;
            return (
              <li key={option.id}>
                <RailRow
                  active={selected}
                  onClick={() => {
                    if (skipClickRef.current) {
                      skipClickRef.current = false;
                      return;
                    }
                    onSelectScope(option.id);
                  }}
                  draggable={canReorder}
                  dragging={dragId === option.id}
                  dropTarget={dropId === option.id && dragId !== option.id}
                  grabbed={dragId === option.id}
                  onDragStart={() => {
                    skipClickRef.current = true;
                    setDragId(option.id);
                  }}
                  onDragOver={() => setDropId(option.id)}
                  onDrop={() => {
                    if (dragId && dragId !== option.id) {
                      onReorderPinned?.(dragId, option.id);
                    }
                    finishDrag();
                  }}
                  onDragEnd={finishDrag}
                  onKeyDown={(event) => {
                    if (!canReorder) return;
                    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                    const target =
                      pinned[index + (event.key === "ArrowUp" ? -1 : 1)];
                    if (!target) return;
                    event.preventDefault();
                    onReorderPinned?.(option.id, target.id);
                  }}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    {option.icon}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate"
                    title={
                      canReorder
                        ? `${option.name ?? option.label}. Drag to reorder.`
                        : (option.name ?? option.label)
                    }
                  >
                    {option.name ?? option.label}
                  </span>
                  {option.count > 0 ? (
                    <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                      {option.count}
                    </span>
                  ) : null}
                </RailRow>
              </li>
            );
          })}
        </ul>
          ) : (
            <p className="px-2 text-xs leading-snug text-muted-foreground">
              Pinned {noun} show here.
            </p>
          )}
          {canReorder ? (
            <p className="px-2 pt-2 text-xs leading-snug text-muted-foreground">
              Drag to reorder.
            </p>
          ) : null}
        </div>
      )}
    </nav>
  );
}
