"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { filterBookmakers } from "@/lib/bookmakers";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";

const MENU_WIDTH = 224;

function dialogPortalRoot(from: HTMLElement | null): HTMLElement | null {
  const dialog = from?.closest("[data-slot='dialog-content']") as HTMLElement | null;
  if (!dialog) return null;
  return (
    (dialog.querySelector("[data-dialog-overlay-portal]") as HTMLElement | null) ?? dialog
  );
}

/** Compact searchable bookmaker picker — sits in the Back Bet panel header. */
export function BookmakerSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (name: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const options = useMemo(() => filterBookmakers(search), [search]);
  const showCustom =
    search.trim().length > 0 &&
    !options.some((o) => o.toLowerCase() === search.trim().toLowerCase());

  function updatePosition(root?: HTMLElement | null) {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const portalRoot = root ?? dialogPortalRoot(trigger);
    const triggerRect = trigger.getBoundingClientRect();

    if (portalRoot) {
      const rootRect = portalRoot.getBoundingClientRect();
      let left = triggerRect.right - rootRect.left - MENU_WIDTH;
      left = Math.max(8, Math.min(left, rootRect.width - MENU_WIDTH - 8));
      const top = triggerRect.bottom - rootRect.top + 4;
      setMenuStyle((prev) =>
        prev?.top === top && prev?.left === left ? prev : { top, left }
      );
      return;
    }

    let left = triggerRect.right - MENU_WIDTH;
    left = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8));
    const top = triggerRect.bottom + 4;
    setMenuStyle((prev) =>
      prev?.top === top && prev?.left === left ? prev : { top, left }
    );
  }

  useEffect(() => {
    if (!open) {
      setMenuStyle(null);
      setPortalTarget(null);
      return;
    }

    const root = dialogPortalRoot(triggerRef.current);
    setPortalTarget(root ?? document.body);
    updatePosition(root);

    requestAnimationFrame(() => searchRef.current?.focus());

    function onScroll(e: Event) {
      if (menuRef.current?.contains(e.target as Node)) return;
      updatePosition(root);
    }
    const onResize = () => updatePosition(root);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function pick(name: string) {
    onChange(name);
    setOpen(false);
    setSearch("");
  }

  function handleListWheel(e: React.WheelEvent<HTMLUListElement>) {
    e.stopPropagation();
  }

  const inDialog = portalTarget?.hasAttribute("data-dialog-overlay-portal");

  const menu =
    open && menuStyle ? (
      <div
        ref={menuRef}
        data-bookmaker-select-menu
        className={cn(
          "pointer-events-auto w-56 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg",
          inDialog ? "absolute z-[200]" : "fixed z-[10000]"
        )}
        style={{ top: menuStyle.top, left: menuStyle.left }}
      >
        <div className="border-b p-2">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bookies…"
            className="h-8 w-full rounded-md border-0 bg-muted px-2 text-xs outline-none ring-primary/40 focus:ring-2"
          />
        </div>
        <ul
          ref={listRef}
          className="max-h-48 overflow-y-auto overscroll-contain py-1 text-xs"
          onWheel={handleListWheel}
        >
          {showCustom && (
            <li>
              <button
                type="button"
                className="flex w-full px-3 py-1.5 text-left hover:bg-muted"
                onClick={() => pick(search.trim())}
              >
                Use &ldquo;{search.trim()}&rdquo;
              </button>
            </li>
          )}
          {options.map((name) => (
            <li key={name}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted"
                onClick={() => pick(name)}
              >
                <Check
                  className={cn(
                    "size-3 shrink-0",
                    value === name ? "opacity-100" : "opacity-0"
                  )}
                />
                {name}
              </button>
            </li>
          ))}
          {options.length === 0 && !showCustom && (
            <li className="px-3 py-2 text-muted-foreground">No matches</li>
          )}
        </ul>
      </div>
    ) : null;

  return (
    <>
      <div className={cn("relative", className)}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex h-[33px] max-w-[148px] items-center gap-1 rounded-md border-0 bg-[var(--pi)] px-2 text-xs font-bold text-black/85 outline-none ring-primary/40 focus:ring-2 dark:bg-[var(--pi-dark)] dark:text-white/95",
            !value && "text-black/45 dark:text-white/45"
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left">{value || "Bookie"}</span>
          <ChevronsUpDown className="size-3 shrink-0 opacity-60" />
        </button>
      </div>
      {menu && portalTarget && createPortal(menu, portalTarget)}
    </>
  );
}
